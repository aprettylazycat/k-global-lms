import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 }) }

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) return { error: NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 }) }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (profileError || profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 }) }
  }

  return { user }
}

export async function GET(req: Request) {
  const check = await verifyAdmin(req)
  if (check.error) return check.error

  const { searchParams } = new URL(req.url)
  const moduleId = searchParams.get('module_id')
  if (!moduleId) return NextResponse.json({ error: 'Thiếu module_id' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('module_feedback_responses')
    .select('*, question:module_feedback_questions(question_text, question_type), user:profiles(name, email)')
    .eq('module_id', moduleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ responses: data })
}
