/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  // 1. Lấy access_token từ header Authorization
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 })
  }

  // 2. Verify token này thuộc về user nào
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 })
  }

  // 3. Kiểm tra user đó có role = admin trong bảng profiles không
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 })
  }

  // 4. Đã xác nhận admin → insert lesson bằng service role (bỏ qua RLS)
  const body = await req.json()
  const { title, branch_id, module_id, order_index, youtube_id, intro_text, practice_prompt, attachment_url, questions, is_published } = body

  if (!title || !branch_id) {
    return NextResponse.json({ error: 'Thiếu tiêu đề hoặc nhánh' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('lessons').insert({
    title,
    branch_id,
    module_id: module_id || null,
    order_index,
    youtube_id: youtube_id || null,
    intro_text: intro_text || null,
    practice_prompt: practice_prompt || null,
    questions: questions || [],
    attachment_url: attachment_url || null,
    is_published: is_published !== undefined ? is_published : true
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, lesson: data })
}