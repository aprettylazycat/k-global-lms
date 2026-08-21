import { supabaseAdmin } from '@/lib/supabase-server'

// Trả về email(s) người chấm cho 1 học viên (theo userId), cùng tên học viên.
// Nhánh Leader: học viên chính là admin, nên ping thẳng tới toàn bộ super_admin.
// Nhánh khác: dùng leader_email đã gán riêng cho nhánh đó (bảng branches).
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
  if (branch?.slug === 'leader') {
    const { data: superAdmins } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')
    emails = (superAdmins || []).map((r: any) => r.email).filter(Boolean)
  } else if (branch?.leader_email) {
    emails = [branch.leader_email]
  }

  return { emails, learnerName: profile.name as string | null, error: null as string | null }
}