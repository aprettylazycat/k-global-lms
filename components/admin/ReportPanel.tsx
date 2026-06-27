/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type LessonProgress = {
  lessonId: number
  title: string
  orderIndex: number
  moduleId: number | null
  moduleName: string
  moduleOrder: number
  tick1: boolean
  tick2: boolean
  completedAt: string | null
  quizMinutes: number | null
  practiceMinutes: number | null
  totalMinutes: number | null
  firstAttemptRate: number | null
}

type Learner = {
  id: string
  name: string
  email: string
  branch: { name: string; slug: string; color_bg: string; color_text: string } | null
  position: string | null
  onboardingDate: string | null
  mentorName: string | null
  goal: string | null
  expectation: string | null
  pct: number
  badges: string[]
  firstAttemptRate: number | null
  lessonProgress: LessonProgress[]
}

type Stats = {
  total: number
  avgPct: number
  badgeCount: number
  completing: number
}

const BADGE_LABELS: Record<string, string> = {
  bronze: '🥉 Đồng',
  silver: '🥈 Bạc',
  gold: '🥇 Vàng',
  diamond: '💎 Kim cương',
}

function LessonRow({ l }: { l: LessonProgress }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #EFF6FF' }} className="last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-blue-50"
      >
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ backgroundColor: '#EFF6FF', color: '#0E62B1' }}>
          {l.orderIndex}
        </span>
        <p className="text-xs flex-1 truncate" style={{ color: '#1E3A5F' }}>{l.title}</p>
        <div className="flex gap-1.5 flex-shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            l.tick1 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'
          }`}>Đã nộp</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            l.tick2 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'
          }`}>Đạt LT</span>
          {(l as any).perfectScore && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">⭐</span>
          )}
        </div>
        <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ fontSize: '11px', color: '#BFDBFE' }} />
      </button>

      {open && (
        <div className="px-3 pb-3 ml-7 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '⏱ Quiz', value: l.quizMinutes != null ? `${l.quizMinutes} phút` : '—' },
              { label: '⏱ Bài tập', value: l.practiceMinutes != null ? `${l.practiceMinutes} phút` : '—' },
              { label: '⏱ Tổng', value: l.totalMinutes != null ? `${l.totalMinutes} phút` : '—' },
              { label: '🎯 Đúng lần đầu', value: l.firstAttemptRate != null ? `${l.firstAttemptRate}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl px-2.5 py-1.5"
                style={{ backgroundColor: '#EFF6FF' }}>
                <p className="text-[10px]" style={{ color: '#93C5FD' }}>{label}</p>
                <p className="text-xs font-semibold" style={{ color: '#1E3A5F' }}>{value}</p>
              </div>
            ))}
          </div>
          {l.completedAt && (
            <p className="text-[10px]" style={{ color: '#93C5FD' }}>
              Hoàn thành: {new Date(l.completedAt).toLocaleDateString('vi-VN')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportPanel() {
  const [learners, setLearners] = useState<Learner[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterBranch, setFilterBranch] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [selectedLearner, setSelectedLearner] = useState<Learner | null>(null)
  const [openModuleKeys, setOpenModuleKeys] = useState<Set<string>>(new Set())
  const [resetTargetId, setResetTargetId] = useState<string | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const hasFetched = useRef(false)

  async function load() {
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const res = await fetch('/api/admin/learner-report', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (res.ok) { setLearners(data.learners ?? []); setStats(data.stats) }
    else setError(data.error || 'Không tải được báo cáo')
    setLoading(false)
  }

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    load()
  }, [])

  async function handleResetPassword() {
    if (!resetTargetId || !resetPassword) return
    setResetLoading(true)
    setResetMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ userId: resetTargetId, newPassword: resetPassword }),
    })
    const data = await res.json()
    if (res.ok) { setResetMsg({ ok: true, text: 'Đặt lại mật khẩu thành công!' }); setResetPassword('') }
    else setResetMsg({ ok: false, text: data.error || 'Có lỗi xảy ra' })
    setResetLoading(false)
  }

  function toggleModuleKey(key: string) {
    setOpenModuleKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const branches = Array.from(new Set(learners.map(l => l.branch?.name || 'Không rõ')))

  const filtered = learners.filter(l => {
    const matchBranch = filterBranch === 'all' || l.branch?.name === filterBranch
    const q = searchText.toLowerCase().trim()
    const matchSearch = !q ||
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.position?.toLowerCase().includes(q) ||
      l.mentorName?.toLowerCase().includes(q)
    return matchBranch && matchSearch
  })

  function exportExcel(learner: Learner) {
    const wb = XLSX.utils.book_new()
    const info = [
      ['Họ tên', learner.name],
      ['Email', learner.email],
      ['Nhánh', learner.branch?.name || ''],
      ['Vị trí', learner.position || ''],
      ['Ngày OB', learner.onboardingDate || ''],
      ['Mentor', learner.mentorName || ''],
      ['Mục tiêu', learner.goal || ''],
      ['Kỳ vọng', learner.expectation || ''],
      ['Tiến độ', `${learner.pct}%`],
      ['Tỷ lệ đúng lần đầu', learner.firstAttemptRate != null ? `${learner.firstAttemptRate}%` : 'Chưa có data'],
      ['Huy hiệu', learner.badges.map(b => BADGE_LABELS[b] || b).join(', ') || 'Chưa có'],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(info)
    ws1['!cols'] = [{ wch: 25 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Thông tin')
    const progressHeader = ['Module', 'Bài học', 'Thứ tự', 'Quiz', 'Bài tập', 'Đúng lần đầu', 'T/g Quiz (phút)', 'T/g Bài tập (phút)', 'T/g Tổng (phút)', 'Ngày hoàn thành']
    const progressRows = learner.lessonProgress.map(l => [
      l.moduleName, l.title, l.orderIndex,
      l.tick1 ? '✓' : '✗', l.tick2 ? '✓' : '✗',
      l.firstAttemptRate != null ? `${l.firstAttemptRate}%` : '—',
      l.quizMinutes ?? '—', l.practiceMinutes ?? '—', l.totalMinutes ?? '—',
      l.completedAt ? new Date(l.completedAt).toLocaleDateString('vi-VN') : '',
    ])
    const ws2 = XLSX.utils.aoa_to_sheet([progressHeader, ...progressRows])
    ws2['!cols'] = [{ wch: 28 }, { wch: 45 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Tiến độ')
    XLSX.writeFile(wb, `bao-cao-${learner.name.replace(/\s/g, '-')}.xlsx`)
  }

  function exportAllExcel() {
    const wb = XLSX.utils.book_new()
    const header = ['Họ tên', 'Email', 'Nhánh', 'Vị trí', 'Ngày OB', 'Mentor', 'Tiến độ %', 'Đúng lần đầu', 'Huy hiệu cao nhất', 'Bài đã xong Quiz', 'Bài đã xong Bài tập']
    const rows = filtered.map(l => {
      const highestBadge = ['diamond', 'gold', 'silver', 'bronze'].find(b => l.badges.includes(b))
      return [
        l.name, l.email, l.branch?.name || '', l.position || '',
        l.onboardingDate || '', l.mentorName || '', `${l.pct}%`,
        l.firstAttemptRate != null ? `${l.firstAttemptRate}%` : '—',
        highestBadge ? (BADGE_LABELS[highestBadge] || highestBadge) : 'Chưa có',
        l.lessonProgress.filter(p => p.tick1).length,
        l.lessonProgress.filter(p => p.tick2).length,
      ]
    })
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách học viên')
    XLSX.writeFile(wb, `bao-cao-toan-bo-hoc-vien.xlsx`)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="rounded-xl px-4 py-3 text-sm font-medium"
      style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
      <i className="ti ti-alert-circle mr-2" />{error}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Header stats */}
      {stats && (
        <div className="rounded-2xl p-5 flex items-center justify-between"
          style={{ backgroundColor: '#0E62B1' }}>
          <div className="grid grid-cols-4 gap-6 flex-1">
            {[
              { label: 'Tổng học viên', value: stats.total },
              { label: 'Hoàn thành 100%', value: stats.completing },
              { label: 'Tiến độ TB', value: `${stats.avgPct}%` },
              { label: 'Badge đã cấp', value: stats.badgeCount },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#BFDBFE' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <button onClick={load}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl ml-6 flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
            <i className="ti ti-refresh" style={{ fontSize: '14px' }} />
            Làm mới
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2"
          style={{ fontSize: '15px', color: '#0E62B1' }} />
        <input
          type="text"
          placeholder="Tìm tên, email, vị trí, mentor..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-colors bg-white"
          style={{ border: '2px solid #BFDBFE' }}
          onFocus={e => e.target.style.borderColor = '#0E62B1'}
          onBlur={e => e.target.style.borderColor = '#BFDBFE'}
        />
        {searchText && (
          <button onClick={() => setSearchText('')}
            className="absolute right-4 top-1/2 -translate-y-1/2"
            style={{ color: '#93C5FD' }}>
            <i className="ti ti-x" style={{ fontSize: '14px' }} />
          </button>
        )}
      </div>

      {/* Filter nhánh + Xuất Excel */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilterBranch('all')}
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            style={{
              backgroundColor: filterBranch === 'all' ? '#0E62B1' : 'white',
              color: filterBranch === 'all' ? 'white' : '#0E62B1',
              border: '2px solid #0E62B1'
            }}>
            Tất cả ({learners.length})
          </button>
          {branches.map(b => {
            const branchLearner = learners.find(l => l.branch?.name === b)
            const bg = branchLearner?.branch?.color_bg || '#EFF6FF'
            const fg = branchLearner?.branch?.color_text || '#0E62B1'
            const count = learners.filter(l => (l.branch?.name || 'Không rõ') === b).length
            const isActive = filterBranch === b
            return (
              <button key={b} onClick={() => setFilterBranch(b)}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                style={isActive
                  ? { backgroundColor: fg, color: '#fff', border: `2px solid ${fg}` }
                  : { backgroundColor: bg, color: fg, border: `2px solid transparent` }
                }>
                {b} ({count})
              </button>
            )
          })}
        </div>
        <button onClick={exportAllExcel}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex-shrink-0"
          style={{ backgroundColor: '#EFF6FF', color: '#0E62B1', border: '2px solid #BFDBFE' }}>
          <i className="ti ti-download" style={{ fontSize: '14px' }} />
          Xuất Excel
        </button>
      </div>

      {(searchText || filterBranch !== 'all') && (
        <p className="text-xs" style={{ color: '#93C5FD' }}>
          {filtered.length === 0 ? 'Không tìm thấy học viên nào.' : `Hiển thị ${filtered.length}/${learners.length} học viên`}
        </p>
      )}

      {/* Danh sách học viên */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: '#EFF6FF', border: '2px solid #BFDBFE' }}>
          <i className="ti ti-users-off" style={{ fontSize: '40px', color: '#BFDBFE' }} />
          <p className="text-sm mt-3 font-medium" style={{ color: '#93C5FD' }}>Chưa có học viên nào.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(learner => {
            const highestBadge = ['diamond', 'gold', 'silver', 'bronze'].find(b => learner.badges.includes(b))
            const bg = learner.branch?.color_bg || '#EFF6FF'
            const fg = learner.branch?.color_text || '#0E62B1'
            return (
              <div key={learner.id}
                className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm"
                style={{ border: '2px solid #EFF6FF' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: bg, color: fg }}>
                  {learner.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1E3A5F' }}>{learner.name}</p>
                    {highestBadge && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
                        {BADGE_LABELS[highestBadge]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#93C5FD' }}>
                    {learner.email} · {learner.branch?.name}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-sm font-bold" style={{ color: '#1E3A5F' }}>{learner.pct}%</p>
                  <div className="w-20 h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: '#EFF6FF' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${learner.pct}%`, backgroundColor: fg }} />
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedLearner(learner); setOpenModuleKeys(new Set()) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors flex-shrink-0"
                  style={{ borderColor: '#BFDBFE', color: '#0E62B1' }}>
                  Chi tiết
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal chi tiết */}
      {selectedLearner && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full my-8 relative">

            {/* Modal header */}
            <div className="flex items-center justify-between p-5"
              style={{ borderBottom: '2px solid #EFF6FF' }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: selectedLearner.branch?.color_bg || '#EFF6FF', color: selectedLearner.branch?.color_text || '#0E62B1' }}>
                  {selectedLearner.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: '#1E3A5F' }}>{selectedLearner.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#93C5FD' }}>{selectedLearner.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportExcel(selectedLearner)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors"
                  style={{ borderColor: '#BFDBFE', color: '#0E62B1' }}>
                  <i className="ti ti-download" style={{ fontSize: '13px' }} />
                  Xuất Excel
                </button>
                <button onClick={() => setSelectedLearner(null)}
                  className="text-sm font-medium px-2 py-1.5 rounded-xl transition-colors"
                  style={{ color: '#93C5FD' }}>✕</button>
              </div>
            </div>

            <div className="p-5 space-y-5">

              {/* Thông tin onboarding */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: '#BFDBFE' }}>Thông tin onboarding</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    ['Nhánh', selectedLearner.branch?.name],
                    ['Vị trí', selectedLearner.position],
                    ['Ngày OB', selectedLearner.onboardingDate],
                    ['Mentor', selectedLearner.mentorName],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs" style={{ color: '#93C5FD' }}>{label}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: '#1E3A5F' }}>{value || '—'}</p>
                    </div>
                  ))}
                </div>
                {selectedLearner.goal && (
                  <div className="mt-3">
                    <p className="text-xs mb-0.5" style={{ color: '#93C5FD' }}>Mục tiêu sau OB</p>
                    <p className="text-sm" style={{ color: '#1E3A5F' }}>{selectedLearner.goal}</p>
                  </div>
                )}
                {selectedLearner.expectation && (
                  <div className="mt-2">
                    <p className="text-xs mb-0.5" style={{ color: '#93C5FD' }}>Kỳ vọng</p>
                    <p className="text-sm" style={{ color: '#1E3A5F' }}>{selectedLearner.expectation}</p>
                  </div>
                )}
              </div>

              {/* Reset mật khẩu */}
              <div className="rounded-2xl p-4" style={{ border: '2px solid #EFF6FF' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: '#BFDBFE' }}>Đặt lại mật khẩu</p>
                {resetTargetId === selectedLearner.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                      value={resetPassword}
                      onChange={e => { setResetPassword(e.target.value); setResetMsg(null) }}
                      className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors bg-white"
                      style={{ border: '2px solid #BFDBFE' }}
                      onFocus={e => e.target.style.borderColor = '#0E62B1'}
                      onBlur={e => e.target.style.borderColor = '#BFDBFE'}
                    />
                    {resetMsg && (
                      <p className={`text-xs px-3 py-2 rounded-xl ${resetMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {resetMsg.text}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleResetPassword}
                        disabled={resetLoading || resetPassword.length < 6}
                        className="flex-1 text-white text-sm rounded-xl py-2.5 font-bold disabled:opacity-40 transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#0E62B1' }}>
                        {resetLoading ? 'Đang xử lý...' : 'Xác nhận đặt lại'}
                      </button>
                      <button
                        onClick={() => { setResetTargetId(null); setResetPassword(''); setResetMsg(null) }}
                        className="px-4 text-sm font-medium rounded-xl border transition-colors"
                        style={{ borderColor: '#BFDBFE', color: '#93C5FD' }}>
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setResetTargetId(selectedLearner.id); setResetPassword(''); setResetMsg(null) }}
                    className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors"
                    style={{ borderColor: '#BFDBFE', color: '#0E62B1' }}>
                    <i className="ti ti-key" style={{ fontSize: '14px' }} />
                    Đặt lại mật khẩu cho học viên này
                  </button>
                )}
              </div>

              {/* Tiến độ tổng quan */}
              <div className="rounded-2xl p-4" style={{ backgroundColor: '#EFF6FF' }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center flex-shrink-0">
                    <p className="text-3xl font-bold" style={{ color: '#0E62B1' }}>{selectedLearner.pct}%</p>
                    <p className="text-xs mt-0.5" style={{ color: '#93C5FD' }}>Tiến độ</p>
                  </div>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#BFDBFE' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${selectedLearner.pct}%`, backgroundColor: '#0E62B1' }} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs mb-1" style={{ color: '#93C5FD' }}>Huy hiệu</p>
                    <div className="flex gap-1 justify-end">
                      {selectedLearner.badges.length === 0
                        ? <span className="text-xs" style={{ color: '#BFDBFE' }}>Chưa có</span>
                        : selectedLearner.badges.map(b => (
                          <span key={b} className="text-xs">{BADGE_LABELS[b]}</span>
                        ))
                      }
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: '2px solid #BFDBFE' }}>
                  {[
                    { label: '🎯 Đúng lần đầu', value: selectedLearner.firstAttemptRate != null ? `${selectedLearner.firstAttemptRate}%` : '—' },
                    { label: '⏱ Tổng thời gian', value: (selectedLearner as any).totalMinutesAll > 0 ? `${(selectedLearner as any).totalMinutesAll} phút` : '—' },
                    { label: '⭐ Perfect Score', value: `${(selectedLearner as any).perfectScoreCount ?? 0} bài` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-xl p-2.5 text-center"
                      style={{ border: '1px solid #BFDBFE' }}>
                      <p className="text-[10px]" style={{ color: '#93C5FD' }}>{label}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#1E3A5F' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tiến độ bài học theo module */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: '#BFDBFE' }}>Tiến độ bài học</p>
                {selectedLearner.lessonProgress.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: '#93C5FD' }}>
                    Chưa bắt đầu bài học nào.
                  </p>
                ) : (() => {
                  const moduleGroups: Record<string, { moduleName: string; moduleOrder: number; lessons: LessonProgress[] }> = {}
                  selectedLearner.lessonProgress.forEach(l => {
                    const key = l.moduleId ? String(l.moduleId) : 'none'
                    if (!moduleGroups[key]) moduleGroups[key] = { moduleName: l.moduleName, moduleOrder: l.moduleOrder ?? 999, lessons: [] }
                    moduleGroups[key].lessons.push(l)
                  })
                  const sorted = Object.values(moduleGroups).sort((a, b) => a.moduleOrder - b.moduleOrder)
                  return (
                    <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                      {sorted.map((group, gi) => {
                        const done = group.lessons.filter(l => l.tick1 && l.tick2).length
                        const total = group.lessons.length
                        const allDone = done === total
                        const key = `module-${gi}`
                        const isOpen = openModuleKeys.has(key)
                        return (
                          <div key={gi} className="rounded-2xl overflow-hidden"
                            style={{ border: '2px solid #BFDBFE' }}>
                            <button
                              onClick={() => toggleModuleKey(key)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                              style={{ backgroundColor: isOpen ? '#EFF6FF' : 'white' }}>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                style={{
                                  backgroundColor: allDone ? '#D1FAE5' : '#EFF6FF',
                                  color: allDone ? '#059669' : '#0E62B1'
                                }}>
                                {allDone ? '✓' : gi + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: '#1E3A5F' }}>
                                  {group.moduleName}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: '#93C5FD' }}>
                                  {done}/{total} hoàn thành
                                </p>
                              </div>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0"
                                style={{ backgroundColor: '#BFDBFE' }}>
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.round(done / total * 100)}%`, backgroundColor: '#0E62B1' }} />
                              </div>
                              <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                style={{ fontSize: '13px', color: '#BFDBFE' }} />
                            </button>
                            {isOpen && (
                              <div style={{ borderTop: '2px solid #EFF6FF' }}>
                                {group.lessons.map(l => <LessonRow key={l.lessonId} l={l} />)}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}