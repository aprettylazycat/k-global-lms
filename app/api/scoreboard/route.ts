/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Endpoint công khai — KHÔNG yêu cầu đăng nhập, không trả về email/thông tin nhạy cảm
export async function GET() {
  const { data: branches } = await supabaseAdmin
    .from('branches')
    .select('id, name, slug')
    .order('name')

  if (!branches || branches.length === 0) {
    return NextResponse.json({ branches: [] })
  }

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, name, branch_id, role')
    .neq('role', 'admin')

  const { data: lessons } = await supabaseAdmin
    .from('lessons')
    .select('id, branch_id')
    .eq('is_published', true)

  const { data: allProgress } = await supabaseAdmin
    .from('progress')
    .select('user_id, lesson_id, tick1, tick2, perfect_score')

  const { data: allBadges } = await supabaseAdmin
    .from('badges')
    .select('user_id, badge_type')

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

      return {
        userId: profile.id,
        name: profile.name || 'Học viên',
        progressPct,
        badgeCount,
        perfectCount,
        score,
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

    return {
      userId: profile.id,
      name: profile.name || 'Học viên',
      branchName: branchNameById[profile.branch_id] || '—',
      lessonsDone: doneCount,
      totalLessons: aiTotalLessons,
      progressPct,
      perfectCount,
      aiBadgeCount,
      score,
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