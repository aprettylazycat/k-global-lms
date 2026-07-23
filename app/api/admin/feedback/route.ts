import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth-server'

export async function GET(req: Request) {
  const check = await verifyAdmin(req)
  if (!check.ok) return check.error

  const { searchParams } = new URL(req.url)
  const moduleId = searchParams.get('module_id')
  const branchId = searchParams.get('branch_id')

  // ── Lấy theo NHÁNH: gộp feedback của mọi module thuộc nhánh ──
  if (branchId) {
    const { data: mods, error: modErr } = await supabaseAdmin
      .from('modules')
      .select('id, name, order_index')
      .eq('branch_id', branchId)
      .order('order_index', { ascending: true })

    if (modErr) return NextResponse.json({ error: modErr.message }, { status: 500 })
    if (!mods || mods.length === 0) return NextResponse.json({ responses: [], modules: [] })

    const { data, error } = await supabaseAdmin
      .from('module_feedback_responses')
      .select('*, question:module_feedback_questions(question_text, question_type), user:profiles(name, email)')
      .in('module_id', mods.map(m => m.id))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ responses: data ?? [], modules: mods })
  }

  // ── Lấy theo MODULE (giữ nguyên hành vi cũ) ──
  if (!moduleId) return NextResponse.json({ error: 'Thiếu module_id hoặc branch_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('module_feedback_responses')
    .select('*, question:module_feedback_questions(question_text, question_type), user:profiles(name, email)')
    .eq('module_id', moduleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ responses: data })
}