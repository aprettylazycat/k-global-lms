'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (authError) {
      setError('Email hoặc mật khẩu không đúng')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user!.id)
      .single()

    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
      window.location.href = '/admin'
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#070B15', color: '#EEF3FB' }}>
      <div className="w-full max-w-sm">

        {/* Back về trang chủ */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-[#8FA9C6] hover:text-[#FFC94D] transition-colors mb-6"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: '15px' }} />
          Về trang chủ
        </button>

        <div className="bg-[#0E1526] rounded-3xl border border-[#22304C] p-8 shadow-sm">
          {/* Logo / tiêu đề */}
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-bold text-[#EEF3FB] mb-1">Đăng nhập</h1>
            <p className="text-sm text-[#8FA9C6]">Hệ thống đào tạo nội bộ K-Global</p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#C6D5E8] block mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                className="w-full border border-[#22304C] rounded-xl px-4 py-2.5 text-sm text-[#EEF3FB] placeholder:text-[#5F7796] focus:outline-none focus:border-[rgba(255,201,77,0.5)] transition-colors"
                placeholder="email@k-global.vn"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#C6D5E8] block mb-1.5 uppercase tracking-wide">
                Mật khẩu
              </label>
              <input
                type="password"
                className="w-full border border-[#22304C] rounded-xl px-4 py-2.5 text-sm text-[#EEF3FB] placeholder:text-[#5F7796] focus:outline-none focus:border-[rgba(255,201,77,0.5)] transition-colors"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl px-4 py-3 mt-4 border border-red-100">
              <i className="ti ti-alert-circle flex-shrink-0" style={{ fontSize: '14px' }} />
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full mt-5 bg-[#FFC94D] text-[#0A0E1A] rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-[#FFD76B] transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang đăng nhập...
              </span>
            ) : 'Đăng nhập →'}
          </button>

          <p className="text-xs text-center text-[#8FA9C6] mt-5">
            Chưa có tài khoản?{' '}
            <a href="/register" className="text-[#FFC94D] font-semibold hover:underline">Đăng ký ngay</a>
          </p>
        </div>
      </div>
    </div>
  )
}