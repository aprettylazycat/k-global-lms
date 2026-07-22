import { supabaseAdmin } from '@/lib/supabase-server'
import { verifyUser } from '@/lib/auth-server'
import { checkBadges } from '@/lib/badges'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (check.error) return check.error
  const userId = check.user.id

  const { lessonId } = await req.json()
  if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId' }, { status: 400 })

  // Xác nhận đúng là bài no_quiz — tránh bị gọi API này để tick khống bài có quiz thật
  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from('lessons').select('no_quiz').eq('id', lessonId).single()
  if (lessonError || !lesson) return NextResponse.json({ error: 'Không tìm thấy bài học' }, { status: 404 })
  if (!lesson.no_quiz) return NextResponse.json({ error: 'Bài này không phải dạng no_quiz' }, { status: 400 })

  // Đã hoàn thành từ trước → không ghi lại, giữ nguyên completed_at gốc
  const { data: existing } = await supabaseAdmin
    .from('progress').select('tick1, tick2')
    .eq('user_id', userId).eq('lesson_id', lessonId).maybeSingle()

  if (existing?.tick1 && existing?.tick2) {
    return NextResponse.json({ success: true, alreadyDone: true })
  }

  const { error } = await supabaseAdmin.from('progress').upsert(
    { user_id: userId, lesson_id: lessonId, tick1: true, tick2: true, completed_at: new Date().toISOString() },
    { onConflict: 'user_id,lesson_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bài no_quiz hoàn thành tại đây (không qua approve) → check badge luôn
  await checkBadges(userId)

  return NextResponse.json({ success: true })
}
