// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    email, password, name, branch_id, position,
    onboarding_date, goal_after_onboarding, expectation
  } = body

  // Dùng admin.createUser để user được commit ngay vào auth.users
  // email_confirm: false → Supabase tự gửi email xác nhận qua SMTP đã cấu hình
  const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  if (!data.user) return NextResponse.json({ error: 'Không tạo được user' }, { status: 400 })

  // Insert profile — user đã tồn tại trong auth.users nên không bị lỗi FK
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