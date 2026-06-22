/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 })
  }

  const { lessonId } = await req.json()
  if (!lessonId) {
    return NextResponse.json({ error: 'Thiếu lessonId' }, { status: 400 })
  }

  // Xóa dữ liệu liên quan trước (progress, submissions) để tránh rác mồ côi
  const { error: progressError } = await supabaseAdmin
    .from('progress')
    .delete()
    .eq('lesson_id', lessonId)

  if (progressError) {
    return NextResponse.json({ error: `Lỗi xóa progress: ${progressError.message}` }, { status: 500 })
  }

  const { error: submissionsError } = await supabaseAdmin
    .from('submissions')
    .delete()
    .eq('lesson_id', lessonId)

  if (submissionsError) {
    return NextResponse.json({ error: `Lỗi xóa submissions: ${submissionsError.message}` }, { status: 500 })
  }

  const { error: lessonError } = await supabaseAdmin
    .from('lessons')
    .delete()
    .eq('id', lessonId)

  if (lessonError) {
    return NextResponse.json({ error: `Lỗi xóa bài học: ${lessonError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}