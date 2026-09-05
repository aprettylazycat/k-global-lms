import { supabaseAdmin } from '@/lib/supabase-server'

// Email này luôn nhận thông báo Ping từ HỌC VIÊN Ở MỌI NHÁNH, không phụ thuộc
// leader_email đã gán riêng cho từng nhánh. Muốn đổi/thêm người nhận toàn hệ
// thống, sửa mảng này (cách nhau bằng dấu phẩy nếu thêm nhiều email).
const GLOBAL_CC_EMAILS = ['tonynguyenhoanghai@gmail.com']

// Trả về email(s) người chấm cho 1 học viên (theo userId), cùng tên học viên.
// Ưu tiên leader_email của nhánh (hỗ trợ nhiều email, cách nhau bằng dấu phẩy).
// Riêng nhánh Leader: nếu CHƯA gán leader_email thì tự fallback sang toàn bộ
// super_admin trong hệ thống (vì học viên nhánh Leader chính là các admin).
// Ngoài ra, GLOBAL_CC_EMAILS luôn được thêm vào bất kể nhánh nào.
export async function resolvePingRecipients(userId: string) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('name, branch_id, position')
    .eq('id', userId)
    .single()

  if (profileError || !profile?.branch_id) {
    return { emails: [] as string[], learnerName: null as string | null, learnerPosition: null as string | null, branchName: null as string | null, error: 'Không tìm thấy nhánh của bạn' }
  }

  const { data: branch } = await supabaseAdmin
    .from('branches')
    .select('slug, name, leader_email')
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

  // Gộp thêm GLOBAL_CC_EMAILS, loại trùng (không phân biệt hoa/thường)
  const existingLower = new Set(emails.map(e => e.toLowerCase()))
  GLOBAL_CC_EMAILS.forEach(cc => {
    if (!existingLower.has(cc.toLowerCase())) emails.push(cc)
  })

  return {
    emails,
    learnerName: profile.name as string | null,
    learnerPosition: (profile as any).position as string | null,
    branchName: branch?.name ?? null,
    error: null as string | null,
  }
}
