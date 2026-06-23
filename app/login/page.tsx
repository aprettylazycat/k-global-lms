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

    if (profile?.role === 'admin') {
      window.location.href = '/admin'
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAF8F4' }}>
      <div className="w-full max-w-sm">

        {/* Back về trang chủ */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-6"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: '15px' }} />
          Về trang chủ
        </button>

        <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">
          {/* Logo / tiêu đề */}
          <div className="mb-6">
            <h1 className="font-heading text-2xl font-bold text-stone-900 mb-1">Đăng nhập</h1>
            <p className="text-sm text-stone-500">Hệ thống đào tạo nội bộ K-Global</p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1.5 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                placeholder="email@k-global.vn"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-600 block mb-1.5 uppercase tracking-wide">
                Mật khẩu
              </label>
              <input
                type="password"
                className="w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
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
            className="w-full mt-5 bg-stone-900 text-white rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-stone-800 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang đăng nhập...
              </span>
            ) : 'Đăng nhập →'}
          </button>

          <p className="text-xs text-center text-stone-400 mt-5">
            Chưa có tài khoản?{' '}
            <a href="/register" className="text-stone-700 font-semibold hover:underline">Đăng ký ngay</a>
          </p>
        </div>
      </div>
    </div>
  )
}