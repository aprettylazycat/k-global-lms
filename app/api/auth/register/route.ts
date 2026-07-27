import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createClient } from '@supabase/supabase-js'

// Lấy IP thật của người dùng từ header mà Vercel gắn vào (đáng tin cậy, không phải client tự khai)
function getClientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, password, name, branch_id, position, onboarding_date, goal_after_onboarding, expectation } = body
  const clientIp = getClientIp(req)

  // Dùng SERVICE ROLE KEY (secret) + header Sb-Forwarded-For để Supabase
  // tính rate-limit theo đúng IP người dùng thật, không phải IP server Vercel.
  // Yêu cầu: đã bật "Enable IP address forwarding" trong Supabase Dashboard > Auth > Rate Limits.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        headers: clientIp ? { 'Sb-Forwarded-For': clientIp } : {},
      },
    }
  )

  // Kiểm tra trước: profile với email này đã tồn tại chưa (tránh insert lỗi duplicate key khó hiểu)
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    return NextResponse.json(
      { error: 'ALREADY_REGISTERED', message: 'Email này đã đăng ký trước đó. Nếu chưa nhận được email xác nhận, hãy dùng nút "Gửi lại email xác nhận" thay vì đăng ký lại.' },
      { status: 409 }
    )
  }

  const { data, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // TODO: xác nhận đúng domain production hiện tại rồi thay vào đây
      emailRedirectTo: 'https://lms.k-global.org/dashboard'
    }
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  if (!data.user) return NextResponse.json({ error: 'Không tạo được user' }, { status: 400 })

  const isExistingUnconfirmedUser = data.user.identities && data.user.identities.length === 0
  if (isExistingUnconfirmedUser) {
    return NextResponse.json(
      { error: 'ALREADY_REGISTERED', message: 'Email này đã đăng ký trước đó nhưng chưa xác nhận. Vui lòng kiểm tra email (kể cả thư rác) hoặc dùng nút "Gửi lại email xác nhận".' },
      { status: 409 }
    )
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: data.user.id,
    name,
    email,
    role: 'learner',
    branch_id,
    position,
    onboarding_date,
    goal_after_onboarding,
    expectation,
  }, { onConflict: 'id' })

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}