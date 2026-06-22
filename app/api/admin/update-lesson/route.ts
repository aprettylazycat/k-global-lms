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

  const body = await req.json()
  const { lessonId, title, branch_id, module_id, order_index, youtube_id, intro_text, practice_prompt, attachment_url, questions, is_published } = body

  if (!lessonId) {
    return NextResponse.json({ error: 'Thiếu lessonId' }, { status: 400 })
  }
  if (!title || !branch_id) {
    return NextResponse.json({ error: 'Thiếu tiêu đề hoặc nhánh' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .update({
      title,
      branch_id,
      module_id: module_id || null,
      order_index,
      youtube_id: youtube_id || null,
      intro_text: intro_text || null,
      practice_prompt: practice_prompt || null,
      attachment_url: attachment_url || null,
      questions: questions || [],
      ...(is_published !== undefined ? { is_published } : {})
    })
    .eq('id', lessonId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, lesson: data })
}