import { supabaseAdmin } from '@/lib/supabase-server'
import { verifyUser } from '@/lib/auth-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (check.error) return check.error
  const userId = check.user.id   // ← lấy từ token

  const { lessonId, answer_text, file_url } = await req.json()  // ← bỏ userId

  const { data: lesson } = await supabaseAdmin
    .from('lessons').select('no_quiz').eq('id', lessonId).single()

  if (lesson?.no_quiz) {
    return NextResponse.json({ error: 'Bài học này không yêu cầu nộp bài' }, { status: 400 })
  }

  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .insert({ user_id: userId, lesson_id: lessonId, answer_text, file_url, status: 'pending' })
    .select().single()

  // Ghi timestamp: practice_submitted_at
  await supabaseAdmin
    .from('lesson_timestamps')
    .update({ practice_submitted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)

  if (process.env.APPS_SCRIPT_WEBHOOK_URL) {
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('name, email').eq('id', userId).single()
    const { data: lesson } = await supabaseAdmin
      .from('lessons').select('title').eq('id', lessonId).single()
    await fetch(process.env.APPS_SCRIPT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submission?.id,
        user_name: profile?.name,
        user_email: profile?.email,
        lesson_title: lesson?.title,
        answer_text,
        file_url,
        submitted_at: new Date().toISOString()
      })
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
