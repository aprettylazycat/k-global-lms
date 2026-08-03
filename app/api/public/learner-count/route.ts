import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Route public — chỉ trả về 1 con số tổng học viên, không lộ dữ liệu cá nhân nào.
// Dùng supabaseAdmin để bypass RLS, vì trang chủ có thể được xem khi chưa đăng nhập (anon).
// Chỉ tính tài khoản đã xác thực email — tránh đăng ký dở làm sai lệch con số.
export async function GET() {
  const { data: learnerProfiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .neq('role', 'super_admin')

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const learnerIds = new Set((learnerProfiles || []).map(p => p.id))
  let confirmedCount = 0
  let page = 1
  while (true) {
    const { data: userPage } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })
    if (!userPage || userPage.users.length === 0) break
    userPage.users.forEach(u => {
      if (u.email_confirmed_at && learnerIds.has(u.id)) confirmedCount++
    })
    if (userPage.users.length < 1000) break
    page++
  }

  return NextResponse.json({ count: confirmedCount })
}
