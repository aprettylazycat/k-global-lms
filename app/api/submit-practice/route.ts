import { supabaseAdmin } from '@/lib/supabase-server'
import { verifyUser } from '@/lib/auth-server'
import { deleteSubmissionFile } from '@/lib/storage-utils'
import { NextResponse } from 'next/server'

const MAX_ATTEMPTS = 3

export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (!check.ok) return check.error
  const userId = check.user.id

  const { lessonId, answer_text, file_url } = await req.json()

  const { data: lesson } = await supabaseAdmin
    .from('lessons').select('no_quiz').eq('id', lessonId).single()

  if (lesson?.no_quiz) {
    return NextResponse.json({ error: 'Bài học này không yêu cầu nộp bài' }, { status: 400 })
  }

  // Nếu admin đã từng từ chối và cấp lại lượt (attempt_reset_at), chỉ tính các lần nộp SAU mốc đó
  const { data: progressRow } = await supabaseAdmin
    .from('progress')
    .select('attempt_reset_at')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle()
  const resetAt = progressRow?.attempt_reset_at ?? null

  // Lấy toàn bộ lịch sử nộp bài của user cho bài này — kể cả bản đã duyệt/từ chối/thay thế
  const { data: allSubmissions } = await supabaseAdmin
    .from('submissions')
    .select('id, attempt_number, status, file_url, submitted_at')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .order('attempt_number', { ascending: false })

  // previousSubmissions dùng để xoá file cũ (toàn bộ lịch sử) — attemptsUsed thì chỉ tính từ mốc reset
  const previousSubmissions = allSubmissions
  const countedSubmissions = resetAt
    ? (allSubmissions || []).filter(s => s.submitted_at && s.submitted_at > resetAt)
    : (allSubmissions || [])
  const attemptsUsed = countedSubmissions.length

  if (attemptsUsed >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Ban da dung het 3 luot nop bai cho bai hoc nay' }, { status: 400 })
  }

  const nextAttempt = attemptsUsed + 1

  if (previousSubmissions && previousSubmissions.length > 0) {
    await supabaseAdmin
      .from('submissions')
      .update({ status: 'superseded' })
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .in('status', ['pending', 'approved', 'rejected'])

    for (const prev of previousSubmissions) {
      if (prev.file_url) await deleteSubmissionFile(prev.file_url)
    }
  }

  await supabaseAdmin
    .from('progress')
    .update({ tick2: false, perfect_score: false })
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)

  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .insert({
      user_id: userId,
      lesson_id: lessonId,
      answer_text,
      file_url,
      status: 'pending',
      attempt_number: nextAttempt,
    })
    .select().single()

  await supabaseAdmin
    .from('lesson_timestamps')
    .update({ practice_submitted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)

  if (process.env.APPS_SCRIPT_WEBHOOK_URL) {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('name, email').eq('id', userId).single()
    const { data: lessonInfo } = await supabaseAdmin
      .from('lessons').select('title').eq('id', lessonId).single()
    await fetch(process.env.APPS_SCRIPT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submission?.id,
        user_name: profile?.name,
        user_email: profile?.email,
        lesson_title: lessonInfo?.title,
        answer_text,
        file_url,
        attempt_number: nextAttempt,
        submitted_at: new Date().toISOString()
      })
    }).catch(() => {})
  }

  return NextResponse.json({ success: true, attemptNumber: nextAttempt, attemptsRemaining: MAX_ATTEMPTS - nextAttempt })
}