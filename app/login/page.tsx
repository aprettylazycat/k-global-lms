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

    // Lấy role từ profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user!.id)
      .single()

    console.log('profile:', profile, 'error:', profileError)

    console.log('Redirecting now, role:', profile?.role)
    if (profile?.role === 'admin') {
      window.location.href = '/admin'
    } else {
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-xl font-medium mb-1">Đăng nhập</h1>
        <p className="text-sm text-gray-500 mb-6">Hệ thống đào tạo nội bộ K-Global</p>

        <label className="text-xs text-gray-500 block mb-1">Email</label>
        <input
          type="email"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          placeholder="email@k-global.vn"
          value={form.email}
          onChange={e => setForm({...form, email: e.target.value})}
        />

        <label className="text-xs text-gray-500 block mb-1">Mật khẩu</label>
        <input
          type="password"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
          placeholder="••••••••"
          value={form.password}
          onChange={e => setForm({...form, password: e.target.value})}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập →'}
        </button>

        <p className="text-xs text-center text-gray-400 mt-4">
          Chưa có tài khoản?{' '}
          <a href="/register" className="text-gray-700 underline">Đăng ký</a>
        </p>
      </div>
    </div>
  )
}