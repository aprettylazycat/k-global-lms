import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifyUser } from '@/lib/auth-server'

// Bất kỳ học viên nào đã đăng nhập cũng gọi được — chỉ trả về email người chấm
// của ĐÚNG nhánh của chính họ (không lộ thông tin nhánh khác).
// Dùng service role để tránh phụ thuộc RLS (học viên thường không có quyền
// đọc email của người khác trực tiếp qua client).
export async function GET(req: Request) {
  const check = await verifyUser(req)
  if (!check.ok) return check.error

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('name, branch_id')
    .eq('id', check.user.id)
    .single()

  if (profileError || !profile?.branch_id) {
    return NextResponse.json({ error: 'Không tìm thấy nhánh của bạn' }, { status: 404 })
  }

  const { data: branch } = await supabaseAdmin
    .from('branches')
    .select('slug, leader_email')
    .eq('id', profile.branch_id)
    .single()

  let emails: string[] = []

  // Nhánh Leader: học viên chính là các admin, nên ping thẳng tới super_admin
  if (branch?.slug === 'leader') {
    const { data: superAdmins } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')
    emails = (superAdmins || []).map((r: any) => r.email).filter(Boolean)
  } else if (branch?.leader_email) {
    emails = [branch.leader_email]
  }

  return NextResponse.json({ emails, learnerName: profile.name })
}