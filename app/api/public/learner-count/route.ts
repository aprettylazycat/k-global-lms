import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Route public — chỉ trả về 1 con số tổng học viên, không lộ dữ liệu cá nhân nào.
// Dùng supabaseAdmin để bypass RLS, vì trang chủ có thể được xem khi chưa đăng nhập (anon).
export async function GET() {
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'learner')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: count ?? 0 })
}
