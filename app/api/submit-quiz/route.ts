/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { lessonId, userId, answers } = await req.json()

  // Lấy lại câu hỏi gốc từ DB để chấm (không tin đáp án đúng do client tự gửi lên)
  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from('lessons')
    .select('questions')
    .eq('id', lessonId)
    .single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Không tìm thấy bài học' }, { status: 404 })
  }

  const mcqs = (lesson.questions || []).filter((q: any) => q.type === 'mcq')
  

  // Chấm từng câu MCQ
const results: { id: string; correct: boolean }[] = mcqs.map((q: any) => {
  const userAnswer = answers[q.id]
  const isCorrect = userAnswer === q.correct
  return { id: q.id, correct: isCorrect }
})

const allCorrect = results.every(r => r.correct)

  // Chỉ tick1 = true khi đúng hết
  if (allCorrect) {
    const { error } = await supabaseAdmin
      .from('progress')
      .upsert({
        user_id: userId,
        lesson_id: lessonId,
        tick1: true
      }, { onConflict: 'user_id,lesson_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Tính badge mới đạt được
    const newBadge = await checkBadgesAndReturnNew(userId)
    await checkBadges(userId)

    return NextResponse.json({ success: true, allCorrect, results, newBadge })
  }

  return NextResponse.json({ success: true, allCorrect, results, newBadge: null })
}

async function checkBadges(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('branch_id').eq('id', userId).single()

  const { data: branchLessons } = await supabaseAdmin
    .from('lessons')
    .select('id')
    .eq('branch_id', profile?.branch_id)
    .eq('is_published', true)

  const lessonIds = (branchLessons ?? []).map(l => l.id)
  const total = lessonIds.length || 1

  if (lessonIds.length === 0) return

  const { data: progressRows } = await supabaseAdmin
    .from('progress')
    .select('lesson_id, tick1, tick2')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds)

  const tick1Count = (progressRows ?? []).filter(p => p.tick1).length
  const tick2Count = (progressRows ?? []).filter(p => p.tick2).length

  // % tổng = trung bình cộng (tỉ lệ tick1) và (tỉ lệ tick2) — đồng bộ với dashboard và approve route
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

async function checkBadgesAndReturnNew(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('branch_id').eq('id', userId).single()

  const { data: branchLessons } = await supabaseAdmin
    .from('lessons').select('id')
    .eq('branch_id', profile?.branch_id).eq('is_published', true)

  const lessonIds = (branchLessons ?? []).map(l => l.id)
  const total = lessonIds.length || 1
  if (lessonIds.length === 0) return null

  const { data: progressRows } = await supabaseAdmin
    .from('progress').select('lesson_id, tick1, tick2')
    .eq('user_id', userId).in('lesson_id', lessonIds)

  const tick1Count = (progressRows ?? []).filter(p => p.tick1).length
  const tick2Count = (progressRows ?? []).filter(p => p.tick2).length
  const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)

  // Badges đã có trước khi submit
  const { data: existingBadges } = await supabaseAdmin
    .from('badges').select('badge_type').eq('user_id', userId)
  const existing = new Set((existingBadges ?? []).map(b => b.badge_type))

  const thresholds = [
    { min: 25, type: 'bronze' },
    { min: 50, type: 'silver' },
    { min: 75, type: 'gold' },
    { min: 100, type: 'diamond' },
  ]

  // Tìm badge mới nhất vừa đạt được (cao nhất trước)
  const newBadge = thresholds.slice().reverse().find(b => pct >= b.min && !existing.has(b.type))
  return newBadge?.type ?? null
}