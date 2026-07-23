import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function verifyUser(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 }) }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 }) }

  return { user }
}

export async function verifyAdmin(req: Request) {
  const check = await verifyUser(req)
  if (check.error) return check

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', check.user!.id).single()

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 }) }
  }

  return { user: check.user }
}