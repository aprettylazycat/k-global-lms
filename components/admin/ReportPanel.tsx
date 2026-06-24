/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useState } from 'react'
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
    <div className="border-b border-stone-50 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-stone-50 transition-colors text-left"
      >
        <span className="w-5 h-5 rounded-full bg-stone-100 flex items-center justify-center text-[10px] text-stone-500 flex-shrink-0">
          {l.orderIndex}
        </span>
        <p className="text-xs text-stone-700 flex-1 truncate">{l.title}</p>
        <div className="flex gap-1.5 flex-shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${l.tick1 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}>
            Quiz
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${l.tick2 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}>
            Bài tập
          </span>
        </div>
        <i className={`ti ti-chevron-down text-stone-300 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ fontSize: '11px' }} />
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
              <div key={label} className="bg-stone-50 rounded-lg px-2.5 py-1.5">
                <p className="text-[10px] text-stone-400">{label}</p>
                <p className="text-xs font-semibold text-stone-700">{value}</p>
              </div>
            ))}
          </div>
          {l.completedAt && (
            <p className="text-[10px] text-stone-400">
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

  function toggleModuleKey(key: string) {
    setOpenModuleKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function load() {
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const res = await fetch('/api/admin/learner-report', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (res.ok) {
      setLearners(data.learners ?? [])
      setStats(data.stats)
    } else {
      setError(data.error || 'Không tải được báo cáo')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
      l.moduleName,
      l.title,
      l.orderIndex,
      l.tick1 ? '✓' : '✗',
      l.tick2 ? '✓' : '✗',
      l.firstAttemptRate != null ? `${l.firstAttemptRate}%` : '—',
      l.quizMinutes ?? '—',
      l.practiceMinutes ?? '—',
      l.totalMinutes ?? '—',
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
        l.name,
        l.email,
        l.branch?.name || '',
        l.position || '',
        l.onboardingDate || '',
        l.mentorName || '',
        `${l.pct}%`,
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

  if (loading) return <p className="text-sm text-stone-400 py-4 text-center">Đang tải báo cáo...</p>
  if (error) return <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>

  return (
    <div className="space-y-6">

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Tổng học viên', value: stats.total, color: 'text-stone-900' },
            { label: 'Hoàn thành 100%', value: stats.completing, color: 'text-green-600' },
            { label: 'Tiến độ TB', value: `${stats.avgPct}%`, color: 'text-blue-600' },
            { label: 'Badge đã cấp', value: stats.badgeCount, color: 'text-amber-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-100 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-stone-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter + Export */}
      <div className="space-y-3">
        <div className="relative">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" style={{ fontSize: '14px' }} />
          <input
            type="text"
            placeholder="Tìm tên, email, vị trí, mentor..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full border border-stone-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-stone-400 transition-colors"
          />
          {searchText && (
            <button onClick={() => setSearchText('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300 hover:text-stone-500">
              <i className="ti ti-x" style={{ fontSize: '14px' }} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-stone-500">Nhánh:</span>
            <button
              onClick={() => setFilterBranch('all')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterBranch === 'all' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              Tất cả ({learners.length})
            </button>
            {branches.map(b => {
              const branchLearner = learners.find(l => l.branch?.name === b)
              const bg = branchLearner?.branch?.color_bg || '#F4F4F5'
              const fg = branchLearner?.branch?.color_text || '#374151'
              const count = learners.filter(l => (l.branch?.name || 'Không rõ') === b).length
              const isActive = filterBranch === b
              return (
                <button key={b} onClick={() => setFilterBranch(b)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                  style={isActive ? { backgroundColor: fg, color: '#fff', borderColor: fg } : { backgroundColor: bg, color: fg, borderColor: 'transparent' }}>
                  {b} ({count})
                </button>
              )
            })}
          </div>
          <button onClick={exportAllExcel}
            className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-stone-50 transition-colors flex-shrink-0">
            <i className="ti ti-download" style={{ fontSize: '13px' }} />
            Xuất Excel
          </button>
        </div>

        {(searchText || filterBranch !== 'all') && (
          <p className="text-xs text-stone-400">
            {filtered.length === 0 ? 'Không tìm thấy học viên nào.' : `Hiển thị ${filtered.length}/${learners.length} học viên`}
          </p>
        )}
      </div>

      {/* Danh sách học viên */}
      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 bg-stone-50 rounded-xl p-6 text-center">Chưa có học viên nào.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(learner => {
            const highestBadge = ['diamond', 'gold', 'silver', 'bronze'].find(b => learner.badges.includes(b))
            const bg = learner.branch?.color_bg || '#F4F4F5'
            const fg = learner.branch?.color_text || '#374151'
            return (
              <div key={learner.id} className="bg-white rounded-2xl border border-stone-100 p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: bg, color: fg }}>
                  {learner.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-stone-800 truncate">{learner.name}</p>
                    {highestBadge && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {BADGE_LABELS[highestBadge]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 truncate">{learner.email} · {learner.branch?.name}</p>
                </div>
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-sm font-bold text-stone-800">{learner.pct}%</p>
                  <div className="w-20 h-1.5 bg-stone-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${learner.pct}%`, backgroundColor: fg }} />
                  </div>
                </div>
                <button onClick={() => { setSelectedLearner(learner); setOpenModuleKeys(new Set()) }}
                  className="text-xs text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5 hover:bg-stone-50 flex-shrink-0 font-medium">
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

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{ backgroundColor: selectedLearner.branch?.color_bg || '#F4F4F5', color: selectedLearner.branch?.color_text || '#374151' }}>
                  {selectedLearner.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{selectedLearner.name}</p>
                  <p className="text-xs text-stone-400">{selectedLearner.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportExcel(selectedLearner)}
                  className="text-xs border border-stone-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-stone-50 font-medium">
                  <i className="ti ti-download" style={{ fontSize: '13px' }} />
                  Xuất Excel
                </button>
                <button onClick={() => setSelectedLearner(null)}
                  className="text-stone-400 hover:text-stone-700 text-sm px-2">✕</button>
              </div>
            </div>

            <div className="p-5 space-y-5">

              {/* Thông tin onboarding */}
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Thông tin onboarding</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {[
                    ['Nhánh', selectedLearner.branch?.name],
                    ['Vị trí', selectedLearner.position],
                    ['Ngày OB', selectedLearner.onboardingDate],
                    ['Mentor', selectedLearner.mentorName],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-stone-400">{label}</p>
                      <p className="text-sm font-medium text-stone-800">{value || '—'}</p>
                    </div>
                  ))}
                </div>
                {selectedLearner.goal && (
                  <div className="mt-3">
                    <p className="text-xs text-stone-400 mb-0.5">Mục tiêu sau OB</p>
                    <p className="text-sm text-stone-800">{selectedLearner.goal}</p>
                  </div>
                )}
                {selectedLearner.expectation && (
                  <div className="mt-2">
                    <p className="text-xs text-stone-400 mb-0.5">Kỳ vọng</p>
                    <p className="text-sm text-stone-800">{selectedLearner.expectation}</p>
                  </div>
                )}
              </div>

              {/* Tiến độ tổng quan */}
              <div className="rounded-2xl p-4 bg-stone-50 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="text-center flex-shrink-0">
                    <p className="text-2xl font-bold text-stone-900">{selectedLearner.pct}%</p>
                    <p className="text-xs text-stone-400">Tiến độ</p>
                  </div>
                  <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${selectedLearner.pct}%`, backgroundColor: selectedLearner.branch?.color_text || '#374151' }} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-stone-400 mb-1">Huy hiệu</p>
                    <div className="flex gap-1">
                      {selectedLearner.badges.length === 0
                        ? <span className="text-xs text-stone-300">Chưa có</span>
                        : selectedLearner.badges.map(b => <span key={b} className="text-xs">{BADGE_LABELS[b]}</span>)
                      }
                    </div>
                  </div>
                </div>
                {selectedLearner.firstAttemptRate != null && (
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-200">
                    <span className="text-xs text-stone-500">🎯 Tỷ lệ đúng lần đầu (toàn bộ):</span>
                    <span className="text-sm font-bold text-stone-800">{selectedLearner.firstAttemptRate}%</span>
                  </div>
                )}
              </div>

              {/* Tiến độ bài học theo module */}
              <div>
                <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Tiến độ bài học</p>
                {selectedLearner.lessonProgress.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-4">Chưa bắt đầu bài học nào.</p>
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
                          <div key={gi} className="border border-stone-200 rounded-xl overflow-hidden">
                            {/* Module header */}
                            <button
                              onClick={() => toggleModuleKey(key)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-stone-50 transition-colors text-left"
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                allDone ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                              }`}>
                                {allDone ? '✓' : gi + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-stone-700 truncate">{group.moduleName}</p>
                                <p className="text-[10px] text-stone-400 mt-0.5">{done}/{total} hoàn thành</p>
                              </div>
                              <div className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden flex-shrink-0">
                                <div className="h-full rounded-full transition-all"
                                  style={{ width: `${Math.round(done / total * 100)}%`, backgroundColor: selectedLearner.branch?.color_text || '#374151' }} />
                              </div>
                              <i className={`ti ti-chevron-down text-stone-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                style={{ fontSize: '13px' }} />
                            </button>

                            {/* Lesson rows */}
                            {isOpen && (
                              <div className="border-t border-stone-100">
                                {group.lessons.map(l => (
                                  <LessonRow key={l.lessonId} l={l} />
                                ))}
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