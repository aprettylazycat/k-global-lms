'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types'


// Màu nhánh trong DB là pastel sáng (dùng cho theme sáng cũ).
// Trên nền tối: làm sáng màu chữ để dùng làm màu nhấn, và tint nền rất mờ.
function neonize(hex: string | null | undefined): string {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return '#FFC94D'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  // đẩy độ sáng lên vùng dễ đọc trên nền tối (~75% luminance)
  const boost = (v: number) => Math.round(Math.min(255, v + (255 - v) * 0.62))
  return `#${[r, g, b].map(v => boost(v).toString(16).padStart(2, '0')).join('')}`
}
function tint(hex: string | null | undefined, alpha = 0.13): string {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return 'rgba(255,201,77,0.13)'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function branchIcon(slug: string) {
  if (slug === 'k-embroidery') return 'ti-needle'
  if (slug === 'lotus-smock') return 'ti-flower'
  if (slug === 'office') return 'ti-building'
  return 'ti-scissors'
}

function branchDesc(slug: string) {
  if (slug === 'k-embroidery') return 'Thêu tay, OEM'
  if (slug === 'lotus-smock') return 'Smock, đầm trẻ em'
  if (slug === 'office') return 'Hành chính, vận hành'
  return 'Tóc, xuất khẩu, B2B'
}

// Card "ảo" gom 2 nhánh Smock
const SMOCK_CARD = {
  id: '__smock__',
  name: 'Smock',
  slug: '__smock__',
  color_bg: '#F5C2D8',
  color_text: '#D96B9A',
}

export default function RegisterPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [smockExpanded, setSmockExpanded] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    position: '',
    onboarding_date: '',
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

  // Tách nhánh smock và non-smock
  const smockBranches = branches.filter(b => b.slug === 'k-embroidery' || b.slug === 'lotus-smock')
  const nonSmockBranches = branches.filter(b => b.slug !== 'k-embroidery' && b.slug !== 'lotus-smock')

  // Card hiển thị: non-smock + 1 card smock ảo
  const displayCards = [...nonSmockBranches, SMOCK_CARD as Branch]

  const isSmockSelected = smockBranches.some(b => b.id === selectedBranch)

  async function handleRegister() {
    if (!selectedBranch) { setError('Vui lòng chọn nhánh đào tạo'); return }
    if (!form.name || !form.email || !form.password) { setError('Vui lòng điền đầy đủ thông tin tài khoản'); return }
    if (!form.position || !form.onboarding_date || !form.goal_after_onboarding || !form.expectation) {
      setError('Vui lòng điền đầy đủ thông tin onboarding'); return
    }
    if (!committed) { setError('Vui lòng xác nhận cam kết onboarding trước khi tạo tài khoản'); return }

    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        name: form.name,
        branch_id: selectedBranch,
        position: form.position,
        onboarding_date: form.onboarding_date,
        goal_after_onboarding: form.goal_after_onboarding,
        expectation: form.expectation,
      })
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Đã có lỗi xảy ra'); setLoading(false); return }

    router.push('/verify-email')
    setLoading(false)
  }

  const inputClass = "w-full border border-[#22304C] rounded-xl px-4 py-2.5 text-sm text-[#EEF3FB] placeholder:text-[#5F7796] focus:outline-none focus:border-[rgba(255,201,77,0.5)] transition-colors"
  const labelClass = "text-xs font-semibold text-[#C6D5E8] block mb-1.5 uppercase tracking-wide"

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: '#070B15', color: '#EEF3FB' }}>
      <div className="w-full max-w-md">

        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm text-[#8FA9C6] hover:text-[#FFC94D] transition-colors mb-6"
        >
          <i className="ti ti-arrow-left" style={{ fontSize: '15px' }} />
          Về trang chủ
        </button>

        <div className="bg-[#0E1526] rounded-3xl border border-[#22304C] p-8 shadow-sm">

          <div className="mb-7">
            <h1 className="font-heading text-2xl font-bold text-[#EEF3FB] mb-1">Tạo tài khoản</h1>
            <p className="text-sm text-[#8FA9C6]">Học viên Đào tạo K-Global</p>
          </div>

          {/* ── PHẦN 1: Thông tin tài khoản ── */}
          <div className="mb-6">
            <p className="text-xs font-bold text-[#8FA9C6] uppercase tracking-widest mb-4">Thông tin tài khoản</p>
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
            <p className="text-xs font-bold text-[#8FA9C6] uppercase tracking-widest mb-4">Nhánh đào tạo</p>

            {/* 3 card chính */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              {displayCards.map(b => {
                const isSmockCard = b.slug === '__smock__'
                const isSelected = isSmockCard ? isSmockSelected : selectedBranch === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      if (isSmockCard) {
                        setSmockExpanded(true)
                        // Chưa set selectedBranch — chờ chọn sub
                      } else {
                        setSelectedBranch(b.id)
                        setSmockExpanded(false)
                      }
                    }}
                    className={`relative border-2 rounded-2xl p-3 text-left transition-all ${
                      isSelected ? 'border-[#FFC94D]' : 'border-[#22304C] hover:border-[#3A4C72] bg-[#0E1526]'
                    }`}
                    style={isSelected ? { backgroundColor: tint(b.color_text) } : undefined}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: neonize(b.color_text) }}>
                        <i className="ti ti-check" style={{ fontSize: '11px', color: '#0A0E1A' }} />
                      </span>
                    )}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                      style={{ backgroundColor: isSelected ? tint(b.color_text, 0.22) : tint(b.color_text, 0.10) }}>
                      <i className={`ti ${isSmockCard ? 'ti-shirt' : branchIcon(b.slug)} text-xl`}
                        style={{ color: neonize(b.color_text) }} />
                    </div>
                    <p className="font-semibold text-xs mb-0.5"
                      style={{ color: isSelected ? neonize(b.color_text) : '#EEF3FB' }}>
                      {b.name}
                    </p>
                    <p className="text-[11px]"
                      style={{ color: isSelected ? neonize(b.color_text) : '#8FA9C6', opacity: isSelected ? 0.85 : 1 }}>
                      {isSmockCard ? 'KE · Lotus' : branchDesc(b.slug)}
                    </p>
                  </button>
                )
              })}
            </div>

            {/* Sub-option Smock — expand khi click card Smock */}
            {smockExpanded && (
              <div className="border border-[#22304C] rounded-2xl p-3 bg-[#141E36]">
                <p className="text-xs font-semibold text-[#8FA9C6] mb-2 uppercase tracking-wide">Chọn nhánh Smock</p>
                <div className="grid grid-cols-2 gap-2">
                  {smockBranches.map(b => {
                    const isSub = selectedBranch === b.id
                    return (
                      <button
                        key={b.id}
                        onClick={() => setSelectedBranch(b.id)}
                        className={`relative border-2 rounded-xl p-3 text-left transition-all ${
                          isSub ? 'border-[#FFC94D]' : 'border-[#22304C] hover:border-[#3A4C72] bg-[#0E1526]'
                        }`}
                        style={isSub ? { backgroundColor: tint(b.color_text) } : undefined}
                      >
                        {isSub && (
                          <span className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: neonize(b.color_text) }}>
                            <i className="ti ti-check" style={{ fontSize: '10px', color: '#0A0E1A' }} />
                          </span>
                        )}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5"
                          style={{ backgroundColor: isSub ? tint(b.color_text, 0.22) : tint(b.color_text, 0.10) }}>
                          <i className={`ti ${branchIcon(b.slug)}`} style={{ color: neonize(b.color_text), fontSize: '14px' }} />
                        </div>
                        <p className="font-semibold text-xs mb-0.5"
                          style={{ color: isSub ? neonize(b.color_text) : '#EEF3FB' }}>
                          {b.name}
                        </p>
                        <p className="text-[11px]"
                          style={{ color: isSub ? neonize(b.color_text) : '#8FA9C6', opacity: isSub ? 0.85 : 1 }}>
                          {branchDesc(b.slug)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── PHẦN 3: Thông tin onboarding ── */}
          <div className="border-t border-[#22304C] pt-6 mb-6">
            <p className="text-xs font-bold text-[#8FA9C6] uppercase tracking-widest mb-4">Thông tin onboarding</p>
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
                committed ? 'bg-[#141E36] border-[#FFC94D]' : 'border-[#2C3B5C] group-hover:border-[#3A4C72]'
              }`}>
                {committed && <i className="ti ti-check text-[#0A0E1A]" style={{ fontSize: '10px' }} />}
              </div>
            </div>
            <span className="text-xs text-[#C6D5E8] leading-relaxed">
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
            className="w-full bg-[#FFC94D] text-[#0A0E1A] rounded-2xl py-3 text-sm font-semibold disabled:opacity-50 hover:bg-[#FFD76B] transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang tạo tài khoản...
              </span>
            ) : 'Tạo tài khoản →'}
          </button>

          <p className="text-xs text-center text-[#8FA9C6] mt-5">
            Đã có tài khoản?{' '}
            <a href="/login" className="text-[#FFC94D] font-semibold hover:underline">Đăng nhập</a>
          </p>
        </div>
      </div>
    </div>
  )
}