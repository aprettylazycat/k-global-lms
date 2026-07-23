import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth-server'

// Lấy toàn bộ câu hỏi (kể cả đã ẩn) theo module — dùng cho ModuleManager admin
export async function GET(req: Request) {
  const check = await verifyAdmin(req)
  if (!check.ok) return check.error

  const { searchParams } = new URL(req.url)
  const moduleId = searchParams.get('module_id')
  if (!moduleId) return NextResponse.json({ error: 'Thiếu module_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('module_feedback_questions')
    .select('*')
    .eq('module_id', moduleId)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data })
}

// Tạo câu hỏi mới
export async function POST(req: Request) {
  const check = await verifyAdmin(req)
  if (!check.ok) return check.error

  const { module_id, question_text, question_type, order_index } = await req.json()
  if (!module_id || !question_text?.trim()) {
    return NextResponse.json({ error: 'Thiếu module_id hoặc question_text' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('module_feedback_questions')
    .insert({
      module_id,
      question_text: question_text.trim(),
      question_type: question_type === 'text' ? 'text' : 'rating',
      order_index: order_index ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}

// Sửa câu hỏi — cũng dùng để soft-delete/khôi phục bằng is_active
export async function PUT(req: Request) {
  const check = await verifyAdmin(req)
  if (!check.ok) return check.error

  const { id, question_text, question_type, order_index, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (question_text !== undefined) update.question_text = question_text.trim()
  if (question_type !== undefined) update.question_type = question_type === 'text' ? 'text' : 'rating'
  if (order_index !== undefined) update.order_index = order_index
  if (is_active !== undefined) update.is_active = is_active

  const { data, error } = await supabaseAdmin
    .from('module_feedback_questions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ question: data })
}