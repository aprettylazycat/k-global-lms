/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Chỉ khởi tạo rate limiter nếu đã có biến môi trường Upstash — tránh crash site
// nếu chưa kịp cấu hình (vd lúc mới deploy lần đầu chưa thêm env vars).
const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
const redis = hasUpstash ? Redis.fromEnv() : null

// Giới hạn chung cho mọi API route: 30 request / 10 giây / IP
const generalLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '10 s'), prefix: 'ratelimit:general' })
  : null

// Giới hạn chặt hơn cho route đăng ký (dễ bị spam tạo tài khoản): 5 request / 10 phút / IP
const authLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '10 m'), prefix: 'ratelimit:auth' })
  : null

export async function proxy(req: NextRequest) {
    const path = req.nextUrl.pathname

  // Rate limiting — chỉ áp dụng cho API routes
  if (path.startsWith('/api/') && generalLimiter && authLimiter) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || '127.0.0.1'
    const limiter = path.startsWith('/api/auth/register') ? authLimiter : generalLimiter
    const { success, reset } = await limiter.limit(ip)
    if (!success) {
      return NextResponse.json(
        { error: 'Bạn đang gửi yêu cầu quá nhanh, vui lòng thử lại sau ít phút.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) } }
      )
    }
  }

  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: any }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  if (!session && (path.startsWith('/dashboard') || path.startsWith('/lesson') || path.startsWith('/admin'))) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && path.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/lesson/:path*', '/admin/:path*', '/api/:path*']
}