import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password, name, branch_id, position, onboarding_date, goal_after_onboarding, expectation } = body

  // Tạo user bằng admin — bypass email confirmation, user tồn tại ngay
  const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false, // vẫn gửi email xác nhận nhưng user đã tồn tại trong auth.users
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Insert profile — user đã tồn tại nên không bị foreign key lỗi
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: data.user.id,
    name,
    email,
    role: 'learner',
    branch_id,
    position,
    onboarding_date,
    goal_after_onboarding,
    expectation,
  })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}