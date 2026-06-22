'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types'

function branchIcon(slug: string) {
  if (slug === 'k-embroidery') return 'ti-needle'
  if (slug === 'lotus-smock') return 'ti-flower'
  return 'ti-scissors' // hair
}

function branchDesc(slug: string) {
  if (slug === 'k-embroidery') return 'Thêu tay, OEM'
  if (slug === 'lotus-smock') return 'Smock, đầm trẻ em'
  return 'Tóc, xuất khẩu, B2B'
}

export default function RegisterPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    position: '',
    onboarding_date: '',
    mentor_name: '',
    goal_after_onboarding: '',
    expectation: '',
  })
  const [committed, setCommitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('branches').select('*').then(({ data }) => {
      if (data) setBranches(data)
    })
  }, [])

  async function handleRegister() {
    if (!selectedBranch) { setError('Vui lòng chọn nhánh đào tạo'); return }
    if (!form.name || !form.email || !form.password) { setError('Vui lòng điền đầy đủ thông tin tài khoản'); return }
    if (!form.position || !form.onboarding_date || !form.mentor_name || !form.goal_after_onboarding || !form.expectation) {
      setError('Vui lòng điền đầy đủ thông tin onboarding')
      return
    }
    if (!committed) { setError('Vui lòng xác nhận cam kết onboarding trước khi tạo tài khoản'); return }

    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (authError) { setError(authError.message || 'Đã có lỗi xảy ra'); setLoading(false); return }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user!.id,
      name: form.name,
      email: form.email,
      role: 'learner',
      branch_id: selectedBranch,
      position: form.position,
      onboarding_date: form.onboarding_date,
      mentor_name: form.mentor_name,
      goal_after_onboarding: form.goal_after_onboarding,
      expectation: form.expectation,
    })

    if (profileError) { setError(profileError.message || 'Không thể lưu hồ sơ'); setLoading(false); return }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 p-8">
        <h1 className="text-xl font-medium mb-1">Tạo tài khoản</h1>
        <p className="text-sm text-gray-500 mb-6">Hệ thống đào tạo nội bộ K-Global</p>

        <label className="text-xs text-gray-500 block mb-1">Họ và tên</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          placeholder="Nguyễn Văn A"
          value={form.name}
          onChange={e => setForm({...form, name: e.target.value})}
        />

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
          className="w-full border rounded-lg px-3 py-2 text-sm mb-6"
          placeholder="••••••••"
          value={form.password}
          onChange={e => setForm({...form, password: e.target.value})}
        />

        <p className="text-xs text-gray-500 mb-3">Chọn nhánh đào tạo của bạn:</p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {branches.map(b => {
            const isSelected = selectedBranch === b.id
            return (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className={`relative border-2 rounded-2xl p-3 text-left transition-all ${
                  isSelected ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                style={isSelected ? { backgroundColor: b.color_bg } : undefined}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                    <i className="ti ti-check" style={{fontSize:'12px', color: b.color_text}}></i>
                  </span>
                )}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                  style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.5)' : b.color_bg }}
                >
                  <i className={`ti ${branchIcon(b.slug)} text-xl`} style={{ color: b.color_text }}></i>
                </div>
                <p className="font-medium text-xs mb-0.5" style={isSelected ? { color: b.color_text } : { color: '#111827' }}>
                  {b.name}
                </p>
                <p className="text-[11px] text-gray-400">
                  {branchDesc(b.slug)}
                </p>
              </button>
            )
          })}
        </div>

        <div className="border-t border-gray-100 pt-5 mb-5">
          <p className="text-xs text-gray-500 mb-3">Thông tin onboarding</p>

          <label className="text-xs text-gray-500 block mb-1">Vị trí</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            placeholder="Ví dụ: Nhân viên SEO"
            value={form.position}
            onChange={e => setForm({...form, position: e.target.value})}
          />

          <label className="text-xs text-gray-500 block mb-1">Ngày OB</label>
          <input
            type="date"
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            value={form.onboarding_date}
            onChange={e => setForm({...form, onboarding_date: e.target.value})}
          />

          <label className="text-xs text-gray-500 block mb-1">Leader/Mentor/Người phụ trách</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            placeholder="Tên người phụ trách bạn"
            value={form.mentor_name}
            onChange={e => setForm({...form, mentor_name: e.target.value})}
          />

          <label className="text-xs text-gray-500 block mb-1">Mục tiêu sau Onboarding</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
            rows={2}
            placeholder="Bạn mong muốn đạt được điều gì sau khi onboarding?"
            value={form.goal_after_onboarding}
            onChange={e => setForm({...form, goal_after_onboarding: e.target.value})}
          />

          <label className="text-xs text-gray-500 block mb-1">Kỳ vọng với lộ trình đào tạo này</label>
          <textarea
            className="w-full border rounded-lg px-3 py-2 text-sm mb-1"
            rows={2}
            placeholder="Bạn kỳ vọng gì ở lộ trình đào tạo?"
            value={form.expectation}
            onChange={e => setForm({...form, expectation: e.target.value})}
          />
        </div>

        <label className="flex items-start gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={committed}
            onChange={e => setCommitted(e.target.checked)}
          />
          <span className="text-xs text-gray-600">
            Tôi xác nhận đã sẵn sàng bắt đầu hành trình onboarding và cam kết hoàn thành đầy đủ các bài học, bài kiểm tra và bài tập thực hành theo lộ trình.
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
        )}

        <button
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Đang tạo...' : 'Tạo tài khoản →'}
        </button>

        <p className="text-xs text-center text-gray-400 mt-4">
          Đã có tài khoản?{' '}
          <a href="/login" className="text-gray-700 underline">Đăng nhập</a>
        </p>
      </div>
    </div>
  )
}