/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực' }, { status: 401 })
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

  if (profileError || (profile?.role !== 'admin' && profile?.role !== 'super_admin')) {
    return NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 })
  }

const { data, error } = await supabaseAdmin
    .from('submissions')
    .select(`
      id, user_id, lesson_id, answer_text, file_url, submitted_at, status,
      user:profiles(name, email, branch_id, avatar_url),
      lesson:lessons(title, no_quiz, practice_prompt)
    `)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}

// Lọc bỏ submissions của bài no_quiz (rác lịch sử, không cần duyệt)
const filtered = (data || []).filter((s: any) => !s.lesson?.no_quiz)

// Tra tên nhánh riêng (không dùng nested embed vì cần FK constraint mà DB có thể chưa khai báo chính thức)
const { data: branches } = await supabaseAdmin.from('branches').select('id, name, slug')
const branchById = Object.fromEntries((branches || []).map(b => [b.id, b]))

// Với bài đang chờ duyệt mà là NỘP LẠI sau khi bị từ chối, tìm lý do từ chối lần gần nhất
// để admin không phải nhớ lại tại sao đã từ chối trước đó
const pairKeys = filtered.map((s: any) => `${s.user_id}__${s.lesson_id}`)
let priorRejections: any[] = []
if (pairKeys.length > 0) {
  const { data: rejectedSubs } = await supabaseAdmin
    .from('submissions')
    .select('user_id, lesson_id, reject_reason, reviewed_at, attempt_number')
    .not('reject_reason', 'is', null)
    .order('attempt_number', { ascending: false })
  priorRejections = rejectedSubs || []
}
const latestRejectionByPair: Record<string, { reason: string | null; reviewedAt: string | null }> = {}
priorRejections.forEach((r: any) => {
  const key = `${r.user_id}__${r.lesson_id}`
  if (!latestRejectionByPair[key]) {
    latestRejectionByPair[key] = { reason: r.reject_reason, reviewedAt: r.reviewed_at }
  }
})

const withBranch = filtered.map((s: any) => {
  const key = `${s.user_id}__${s.lesson_id}`
  return {
    ...s,
    user: s.user ? { ...s.user, branch: branchById[s.user.branch_id] ?? null } : null,
    priorRejectReason: latestRejectionByPair[key]?.reason ?? null,
  }
})

return NextResponse.json({ submissions: withBranch })
}
