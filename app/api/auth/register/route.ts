import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password, name, branch_id, position, onboarding_date, goal_after_onboarding, expectation } = body

  // Tạo user — email_confirm: false để user tồn tại ngay trong auth.users
  const { data, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // Insert profile
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

  // Gửi email xác nhận thủ công
  const { error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
  })

  if (linkError) console.error('Không gửi được email xác nhận:', linkError.message)

  return NextResponse.json({ ok: true })
}