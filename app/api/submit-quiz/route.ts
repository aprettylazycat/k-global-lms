/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { lessonId, userId, answers, attempts, tfAnswers, tfQuestions } = await req.json()

  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from('lessons').select('questions').eq('id', lessonId).single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Không tìm thấy bài học' }, { status: 404 })
  }

  // Chấm MCQ
  const mcqs = (lesson.questions || []).filter((q: any) => q.type === 'mcq')
  const results: { id: string; correct: boolean }[] = mcqs.map((q: any) => ({
    id: q.id,
    correct: answers[q.id] === q.correct
  }))
  const mcqAllCorrect = mcqs.length === 0 || results.every(r => r.correct)

  // Chấm TF
  const tfAllCorrect = !tfQuestions || tfQuestions.length === 0 || tfQuestions.every((group: any) => {
    const groupAnswers = tfAnswers?.[group.id] || {}
    return group.items.every((item: any) => groupAnswers[item.id] === item.correct)
  })

  const allCorrect = mcqAllCorrect && tfAllCorrect

  // Ghi MCQ attempts
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

  // Ghi TF attempts — lưu số câu đúng/sai và chi tiết từng câu
  if (tfQuestions && tfQuestions.length > 0 && tfAnswers) {
    const tfRows: any[] = tfQuestions.map((group: any) => {
      const groupAnswers = tfAnswers[group.id] || {}
      const itemDetails = group.items.map((item: any) => ({
        id: item.id,
        statement: item.statement,
        selected: groupAnswers[item.id] ?? null,
        correct: item.correct,
        isCorrect: groupAnswers[item.id] === item.correct
      }))
      const correctCount = itemDetails.filter((i: any) => i.isCorrect).length
      return {
        user_id: userId,
        lesson_id: lessonId,
        question_id: `tf_group_${group.id}`,
        selected_option: correctCount,           // số câu đúng
        is_correct: correctCount === group.items.length,
        is_first_attempt: true,
        extra_data: JSON.stringify({
          group_question: group.question,
          total: group.items.length,
          correct: correctCount,
          wrong: group.items.length - correctCount,
          items: itemDetails
        })
      }
    })
    if (tfRows.length > 0) {
      await supabaseAdmin.from('quiz_attempts').insert(tfRows)
    }
  }

  if (!allCorrect) {
    return NextResponse.json({ success: true, allCorrect, results, newBadge: null })
  }

  // Ghi progress + timestamp
  await Promise.all([
    supabaseAdmin.from('progress').upsert(
      { user_id: userId, lesson_id: lessonId, tick1: true },
      { onConflict: 'user_id,lesson_id' }
    ).then(),
    supabaseAdmin.from('lesson_timestamps').upsert(
      { user_id: userId, lesson_id: lessonId, quiz_completed_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    ).then(),
  ])

  const newBadgePromise = checkAndAwardBadges(userId)
  const newBadge = await Promise.race([
    newBadgePromise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), 1000))
  ])
  newBadgePromise.catch(() => {})

  return NextResponse.json({ success: true, allCorrect, results, newBadge })
}

async function checkAndAwardBadges(userId: string): Promise<string | null> {
  const [profileRes, badgesRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('branch_id').eq('id', userId).single(),
    supabaseAdmin.from('badges').select('badge_type').eq('user_id', userId)
  ])

  const branchId = profileRes.data?.branch_id
  if (!branchId) return null

  const [lessonsRes, progressRes] = await Promise.all([
    supabaseAdmin.from('lessons').select('id').eq('branch_id', branchId).eq('is_published', true),
    supabaseAdmin.from('progress').select('lesson_id, tick1, tick2').eq('user_id', userId)
  ])

  const lessonIds = (lessonsRes.data ?? []).map(l => l.id)
  const total = lessonIds.length || 1
  if (lessonIds.length === 0) return null

  const progressRows = (progressRes.data ?? []).filter(p => lessonIds.includes(p.lesson_id))
  const tick1Count = progressRows.filter(p => p.tick1).length
  const tick2Count = progressRows.filter(p => p.tick2).length
  const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)

  const existing = new Set((badgesRes.data ?? []).map(b => b.badge_type))
  const thresholds = [
    { min: 25, type: 'bronze' },
    { min: 50, type: 'silver' },
    { min: 75, type: 'gold' },
    { min: 100, type: 'diamond' },
  ]

  const toAward = thresholds.filter(b => pct >= b.min)
  if (toAward.length > 0) {
    await Promise.all(toAward.map(b =>
      supabaseAdmin.from('badges').upsert(
        { user_id: userId, badge_type: b.type },
        { onConflict: 'user_id,badge_type' }
      )
    ))
  }

  const newBadge = thresholds.slice().reverse().find(b => pct >= b.min && !existing.has(b.type))
  return newBadge?.type ?? null
}