import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { lessonId, userId, answer_text, file_url } = await req.json()

  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .insert({ user_id: userId, lesson_id: lessonId, answer_text, file_url, status: 'pending' })
    .select().single()

  // Ghi timestamp: practice_submitted_at
  await supabaseAdmin
    .from('lesson_timestamps')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      practice_submitted_at: new Date().toISOString()
    }, { onConflict: 'user_id,lesson_id' })

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