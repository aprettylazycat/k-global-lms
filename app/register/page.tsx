'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types'

function branchIcon(slug: string) {
  if (slug === 'k-embroidery') return 'ti-needle'
  if (slug === 'lotus-smock') return 'ti-flower'
  return 'ti-scissors'
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
      setError('Vui lòng điền đầy đủ thông tin onboarding'); return
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

    router.push('/verify-email')
  }

  const inputClass = "w-full border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
  const labelClass = "text-xs font-semibold text-stone-600 block mb-1.5 uppercase tracking-wide"

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: '#FAF8F4' }}>
      <div className="w-full max-w-md">

        {/* Back về trang chủ */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors mb-6"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: '15px' }} />
          Về trang chủ
        </button>

        <div className="bg-white rounded-3xl border border-stone-200 p-8 shadow-sm">

          {/* Tiêu đề */}
          <div className="mb-7">
            <h1 className="font-heading text-2xl font-bold text-stone-900 mb-1">Tạo tài khoản</h1>
            <p className="text-sm text-stone-500">Hệ thống đào tạo nội bộ K-Global</p>
          </div>

          {/* ── PHẦN 1: Thông tin tài khoản ── */}
          <div className="mb-6">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Thông tin tài khoản</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Họ và tên</label>
                <input className={inputClass} placeholder="Nguyễn Văn A"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} placeholder="email@k-global.vn"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Mật khẩu</label>
                <input type="password" className={inputClass} placeholder="••••••••"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
            </div>
          </div>

          {/* ── PHẦN 2: Chọn nhánh ── */}
          <div className="mb-6">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Nhánh đào tạo</p>
            <div className="grid grid-cols-3 gap-2">
              {branches.map(b => {
                const isSelected = selectedBranch === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBranch(b.id)}
                    className={`relative border-2 rounded-2xl p-3 text-left transition-all ${
                      isSelected ? 'border-stone-700' : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                    style={isSelected ? { backgroundColor: b.color_bg } : undefined}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <i className="ti ti-check" style={{ fontSize: '11px', color: b.color_text }} />
                      </span>
                    )}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.5)' : b.color_bg }}>
                      <i className={`ti ${branchIcon(b.slug)} text-xl`} style={{ color: b.color_text }} />
                    </div>
                    <p className="font-semibold text-xs mb-0.5"
                      style={{ color: isSelected ? b.color_text : '#1C1917' }}>
                      {b.name}
                    </p>
                    <p className="text-[11px]" style={{ color: isSelected ? b.color_text : '#78716C', opacity: isSelected ? 0.8 : 1 }}>
                      {branchDesc(b.slug)}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── PHẦN 3: Thông tin onboarding ── */}
          <div className="border-t border-stone-100 pt-6 mb-6">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Thông tin onboarding</p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Vị trí</label>
                <input className={inputClass} placeholder="Ví dụ: Nhân viên SEO"
                  value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Ngày onboarding</label>
                <input type="date" className={inputClass}
                  value={form.onboarding_date} onChange={e => setForm({ ...form, onboarding_date: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Leader / Mentor / Người phụ trách</label>
                <input className={inputClass} placeholder="Tên người phụ trách bạn"
                  value={form.mentor_name} onChange={e => setForm({ ...form, mentor_name: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Mục tiêu sau Onboarding</label>
                <textarea className={`${inputClass} resize-none`} rows={2}
                  placeholder="Bạn mong muốn đạt được điều gì sau khi onboarding?"
                  value={form.goal_after_onboarding} onChange={e => setForm({ ...form, goal_after_onboarding: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Kỳ vọng với lộ trình đào tạo</label>
                <textarea className={`${inputClass} resize-none`} rows={2}
                  placeholder="Bạn kỳ vọng gì ở lộ trình đào tạo?"
                  value={form.expectation} onChange={e => setForm({ ...form, expectation: e.target.value })} />
              </div>
            </div>
          </div>

          {/* ── Checkbox cam kết ── */}
          <label className="flex items-start gap-3 mb-6 cursor-pointer group">
            <div className="relative mt-0.5 flex-shrink-0">
              <input type="checkbox" className="sr-only"
                checked={committed} onChange={e => setCommitted(e.target.checked)} />
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                committed ? 'bg-stone-800 border-stone-800' : 'border-stone-300 group-hover:border-stone-500'
              }`}>
                {committed && <i className="ti ti-check text-white" style={{ fontSize: '10px' }} />}
              </div>
            </div>
            <span className="text-xs text-stone-600 leading-relaxed">
              Tôi xác nhận đã sẵn sàng bắt đầu hành trình onboarding và cam kết hoàn thành đầy đủ các bài học, bài kiểm tra và bài tập thực hành theo lộ trình.
            </span>
          </label>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl px-4 py-3 mb-4 border border-red-100">
              <i className="ti ti-alert-circle flex-shrink-0" style={{ fontSize: '14px' }} />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleRegister}
            disabled={loading}
            className="w-full bg-stone-900 text-white rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-stone-800 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang tạo tài khoản...
              </span>
            ) : 'Tạo tài khoản →'}
          </button>

          <p className="text-xs text-center text-stone-400 mt-5">
            Đã có tài khoản?{' '}
            <a href="/login" className="text-stone-700 font-semibold hover:underline">Đăng nhập</a>
          </p>
        </div>
      </div>
    </div>
  )
}