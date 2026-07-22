/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import FeedbackReportTab from './FeedbackReportTab'

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
  tfSummary?: string  // ví dụ "8/10 đúng"
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
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[rgba(96,165,250,0.14)]"
      >
        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
          style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#3B82F6' }}>
          {l.orderIndex}
        </span>
        <p className="text-xs flex-1 truncate" style={{ color: '#EEF3FB' }}>{l.title}</p>
        <div className="flex gap-1.5 flex-shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            l.tick1 ? 'bg-[rgba(74,222,128,0.16)] text-[#4ADE80]' : 'bg-[#1A2542] text-[#8FA9C6]'
          }`}>Đã nộp</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            l.tick2 ? 'bg-[rgba(74,222,128,0.16)] text-[#4ADE80]' : 'bg-[#1A2542] text-[#8FA9C6]'
          }`}>Đạt LT</span>
          {(l as any).perfectScore && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-[rgba(251,191,36,0.16)] text-[#FBBF24]">⭐</span>
          )}
        </div>
        <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ fontSize: '11px', color: 'rgba(96,165,250,0.3)' }} />
      </button>

      {open && (
        <div className="px-3 pb-3 ml-7 space-y-1.5">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '⏱ Quiz', value: l.quizMinutes != null ? `${l.quizMinutes} phút` : '—' },
              { label: '⏱ Bài tập', value: l.practiceMinutes != null ? `${l.practiceMinutes} phút` : '—' },
              { label: '⏱ Tổng', value: l.totalMinutes != null ? `${l.totalMinutes} phút` : '—' },
              { label: '🎯 Đúng lần đầu', value: l.firstAttemptRate != null ? `${l.firstAttemptRate}%` : '—' },
              { label: '✅ TF đúng/sai', value: (l as any).tfSummary || '—' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl px-2.5 py-1.5"
                style={{ backgroundColor: 'rgba(96,165,250,0.12)' }}>
                <p className="text-[10px]" style={{ color: '#60A5FA' }}>{label}</p>
                <p className="text-xs font-semibold" style={{ color: '#EEF3FB' }}>{value}</p>
              </div>
            ))}
          </div>
          {l.completedAt && (
            <p className="text-[10px]" style={{ color: '#60A5FA' }}>
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
  const [viewTab, setViewTab] = useState<'learners' | 'feedback'>('learners')
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
    const header = ['Họ tên', 'Email', 'Nhánh', 'Vị trí', 'Ngày OB', 'Tiến độ %','Đúng lần đầu', 'Huy hiệu cao nhất', 'Bài đã xong Quiz', 'Bài đã xong Bài tập']
    const rows = filtered.map(l => {
      const highestBadge = ['diamond', 'gold', 'silver', 'bronze'].find(b => l.badges.includes(b))
      return [
        l.name, l.email, l.branch?.name || '', l.position || '',
        l.onboardingDate || '', `${l.pct}%`,
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
      <div className="w-6 h-6 border-2 border-[rgba(96,165,250,0.3)] border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="rounded-xl px-4 py-3 text-sm font-medium"
      style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid #FECACA' }}>
      <i className="ti ti-alert-circle mr-2" />{error}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        <button onClick={() => setViewTab('learners')}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
          style={{
            backgroundColor: viewTab === 'learners' ? '#3B82F6' : '#0E1526',
            color: viewTab === 'learners' ? '#FFFFFF' : '#60A5FA',
            border: '2px solid #0E62B1'
          }}>
          <i className="ti ti-users mr-1.5" style={{ fontSize: '13px' }} />
          Học viên
        </button>
        <button onClick={() => setViewTab('feedback')}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
          style={{
            backgroundColor: viewTab === 'feedback' ? '#3B82F6' : '#0E1526',
            color: viewTab === 'feedback' ? '#FFFFFF' : '#60A5FA',
            border: '2px solid #0E62B1'
          }}>
          <i className="ti ti-message-star mr-1.5" style={{ fontSize: '13px' }} />
          Feedback
        </button>
      </div>

      {viewTab === 'feedback' && <FeedbackReportTab />}

      {viewTab === 'learners' && <>

      {/* Header stats */}
      {stats && (
        <div className="rounded-2xl p-5 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
          <div className="grid grid-cols-4 gap-6 flex-1">
            {[
              { label: 'Tổng học viên', value: stats.total },
              { label: 'Hoàn thành 100%', value: stats.completing },
              { label: 'Tiến độ TB', value: `${stats.avgPct}%` },
              { label: 'Badge đã cấp', value: stats.badgeCount },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(96,165,250,0.3)' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <button onClick={load}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl ml-6 flex-shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#0E1526' }}>
            <i className="ti ti-refresh" style={{ fontSize: '14px' }} />
            Làm mới
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2"
          style={{ fontSize: '15px', color: '#3B82F6' }} />
        <input
          type="text"
          placeholder="Tìm tên, email, vị trí, mentor..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-full rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-colors bg-[#0E1526]"
          style={{ border: '1px solid rgba(96,165,250,0.3)' }}
          onFocus={e => e.target.style.borderColor = '#3B82F6'}
          onBlur={e => e.target.style.borderColor = 'rgba(96,165,250,0.3)'}
        />
        {searchText && (
          <button onClick={() => setSearchText('')}
            className="absolute right-4 top-1/2 -translate-y-1/2"
            style={{ color: '#60A5FA' }}>
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
              backgroundColor: filterBranch === 'all' ? '#3B82F6' : '#0E1526',
              color: filterBranch === 'all' ? '#FFFFFF' : '#60A5FA',
              border: '2px solid #0E62B1'
            }}>
            Tất cả ({learners.length})
          </button>
          {branches.map(b => {
            const branchLearner = learners.find(l => l.branch?.name === b)
            const bg = branchLearner?.branch?.color_bg || 'rgba(96,165,250,0.12)'
            const fg = branchLearner?.branch?.color_text || '#3B82F6'
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
          style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#3B82F6', border: '1px solid rgba(96,165,250,0.3)' }}>
          <i className="ti ti-download" style={{ fontSize: '14px' }} />
          Xuất Excel
        </button>
      </div>

      {(searchText || filterBranch !== 'all') && (
        <p className="text-xs" style={{ color: '#60A5FA' }}>
          {filtered.length === 0 ? 'Không tìm thấy học viên nào.' : `Hiển thị ${filtered.length}/${learners.length} học viên`}
        </p>
      )}

      {/* Danh sách học viên */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)' }}>
          <i className="ti ti-users-off" style={{ fontSize: '40px', color: 'rgba(96,165,250,0.3)' }} />
          <p className="text-sm mt-3 font-medium" style={{ color: '#60A5FA' }}>Chưa có học viên nào.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(learner => {
            const highestBadge = ['diamond', 'gold', 'silver', 'bronze'].find(b => learner.badges.includes(b))
            const bg = learner.branch?.color_bg || 'rgba(96,165,250,0.12)'
            const fg = learner.branch?.color_text || '#3B82F6'
            return (
              <div key={learner.id}
                className="bg-[#0E1526] rounded-2xl p-4 flex items-center gap-3 shadow-sm"
                style={{ border: '2px solid #EFF6FF' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: bg, color: fg }}>
                  {learner.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate" style={{ color: '#EEF3FB' }}>{learner.name}</p>
                    {highestBadge && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ backgroundColor: 'rgba(251,191,36,0.14)', color: '#FBBF24' }}>
                        {BADGE_LABELS[highestBadge]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#60A5FA' }}>
                    {learner.email} · {learner.branch?.name}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-sm font-bold" style={{ color: '#EEF3FB' }}>{learner.pct}%</p>
                  <div className="w-20 h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'rgba(96,165,250,0.12)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${learner.pct}%`, backgroundColor: fg }} />
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedLearner(learner); setOpenModuleKeys(new Set()) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors flex-shrink-0"
                  style={{ borderColor: 'rgba(96,165,250,0.3)', color: '#3B82F6' }}>
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
          <div className="bg-[#0E1526] rounded-2xl max-w-2xl w-full my-8 relative">

            {/* Modal header */}
            <div className="flex items-center justify-between p-5"
              style={{ borderBottom: '2px solid #EFF6FF' }}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: selectedLearner.branch?.color_bg || 'rgba(96,165,250,0.12)', color: selectedLearner.branch?.color_text || '#3B82F6' }}>
                  {selectedLearner.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: '#EEF3FB' }}>{selectedLearner.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#60A5FA' }}>{selectedLearner.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportExcel(selectedLearner)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors"
                  style={{ borderColor: 'rgba(96,165,250,0.3)', color: '#3B82F6' }}>
                  <i className="ti ti-download" style={{ fontSize: '13px' }} />
                  Xuất Excel
                </button>
                <button onClick={() => setSelectedLearner(null)}
                  className="text-sm font-medium px-2 py-1.5 rounded-xl transition-colors"
                  style={{ color: '#60A5FA' }}>✕</button>
              </div>
            </div>

            <div className="p-5 space-y-5">

              {/* Thông tin onboarding */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(96,165,250,0.3)' }}>Thông tin onboarding</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                   {[
                    ['Nhánh', selectedLearner.branch?.name],
                    ['Vị trí', selectedLearner.position],
                    ['Ngày OB', selectedLearner.onboardingDate],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs" style={{ color: '#60A5FA' }}>{label}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: '#EEF3FB' }}>{value || '—'}</p>
                    </div>
                  ))}
                </div>
                {selectedLearner.goal && (
                  <div className="mt-3">
                    <p className="text-xs mb-0.5" style={{ color: '#60A5FA' }}>Mục tiêu sau OB</p>
                    <p className="text-sm" style={{ color: '#EEF3FB' }}>{selectedLearner.goal}</p>
                  </div>
                )}
                {selectedLearner.expectation && (
                  <div className="mt-2">
                    <p className="text-xs mb-0.5" style={{ color: '#60A5FA' }}>Kỳ vọng</p>
                    <p className="text-sm" style={{ color: '#EEF3FB' }}>{selectedLearner.expectation}</p>
                  </div>
                )}
              </div>

              {/* Reset mật khẩu */}
              <div className="rounded-2xl p-4" style={{ border: '2px solid #EFF6FF' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(96,165,250,0.3)' }}>Đặt lại mật khẩu</p>
                {resetTargetId === selectedLearner.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
                      value={resetPassword}
                      onChange={e => { setResetPassword(e.target.value); setResetMsg(null) }}
                      className="w-full rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors bg-[#0E1526]"
                      style={{ border: '1px solid rgba(96,165,250,0.3)' }}
                      onFocus={e => e.target.style.borderColor = '#3B82F6'}
                      onBlur={e => e.target.style.borderColor = 'rgba(96,165,250,0.3)'}
                    />
                    {resetMsg && (
                      <p className={`text-xs px-3 py-2 rounded-xl ${resetMsg.ok ? 'bg-[rgba(74,222,128,0.12)] text-[#4ADE80]' : 'bg-[rgba(248,113,113,0.12)] text-[#F87171]'}`}>
                        {resetMsg.text}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleResetPassword}
                        disabled={resetLoading || resetPassword.length < 6}
                        className="flex-1 text-white text-sm rounded-xl py-2.5 font-bold disabled:opacity-40 transition-opacity hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
                        {resetLoading ? 'Đang xử lý...' : 'Xác nhận đặt lại'}
                      </button>
                      <button
                        onClick={() => { setResetTargetId(null); setResetPassword(''); setResetMsg(null) }}
                        className="px-4 text-sm font-medium rounded-xl border transition-colors"
                        style={{ borderColor: 'rgba(96,165,250,0.3)', color: '#60A5FA' }}>
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setResetTargetId(selectedLearner.id); setResetPassword(''); setResetMsg(null) }}
                    className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl border transition-colors"
                    style={{ borderColor: 'rgba(96,165,250,0.3)', color: '#3B82F6' }}>
                    <i className="ti ti-key" style={{ fontSize: '14px' }} />
                    Đặt lại mật khẩu cho học viên này
                  </button>
                )}
              </div>

              {/* Tiến độ tổng quan */}
              <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(96,165,250,0.12)' }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center flex-shrink-0">
                    <p className="text-3xl font-bold" style={{ color: '#3B82F6' }}>{selectedLearner.pct}%</p>
                    <p className="text-xs mt-0.5" style={{ color: '#60A5FA' }}>Tiến độ</p>
                  </div>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(96,165,250,0.3)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${selectedLearner.pct}%`, backgroundColor: '#3B82F6' }} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs mb-1" style={{ color: '#60A5FA' }}>Huy hiệu</p>
                    <div className="flex gap-1 justify-end">
                      {selectedLearner.badges.length === 0
                        ? <span className="text-xs" style={{ color: 'rgba(96,165,250,0.3)' }}>Chưa có</span>
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
                    <div key={label} className="bg-[#0E1526] rounded-xl p-2.5 text-center"
                      style={{ border: '1px solid #BFDBFE' }}>
                      <p className="text-[10px]" style={{ color: '#60A5FA' }}>{label}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: '#EEF3FB' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tiến độ bài học theo module */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3"
                  style={{ color: 'rgba(96,165,250,0.3)' }}>Tiến độ bài học</p>
                {selectedLearner.lessonProgress.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: '#60A5FA' }}>
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
                            style={{ border: '1px solid rgba(96,165,250,0.3)' }}>
                            <button
                              onClick={() => toggleModuleKey(key)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                              style={{ backgroundColor: isOpen ? 'rgba(96,165,250,0.12)' : '#0E1526' }}>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                                style={{
                                  backgroundColor: allDone ? 'rgba(74,222,128,0.14)' : 'rgba(96,165,250,0.12)',
                                  color: allDone ? '#4ADE80' : '#3B82F6'
                                }}>
                                {allDone ? '✓' : gi + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: '#EEF3FB' }}>
                                  {group.moduleName}
                                </p>
                                <p className="text-[10px] mt-0.5" style={{ color: '#60A5FA' }}>
                                  {done}/{total} hoàn thành
                                </p>
                              </div>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0"
                                style={{ backgroundColor: 'rgba(96,165,250,0.3)' }}>
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.round(done / total * 100)}%`, backgroundColor: '#3B82F6' }} />
                              </div>
                              <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                style={{ fontSize: '13px', color: 'rgba(96,165,250,0.3)' }} />
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
      </>}
    </div>
  )
}