/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lessonId = searchParams.get('id')

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 })
  }
  if (!lessonId) {
    return NextResponse.json({ error: 'Thiếu id bài học' }, { status: 400 })
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

  const { data, error } = await supabaseAdmin
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ lesson: data })
}