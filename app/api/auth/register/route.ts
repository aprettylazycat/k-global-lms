import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password, name, branch_id, position, onboarding_date, goal_after_onboarding, expectation } = body

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // signUp gửi email xác nhận tự động qua SMTP đã cấu hình
  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://k-global-lms.vercel.app/dashboard'
    }
  })

  if (authError) return NextResponse.json({ error: authError.message || JSON.stringify(authError) }, { status: 400 })
  if (!data.user) return NextResponse.json({ error: 'Không tạo được user' }, { status: 400 })

  // Insert profile bằng admin để bypass RLS
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