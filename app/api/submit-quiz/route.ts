import { supabaseAdmin } from '@/lib/supabase-server'
import { verifyUser } from '@/lib/auth-server'
import { checkBadges } from '@/lib/badges'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (check.error) return check.error
  const userId = check.user.id   // ← lấy từ token, KHÔNG lấy từ body nữa

  const { lessonId, answers, attempts, tfAnswers, tfQuestions } = await req.json()

  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from('lessons').select('questions, practice_prompt').eq('id', lessonId).single()

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

  const allCorrect = mcqAllCorrect  // TF chỉ lưu data, không block progress

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

  const hasEssay = (lesson.questions || []).some((q: any) => q.type === 'essay' && q.question?.trim())
  const noPractice = !((lesson.practice_prompt ?? '').trim()) && !hasEssay

  if (!allCorrect) {
    return NextResponse.json({ success: true, allCorrect, results, newBadge: null })
  }

  // Ghi progress + timestamp
  await Promise.all([
  supabaseAdmin.from('progress').upsert(
    noPractice
      ? { user_id: userId, lesson_id: lessonId, tick1: true, tick2: true, completed_at: new Date().toISOString() }
      : { user_id: userId, lesson_id: lessonId, tick1: true },
    { onConflict: 'user_id,lesson_id' }
  ).then(),
  supabaseAdmin.from('lesson_timestamps').upsert(   // ← thiếu đoạn này
    { user_id: userId, lesson_id: lessonId, quiz_completed_at: new Date().toISOString() },
    { onConflict: 'user_id,lesson_id' }
  ).then(),
])

  // Bài không có thực hành → tick2 đã set ở trên mà không qua admin approve,
  // nên phải check badge tại đây — nếu không, bài noPractice chốt module sẽ không trao badge
  if (noPractice) {
    await checkBadges(userId)
  }

  return NextResponse.json({ success: true, allCorrect, results, newBadge: null })
}
