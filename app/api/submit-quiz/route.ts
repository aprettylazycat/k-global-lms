/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { lessonId, userId, answers, attempts } = await req.json()
  // attempts: Record<questionId, { selectedOption: number, isFirstAttempt: boolean }[]>

  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from('lessons')
    .select('questions')
    .eq('id', lessonId)
    .single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Không tìm thấy bài học' }, { status: 404 })
  }

  const mcqs = (lesson.questions || []).filter((q: any) => q.type === 'mcq')

  const results: { id: string; correct: boolean }[] = mcqs.map((q: any) => {
    const userAnswer = answers[q.id]
    const isCorrect = userAnswer === q.correct
    return { id: q.id, correct: isCorrect }
  })

  const allCorrect = results.every(r => r.correct)

  // Ghi quiz_attempts nếu có data
  if (attempts && Object.keys(attempts).length > 0) {
    const attemptRows = Object.entries(attempts).flatMap(([questionId, tryList]: [string, any]) =>
      (tryList as any[]).map((t: any, idx: number) => ({
        user_id: userId,
        lesson_id: lessonId,
        question_id: questionId,
        selected_option: t.selectedOption,
        is_correct: t.isCorrect,
        is_first_attempt: idx === 0,
      }))
    )
    if (attemptRows.length > 0) {
      await supabaseAdmin.from('quiz_attempts').insert(attemptRows)
    }
  }

  if (allCorrect) {
    const { error } = await supabaseAdmin
      .from('progress')
      .upsert({ user_id: userId, lesson_id: lessonId, tick1: true }, { onConflict: 'user_id,lesson_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Ghi timestamp quiz hoàn thành
    await supabaseAdmin
      .from('lesson_timestamps')
      .upsert({ user_id: userId, lesson_id: lessonId, quiz_completed_at: new Date().toISOString() },
        { onConflict: 'user_id,lesson_id' })

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
    .from('lessons').select('id').eq('branch_id', profile?.branch_id).eq('is_published', true)
  const lessonIds = (branchLessons ?? []).map(l => l.id)
  const total = lessonIds.length || 1
  if (lessonIds.length === 0) return
  const { data: progressRows } = await supabaseAdmin
    .from('progress').select('lesson_id, tick1, tick2').eq('user_id', userId).in('lesson_id', lessonIds)
  const tick1Count = (progressRows ?? []).filter(p => p.tick1).length
  const tick2Count = (progressRows ?? []).filter(p => p.tick2).length
  const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)
  const badges = [{ min: 25, type: 'bronze' }, { min: 50, type: 'silver' }, { min: 75, type: 'gold' }, { min: 100, type: 'diamond' }]
  for (const badge of badges) {
    if (pct >= badge.min) {
      await supabaseAdmin.from('badges').upsert({ user_id: userId, badge_type: badge.type }, { onConflict: 'user_id,badge_type' })
    }
  }
}

async function checkBadgesAndReturnNew(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('branch_id').eq('id', userId).single()
  const { data: branchLessons } = await supabaseAdmin
    .from('lessons').select('id').eq('branch_id', profile?.branch_id).eq('is_published', true)
  const lessonIds = (branchLessons ?? []).map(l => l.id)
  const total = lessonIds.length || 1
  if (lessonIds.length === 0) return null
  const { data: progressRows } = await supabaseAdmin
    .from('progress').select('lesson_id, tick1, tick2').eq('user_id', userId).in('lesson_id', lessonIds)
  const tick1Count = (progressRows ?? []).filter(p => p.tick1).length
  const tick2Count = (progressRows ?? []).filter(p => p.tick2).length
  const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)
  const { data: existingBadges } = await supabaseAdmin
    .from('badges').select('badge_type').eq('user_id', userId)
  const existing = new Set((existingBadges ?? []).map(b => b.badge_type))
  const thresholds = [{ min: 25, type: 'bronze' }, { min: 50, type: 'silver' }, { min: 75, type: 'gold' }, { min: 100, type: 'diamond' }]
  const newBadge = thresholds.slice().reverse().find(b => pct >= b.min && !existing.has(b.type))
  return newBadge?.type ?? null
}