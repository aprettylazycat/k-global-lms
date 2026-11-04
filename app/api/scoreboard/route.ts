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
    .select('id, name, order_index')
    .eq('category', 'ai')
    .order('order_index')

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

  const TS_FIELDS = ['started_at', 'quiz_started_at', 'quiz_completed_at', 'practice_started_at', 'practice_submitted_at'] as const

  // Trả về { startedAt, lastActivityAt } của 1 học viên, chỉ tính trong phạm vi lessonIds cho trước
  const tsByUser = new Map<string, any[]>()
  ;(allTimestamps || []).forEach(t => {
    if (!tsByUser.has(t.user_id)) tsByUser.set(t.user_id, [])
    tsByUser.get(t.user_id)!.push(t)
  })

  function getTimeStats(userId: string, lessonIds: Set<number>) {
    const rows = (tsByUser.get(userId) || []).filter(t => lessonIds.has(t.lesson_id))
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
  //  BẢNG XẾP HẠNG TỪNG KHÓA CHUNG — mỗi module category 'ai' là 1 bảng riêng
  //  (AI K-Global, Content B2B, và mọi khóa chung thêm sau này đều tự có bảng)
  // ══════════════════════════════════════════════════════
  const branchNameById: Record<string, string> = {}
  branches.forEach(b => { branchNameById[b.id] = b.name })

  const progressByUser = new Map<string, any[]>()
  ;(allProgress || []).forEach(p => {
    if (!progressByUser.has(p.user_id)) progressByUser.set(p.user_id, [])
    progressByUser.get(p.user_id)!.push(p)
  })
  const badgesByUser = new Map<string, any[]>()
  ;(allBadges || []).forEach(b => {
    if (!badgesByUser.has(b.user_id)) badgesByUser.set(b.user_id, [])
    badgesByUser.get(b.user_id)!.push(b)
  })

  const courses = (aiModules || []).map(mod => {
    const lessonIds = new Set((aiLessons || []).filter(l => l.module_id === mod.id).map(l => l.id))
    const totalLessons = lessonIds.size
    // Khóa chưa xuất bản bài nào thì chưa hiện bảng xếp hạng
    if (totalLessons === 0) return null

    const badgeType = `module-${mod.id}`

    // Toàn bộ học viên đã xác thực (mọi nhánh), kể cả người chưa học bài nào của khóa này
    const entries = (profiles || []).map(profile => {
      const userProgress = (progressByUser.get(profile.id) || []).filter(p => lessonIds.has(p.lesson_id))
      const doneCount = userProgress.filter(p => p.tick1 && p.tick2).length
      const perfectCount = userProgress.filter(p => p.perfect_score).length

      const progressPct = Math.round((doneCount / totalLessons) * 100)

      // Huy hiệu hoàn thành của RIÊNG khóa này
      const aiBadgeCount = (badgesByUser.get(profile.id) || []).filter(b => b.badge_type === badgeType).length

      const score = progressPct + perfectCount * 5 + aiBadgeCount * 7

      const { startedAt, lastActivityAt } = getTimeStats(profile.id, lessonIds)
      const allDone = doneCount === totalLessons
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
        totalLessons,
        progressPct,
        perfectCount,
        aiBadgeCount,
        score,
        completedAt,
        daysToComplete,
        daysSinceActive,
      }
    })
    // Xếp theo điểm; ai chưa học bài nào của khóa này thì xuống cuối
    .sort((a, b) => b.score - a.score || b.lessonsDone - a.lessonsDone)

    return {
      moduleId: mod.id,
      moduleName: mod.name,
      totalLessons,
      // Đếm trên toàn bộ học viên, không bị cắt bởi giới hạn top 100 bên dưới
      completedCount: entries.filter(e => e.progressPct === 100).length,
      leaderboard: entries.slice(0, 100),
    }
  }).filter(c => c !== null)

  return NextResponse.json({
    branches: result,
    courses,
  })
}
