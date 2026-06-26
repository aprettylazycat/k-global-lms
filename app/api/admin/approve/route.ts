/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { submissionId, userId, lessonId, perfectScore } = await req.json()

  await supabaseAdmin
    .from('submissions')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)

  await supabaseAdmin
    .from('progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      tick2: true,
      completed_at: new Date().toISOString(),
      ...(perfectScore ? { perfect_score: true } : {}),
    }, { onConflict: 'user_id,lesson_id' })

  await checkBadges(userId)

  return NextResponse.json({ success: true })
}

async function checkBadges(userId: string) {
  // Lấy branch của user
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('branch_id').eq('id', userId).single()

  // Tổng số bài đã publish trong nhánh
  const { data: branchLessons } = await supabaseAdmin
    .from('lessons')
    .select('id')
    .eq('branch_id', profile?.branch_id)
    .eq('is_published', true)

  const lessonIds = (branchLessons ?? []).map(l => l.id)
  const total = lessonIds.length || 1

  if (lessonIds.length === 0) return

  // Toàn bộ progress của user trong các bài thuộc nhánh này
  const { data: progressRows } = await supabaseAdmin
    .from('progress')
    .select('lesson_id, tick1, tick2')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds)

  const tick1Count = (progressRows ?? []).filter(p => p.tick1).length
  const tick2Count = (progressRows ?? []).filter(p => p.tick2).length

  // % tổng = trung bình cộng (tỉ lệ tick1) và (tỉ lệ tick2) — đồng bộ với công thức ở dashboard
  const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)

  const badges = [
    { min: 25,  type: 'bronze' },
    { min: 50,  type: 'silver' },
    { min: 75,  type: 'gold' },
    { min: 100, type: 'diamond' },
  ]

  for (const badge of badges) {
    if (pct >= badge.min) {
      await supabaseAdmin.from('badges').upsert(
        { user_id: userId, badge_type: badge.type },
        { onConflict: 'user_id,badge_type' }
      )
    }
  }
}