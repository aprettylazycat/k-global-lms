/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Endpoint công khai — KHÔNG yêu cầu đăng nhập, không trả về email/thông tin nhạy cảm
export async function GET() {
  const { data: branchesRaw } = await supabaseAdmin
    .from('branches')
    .select('id, name, slug')
    .order('name')

  // Bỏ nhánh nội bộ 'chung' (dùng riêng cho module AI dùng chung mọi nhánh) khỏi bảng xếp hạng theo nhánh
  const branches = (branchesRaw || []).filter(b => b.slug !== 'chung')

  if (!branches || branches.length === 0) {
    return NextResponse.json({ branches: [] })
  }

  const { data: profilesRaw } = await supabaseAdmin
    .from('profiles')
    .select('id, name, branch_id, role, avatar_url')
    .neq('role', 'super_admin')

  // Chỉ tính học viên đã xác thực email — tránh tài khoản đăng ký dở lọt lên bảng xếp hạng
  const confirmedIds = new Set<string>()
  let page = 1
  while (true) {
    const { data: userPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (!userPage || userPage.users.length === 0) break
    userPage.users.forEach(u => { if (u.email_confirmed_at) confirmedIds.add(u.id) })
    if (userPage.users.length < 1000) break
    page++
  }
  const profiles = (profilesRaw || []).filter(p => confirmedIds.has(p.id))

  const { data: lessons } = await supabaseAdmin
    .from('lessons')
    .select('id, branch_id')
    .eq('is_published', true)

  const { data: allProgress } = await supabaseAdmin
    .from('progress')
    .select('user_id, lesson_id, tick1, tick2, perfect_score, completed_at')

  const { data: allBadges } = await supabaseAdmin
    .from('badges')
    .select('user_id, badge_type')

  const { data: allTimestamps } = await supabaseAdmin
    .from('lesson_timestamps')
    .select('user_id, lesson_id, started_at, quiz_started_at, quiz_completed_at, practice_started_at, practice_submitted_at')

  // ── Xác định module AI trước, để loại badge AI khỏi điểm nhánh ──
  const { data: aiModules } = await supabaseAdmin
    .from('modules')
    .select('id, name')
    .eq('category', 'ai')

  const aiModuleIds = new Set((aiModules || []).map(m => m.id))
  const aiBadgeTypes = new Set(Array.from(aiModuleIds).map(id => `module-${id}`))

  const { data: aiLessons } = aiModuleIds.size > 0
    ? await supabaseAdmin
        .from('lessons')
        .select('id, module_id')
        .eq('is_published', true)
        .in('module_id', Array.from(aiModuleIds))
    : { data: [] as any[] }

  const aiLessonIds = new Set((aiLessons || []).map(l => l.id))
  const aiTotalLessons = aiLessonIds.size

  const TS_FIELDS = ['started_at', 'quiz_started_at', 'quiz_completed_at', 'practice_started_at', 'practice_submitted_at'] as const

  // Trả về { startedAt, lastActivityAt } của 1 học viên, chỉ tính trong phạm vi lessonIds cho trước
  function getTimeStats(userId: string, lessonIds: Set<number>) {
    const rows = (allTimestamps || []).filter(t => t.user_id === userId && lessonIds.has(t.lesson_id))
    let startedAt: string | null = null
    let lastActivityAt: string | null = null
    rows.forEach(r => {
      TS_FIELDS.forEach(f => {
        const v = (r as any)[f] as string | null
        if (!v) return
        if (f === 'started_at' && (!startedAt || v < startedAt)) startedAt = v
        if (!lastActivityAt || v > lastActivityAt) lastActivityAt = v
      })
    })
    return { startedAt, lastActivityAt }
  }

  function daysBetween(a: string | null, b: string | null): number | null {
    if (!a || !b) return null
    const diff = new Date(b).getTime() - new Date(a).getTime()
    return diff >= 0 ? Math.round(diff / 86400000) : null
  }

  const result = branches.map(branch => {
    // Chỉ tính bài của nhánh, KHÔNG tính bài thuộc khóa AI (khóa chung, có bảng riêng)
    const branchLessonIds = new Set(
      (lessons || [])
        .filter(l => l.branch_id === branch.id && !aiLessonIds.has(l.id))
        .map(l => l.id)
    )
    const totalLessons = branchLessonIds.size

    const branchProfiles = (profiles || []).filter(p => p.branch_id === branch.id)

    const leaderboard = branchProfiles.map(profile => {
      const userProgress = (allProgress || []).filter(
        p => p.user_id === profile.id && branchLessonIds.has(p.lesson_id)
      )
      const tick1Count = userProgress.filter(p => p.tick1).length
      const tick2Count = userProgress.filter(p => p.tick2).length
      const perfectCount = userProgress.filter(p => p.perfect_score).length
      // Chỉ đếm badge nghề — bỏ badge của module AI ra khỏi điểm nhánh
      const badgeCount = (allBadges || []).filter(
        b => b.user_id === profile.id && !aiBadgeTypes.has(b.badge_type)
      ).length

      const progressPct = totalLessons > 0
        ? Math.round(((tick1Count / totalLessons) + (tick2Count / totalLessons)) / 2 * 100)
        : 0

      const score = progressPct + badgeCount * 7 + perfectCount * 5

      const { startedAt, lastActivityAt } = getTimeStats(profile.id, branchLessonIds)
      const allDone = totalLessons > 0 && tick2Count === totalLessons
      const completedAt = allDone
        ? userProgress.filter(p => p.tick2 && p.completed_at).map(p => p.completed_at as string).sort().pop() ?? null
        : null
      const daysToComplete = daysBetween(startedAt, completedAt)
      const daysSinceActive = lastActivityAt ? daysBetween(lastActivityAt, new Date().toISOString()) : null

      return {
        userId: profile.id,
        name: profile.name || 'Học viên',
        avatarUrl: profile.avatar_url || null,
        progressPct,
        badgeCount,
        perfectCount,
        score,
        completedAt,
        daysToComplete,
        daysSinceActive,
      }
    })

    leaderboard.sort((a, b) => b.score - a.score)

    return {
      branchId: branch.id,
      branchName: branch.name,
      branchSlug: branch.slug,
      leaderboard: leaderboard.slice(0, 50), // top 50 mỗi chi nhánh
    }
  })

  // ══════════════════════════════════════════════════════
  //  BẢNG XẾP HẠNG MODULE AI (Kiến thức chung — mọi nhánh)
  // ══════════════════════════════════════════════════════
  const branchNameById: Record<string, string> = {}
  branches.forEach(b => { branchNameById[b.id] = b.name })

  // Toàn bộ học viên đã đăng ký (mọi nhánh), không chỉ nhánh có bài AI
  const aiLeaderboard = (profiles || []).map(profile => {
    const userProgress = (allProgress || []).filter(
      p => p.user_id === profile.id && aiLessonIds.has(p.lesson_id)
    )
    const doneCount = userProgress.filter(p => p.tick1 && p.tick2).length
    const perfectCount = userProgress.filter(p => p.perfect_score).length

    const progressPct = aiTotalLessons > 0
      ? Math.round((doneCount / aiTotalLessons) * 100)
      : 0

    // Badge của riêng khóa AI (nếu có) — chỉ tính ở bảng này
    const aiBadgeCount = (allBadges || []).filter(
      b => b.user_id === profile.id && aiBadgeTypes.has(b.badge_type)
    ).length

    const score = progressPct + perfectCount * 5 + aiBadgeCount * 7

    const { startedAt, lastActivityAt } = getTimeStats(profile.id, aiLessonIds)
    const allDone = aiTotalLessons > 0 && doneCount === aiTotalLessons
    const completedAt = allDone
      ? userProgress.filter(p => p.tick2 && p.completed_at).map(p => p.completed_at as string).sort().pop() ?? null
      : null
    const daysToComplete = daysBetween(startedAt, completedAt)
    const daysSinceActive = lastActivityAt ? daysBetween(lastActivityAt, new Date().toISOString()) : null

    return {
      userId: profile.id,
      name: profile.name || 'Học viên',
      avatarUrl: profile.avatar_url || null,
      branchName: branchNameById[profile.branch_id] || '—',
      lessonsDone: doneCount,
      totalLessons: aiTotalLessons,
      progressPct,
      perfectCount,
      aiBadgeCount,
      score,
      completedAt,
      daysToComplete,
      daysSinceActive,
    }
  })
  // Xếp theo điểm; ai chưa học bài AI nào thì xuống cuối
  .sort((a, b) => b.score - a.score || b.lessonsDone - a.lessonsDone)

  return NextResponse.json({
    branches: result,
    ai: {
      moduleName: (aiModules || [])[0]?.name || 'Kiến thức chung',
      totalLessons: aiTotalLessons,
      leaderboard: aiLeaderboard.slice(0, 100),
    },
  })
}
