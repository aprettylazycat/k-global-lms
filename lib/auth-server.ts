import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

type AuthResult =
  | { ok: false; error: NextResponse }
  | { ok: true; user: User }

export async function verifyUser(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return { ok: false, error: NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 }) }
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) {
    return { ok: false, error: NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 }) }
  }

  return { ok: true, user }
}

export async function verifyAdmin(req: Request): Promise<AuthResult> {
  const check = await verifyUser(req)
  if (!check.ok) return check

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', check.user.id).single()

  // super_admin có mọi quyền của admin thường (bao gồm chấm bài)
  if (profile?.role !== 'admin' && profile?.role !== 'super_admin') {
    return { ok: false, error: NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 }) }
  }

  return { ok: true, user: check.user }
}

// Chỉ dành riêng cho super_admin — dùng cho các chức năng nhạy cảm hơn admin thường,
// ví dụ xem được ai (admin nào) đã chấm bài của học viên.
export async function verifySuperAdmin(req: Request): Promise<AuthResult> {
  const check = await verifyUser(req)
  if (!check.ok) return check

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', check.user.id).single()

  if (profile?.role !== 'super_admin') {
    return { ok: false, error: NextResponse.json({ error: 'Chỉ super admin mới xem được mục này' }, { status: 403 }) }
  }

  return { ok: true, user: check.user }
}