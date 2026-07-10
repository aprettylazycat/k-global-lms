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

  const result = branches.map(branch => {
    const branchLessonIds = new Set((lessons || []).filter(l => l.branch_id === branch.id).map(l => l.id))
    const totalLessons = branchLessonIds.size

    const branchProfiles = (profiles || []).filter(p => p.branch_id === branch.id)

    const leaderboard = branchProfiles.map(profile => {
      const userProgress = (allProgress || []).filter(
        p => p.user_id === profile.id && branchLessonIds.has(p.lesson_id)
      )
      const tick1Count = userProgress.filter(p => p.tick1).length
      const tick2Count = userProgress.filter(p => p.tick2).length
      const perfectCount = userProgress.filter(p => p.perfect_score).length
      const badgeCount = (allBadges || []).filter(b => b.user_id === profile.id).length

      const progressPct = totalLessons > 0
        ? Math.round(((tick1Count / totalLessons) + (tick2Count / totalLessons)) / 2 * 100)
        : 0

      const score = progressPct + badgeCount * 5 + perfectCount * 10

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

  return NextResponse.json({ branches: result })
}
