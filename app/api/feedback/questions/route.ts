import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const moduleId = searchParams.get('module_id')
  if (!moduleId) return NextResponse.json({ error: 'Thiếu module_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('module_feedback_questions')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ questions: data })
}
