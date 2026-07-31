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
      user:profiles(name, email, branch_id),
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
const withBranch = filtered.map((s: any) => ({
  ...s,
  user: s.user ? { ...s.user, branch: branchById[s.user.branch_id] ?? null } : null,
}))

return NextResponse.json({ submissions: withBranch })
}
