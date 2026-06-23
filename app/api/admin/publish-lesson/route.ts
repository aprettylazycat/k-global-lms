import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) return NextResponse.json({ error: 'Thiếu token' }, { status: 401 })

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) return NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 })

  const { lessonId, publish } = await req.json()
  if (!lessonId) return NextResponse.json({ error: 'Thiếu lessonId' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('lessons')
    .update({ is_published: publish })
    .eq('id', lessonId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}