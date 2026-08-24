import { supabaseAdmin } from '@/lib/supabase-server'

// Trả về email(s) người chấm cho 1 học viên (theo userId), cùng tên học viên.
// Ưu tiên leader_email của nhánh (hỗ trợ nhiều email, cách nhau bằng dấu phẩy).
// Riêng nhánh Leader: nếu CHƯA gán leader_email thì tự fallback sang toàn bộ
// super_admin trong hệ thống (vì học viên nhánh Leader chính là các admin).
export async function resolvePingRecipients(userId: string) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('name, branch_id')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.branch_id) {
    return { emails: [] as string[], learnerName: null as string | null, error: 'Không tìm thấy nhánh của bạn' }
  }

  const { data: branch } = await supabaseAdmin
    .from('branches')
    .select('slug, leader_email')
    .eq('id', profile.branch_id)
    .single()

  let emails: string[] = []
  if (branch?.leader_email) {
    emails = branch.leader_email.split(',').map((e: string) => e.trim()).filter(Boolean)
  } else if (branch?.slug === 'leader') {
    const { data: superAdmins } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')
    emails = (superAdmins || []).map((r: any) => r.email).filter(Boolean)
  }

  return { emails, learnerName: profile.name as string | null, error: null as string | null }
}
