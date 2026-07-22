import { supabaseAdmin } from '@/lib/supabase-server'
import { verifyUser } from '@/lib/auth-server'
import { checkBadges } from '@/lib/badges'
import { NextResponse } from 'next/server'

/**
 * Đóng bài KHÔNG CÓ PHẦN THỰC HÀNH (không practice_prompt, không câu essay).
 *
 * Dùng cho trường hợp học viên đã làm xong quiz (tick1 = true) từ trước,
 * sau đó admin xoá phần thực hành khỏi bài → bài trở thành noPractice nhưng
 * tick2 không bao giờ được set, khiến bài kẹt ở trạng thái "đang học" vĩnh viễn.
 */
export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (check.error) return check.error
  const userId = check.user.id

  const { lessonId } = await req.json()
  if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId' }, { status: 400 })

  // Xác minh phía server đúng là bài không có thực hành — tránh tick khống
  const { data: lesson, error: lessonError } = await supabaseAdmin
    .from('lessons')
    .select('practice_prompt, questions')
    .eq('id', lessonId)
    .single()

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Không tìm thấy bài học' }, { status: 404 })
  }

  const hasEssay = ((lesson.questions as any[]) || [])
    .some((q: any) => q.type === 'essay' && q.question?.trim())
  const noPractice = !((lesson.practice_prompt ?? '').trim()) && !hasEssay

  if (!noPractice) {
    return NextResponse.json({ error: 'Bài này có phần thực hành' }, { status: 400 })
  }

  // Bắt buộc đã làm xong quiz trước đó — không cho nhảy cóc
  const { data: existing } = await supabaseAdmin
    .from('progress')
    .select('tick1, tick2')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle()

  if (!existing?.tick1) {
    return NextResponse.json({ error: 'Chưa hoàn thành bài kiểm tra' }, { status: 400 })
  }

  if (existing.tick2) {
    return NextResponse.json({ success: true, alreadyDone: true })
  }

  const { error } = await supabaseAdmin.from('progress').upsert(
    { user_id: userId, lesson_id: lessonId, tick1: true, tick2: true, completed_at: new Date().toISOString() },
    { onConflict: 'user_id,lesson_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await checkBadges(userId)

  return NextResponse.json({ success: true })
}
