/* eslint-disable @typescript-eslint/no-explicit-any */
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

// Tạo module mới
export async function POST(req: Request) {
  const check = await verifyAdmin(req)
  if (check.error) return check.error

  const body = await req.json()
  const { branch_id, name, description, order_index } = body

  if (!branch_id || !name) {
    return NextResponse.json({ error: 'Thiếu branch_id hoặc name' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('modules')
    .insert({
      branch_id,
      name,
      description: description ?? null,
      order_index: order_index ?? 1,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ module: data })
}

// Sửa module
export async function PUT(req: Request) {
  const check = await verifyAdmin(req)
  if (check.error) return check.error

  const body = await req.json()
  const { id, name, description, order_index } = body

  if (!id || !name) {
    return NextResponse.json({ error: 'Thiếu id hoặc name' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('modules')
    .update({
      name,
      description: description ?? null,
      order_index: order_index ?? 1,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ module: data })
}

// Xóa module — chỉ cho phép nếu không còn bài học nào thuộc module này
export async function DELETE(req: Request) {
  const check = await verifyAdmin(req)
  if (check.error) return check.error

  const body = await req.json()
  const { id } = body

  if (!id) {
    return NextResponse.json({ error: 'Thiếu id' }, { status: 400 })
  }

  const { count, error: countError } = await supabaseAdmin
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .eq('module_id', id)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Module này còn ${count} bài học. Vui lòng chuyển hoặc xóa các bài học trước khi xóa module.` },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin.from('modules').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}