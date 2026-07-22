/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type BranchOption = {
  id: string
  name: string
  slug: string
}

type ModuleOption = {
  id: number
  name: string
  order_index: number
}

type FeedbackResponse = {
  id: string
  user_id: string
  module_id: number
  question_id: string
  rating_value: number | null
  text_value: string | null
  submitted_at: string
  question: { question_text: string; question_type: 'rating' | 'text' } | null
  user: { name: string; email: string } | null
}

type QuestionGroup = {
  questionId: string
  questionText: string
  questionType: 'rating' | 'text'
  ratings: number[]
  texts: { name: string; email: string; text: string; submittedAt: string }[]
}

type ModuleGroup = {
  moduleId: number
  moduleName: string
  orderIndex: number
  respondents: number
  avgRating: number | null
  questions: QuestionGroup[]
}

export default function FeedbackReportTab() {
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [loadingBranches, setLoadingBranches] = useState(true)
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [error, setError] = useState('')
  const hasFetched = useRef(false)

  // ── Tải danh sách nhánh ──
  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    async function loadBranches() {
      setLoadingBranches(true)
      const { data, error: err } = await supabase
        .from('branches')
        .select('id, name, slug')
        .order('name', { ascending: true })
      if (err) {
        setError('Không tải được danh sách nhánh')
      } else {
        setBranches(data ?? [])
        if (data && data.length > 0) setSelectedBranchId(data[0].id)
      }
      setLoadingBranches(false)
    }
    loadBranches()
  }, [])

  // ── Tải feedback của cả nhánh ──
  useEffect(() => {
    if (!selectedBranchId) return
    async function loadResponses() {
      setLoadingResponses(true)
      setError('')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Phiên đăng nhập đã hết hạn'); setLoadingResponses(false); return }
      const res = await fetch(`/api/admin/feedback?branch_id=${selectedBranchId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setResponses(data.responses ?? [])
        setModules(data.modules ?? [])
      } else {
        setError(data.error || 'Không tải được feedback')
        setResponses([])
        setModules([])
      }
      setLoadingResponses(false)
    }
    loadResponses()
  }, [selectedBranchId])

  // ── Gom theo module → trong mỗi module gom theo câu hỏi ──
  const moduleGroups: ModuleGroup[] = (() => {
    const byModule: Record<number, FeedbackResponse[]> = {}
    responses.forEach(r => {
      if (!byModule[r.module_id]) byModule[r.module_id] = []
      byModule[r.module_id].push(r)
    })

    return modules
      .filter(m => (byModule[m.id]?.length ?? 0) > 0)
      .map(m => {
        const rs = byModule[m.id]
        const qmap: Record<string, QuestionGroup> = {}
        rs.forEach(r => {
          if (!r.question) return
          if (!qmap[r.question_id]) {
            qmap[r.question_id] = {
              questionId: r.question_id,
              questionText: r.question.question_text,
              questionType: r.question.question_type,
              ratings: [],
              texts: [],
            }
          }
          if (r.rating_value != null) qmap[r.question_id].ratings.push(r.rating_value)
          if (r.text_value) {
            qmap[r.question_id].texts.push({
              name: r.user?.name || 'Không rõ',
              email: r.user?.email || '',
              text: r.text_value,
              submittedAt: r.submitted_at,
            })
          }
        })
        const allRatings = rs.map(r => r.rating_value).filter((v): v is number => v != null)
        return {
          moduleId: m.id,
          moduleName: m.name,
          orderIndex: m.order_index,
          respondents: new Set(rs.map(r => r.user_id)).size,
          avgRating: allRatings.length > 0
            ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
            : null,
          questions: Object.values(qmap),
        }
      })
  })()

  const selectedBranch = branches.find(b => b.id === selectedBranchId)
  const totalRespondents = new Set(responses.map(r => r.user_id)).size
  const branchRatings = responses.map(r => r.rating_value).filter((v): v is number => v != null)
  const branchAvg = branchRatings.length > 0
    ? branchRatings.reduce((a, b) => a + b, 0) / branchRatings.length
    : null

  function exportExcel() {
    if (!selectedBranch) return
    const wb = XLSX.utils.book_new()

    // Sheet 1: tổng quan theo module
    const overviewHeader = ['Module', 'Số học viên gửi', 'Điểm TB', 'Số câu hỏi có phản hồi']
    const overviewRows = moduleGroups.map(g => [
      g.moduleName,
      g.respondents,
      g.avgRating != null ? g.avgRating.toFixed(2) : '—',
      g.questions.length,
    ])
    const wsOverview = XLSX.utils.aoa_to_sheet([overviewHeader, ...overviewRows])
    wsOverview['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 12 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Tong quan nhanh')

    // Sheet 2: tổng hợp theo câu hỏi (kèm cột module)
    const summaryHeader = ['Module', 'Câu hỏi', 'Loại', 'Số lượt trả lời', 'Điểm TB (nếu rating)']
    const summaryRows: any[] = []
    moduleGroups.forEach(g => {
      g.questions.forEach(q => {
        summaryRows.push([
          g.moduleName,
          q.questionText,
          q.questionType === 'rating' ? 'Rating' : 'Text',
          q.questionType === 'rating' ? q.ratings.length : q.texts.length,
          q.questionType === 'rating' && q.ratings.length > 0
            ? (q.ratings.reduce((a, b) => a + b, 0) / q.ratings.length).toFixed(2)
            : '—',
        ])
      })
    })
    const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows])
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 10 }, { wch: 16 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Theo cau hoi')

    // Sheet 3: chi tiết từng phản hồi
    const moduleName = (id: number) => modules.find(m => m.id === id)?.name || ''
    const detailHeader = ['Module', 'Câu hỏi', 'Học viên', 'Email', 'Rating', 'Câu trả lời', 'Ngày gửi']
    const detailRows = responses.map(r => [
      moduleName(r.module_id),
      r.question?.question_text || '',
      r.user?.name || '',
      r.user?.email || '',
      r.rating_value ?? '',
      r.text_value ?? '',
      new Date(r.submitted_at).toLocaleDateString('vi-VN'),
    ])
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows])
    wsDetail['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 50 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiet')

    XLSX.writeFile(wb, `feedback-${selectedBranch.name.replace(/\s/g, '-')}.xlsx`)
  }

  if (loadingBranches) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[rgba(96,165,250,0.3)] border-t-[#3B82F6] rounded-full animate-spin" />
    </div>
  )

  if (branches.length === 0) return (
    <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'rgba(96,165,250,0.12)', border: '1px dashed rgba(96,165,250,0.3)' }}>
      <p className="text-sm font-medium" style={{ color: '#60A5FA' }}>Chưa có nhánh nào.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid rgba(248,113,113,0.35)' }}>
          <i className="ti ti-alert-circle mr-2" />{error}
        </div>
      )}

      {/* ── Chọn nhánh ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {branches.map(b => {
          const active = selectedBranchId === b.id
          return (
            <button key={b.id}
              onClick={() => setSelectedBranchId(b.id)}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              style={{
                backgroundColor: active ? '#3B82F6' : '#0E1526',
                color: active ? '#FFFFFF' : '#60A5FA',
                border: '1px solid rgba(96,165,250,0.4)',
              }}>
              {b.name}
            </button>
          )
        })}
      </div>

      {/* ── Thống kê nhánh + xuất Excel ── */}
      <div className="rounded-2xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)',
          border: '1px solid rgba(155,196,232,0.28)',
        }}>
        <div className="flex items-center gap-7 flex-wrap">
          <div>
            <p className="text-xl font-bold" style={{ color: '#EEF3FB' }}>{moduleGroups.length}</p>
            <p className="text-xs font-medium" style={{ color: '#8FA9C6' }}>module có feedback</p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: '#EEF3FB' }}>{totalRespondents}</p>
            <p className="text-xs font-medium" style={{ color: '#8FA9C6' }}>học viên đã gửi</p>
          </div>
          <div>
            <p className="text-xl font-bold" style={{ color: '#FFC94D' }}>
              {branchAvg != null ? `${branchAvg.toFixed(1)} ★` : '—'}
            </p>
            <p className="text-xs font-medium" style={{ color: '#8FA9C6' }}>điểm TB toàn nhánh</p>
          </div>
        </div>
        <button onClick={exportExcel}
          disabled={responses.length === 0}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'rgba(96,165,250,0.14)', color: '#60A5FA', border: '1px solid rgba(96,165,250,0.3)' }}>
          <i className="ti ti-download" style={{ fontSize: '14px' }} />
          Xuất Excel
        </button>
      </div>

      {loadingResponses ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[rgba(96,165,250,0.3)] border-t-[#3B82F6] rounded-full animate-spin" />
        </div>
      ) : moduleGroups.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: 'rgba(96,165,250,0.12)', border: '1px dashed rgba(96,165,250,0.3)' }}>
          <p className="text-sm font-medium" style={{ color: '#60A5FA' }}>
            Chưa có feedback nào cho nhánh này.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {moduleGroups.map(g => (
            <ModuleCard key={g.moduleId} g={g} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Card 1 module: mở ra là danh sách câu hỏi ── */
function ModuleCard({ g }: { g: ModuleGroup }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl bg-[#0E1526] overflow-hidden" style={{ border: '1px solid rgba(155,196,232,0.2)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[rgba(255,201,77,0.05)]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: '#141E36', color: '#FFC94D', border: '1px solid rgba(155,196,232,0.2)' }}>
            {g.orderIndex}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#EEF3FB' }}>{g.moduleName}</p>
            <p className="text-xs font-medium" style={{ color: '#8FA9C6' }}>
              {g.respondents} học viên · {g.questions.length} câu hỏi
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {g.avgRating != null && (
            <span className="text-sm font-bold" style={{ color: '#FFC94D' }}>
              {g.avgRating.toFixed(1)} ★
            </span>
          )}
          <i className={`ti ti-chevron-down transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            style={{ fontSize: '15px', color: '#8FA9C6' }} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-2" style={{ borderTop: '1px solid rgba(155,196,232,0.16)' }}>
          {g.questions.map(q => (
            <QuestionCard key={q.questionId} q={q} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Card 1 câu hỏi ── */
function QuestionCard({ q }: { q: QuestionGroup }) {
  const [open, setOpen] = useState(false)
  const avg = q.ratings.length > 0
    ? (q.ratings.reduce((a, b) => a + b, 0) / q.ratings.length)
    : null
  const answerCount = q.questionType === 'rating' ? q.ratings.length : q.texts.length

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#141E36', border: '1px solid rgba(155,196,232,0.16)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[rgba(96,165,250,0.08)]"
      >
        <p className="text-sm font-medium flex-1 min-w-0 truncate" style={{ color: '#EEF3FB' }}>
          {q.questionType === 'rating' ? '⭐' : '💬'} {q.questionText}
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          {q.questionType === 'rating' && avg != null ? (
            <span className="text-sm font-bold" style={{ color: '#FFC94D' }}>
              {avg.toFixed(1)} ★
            </span>
          ) : (
            <span className="text-xs font-medium" style={{ color: '#8FA9C6' }}>
              {answerCount} trả lời
            </span>
          )}
          <i className={`ti ti-chevron-down transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            style={{ fontSize: '13px', color: '#8FA9C6' }} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(155,196,232,0.16)' }}>
          {q.questionType === 'rating' ? (
            <div className="flex items-center gap-3 pt-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <span key={star} className="text-lg"
                    style={{ color: avg != null && avg >= star - 0.5 ? '#FFC94D' : '#22304C' }}>★</span>
                ))}
              </div>
              <p className="text-xs" style={{ color: '#8FA9C6' }}>{q.ratings.length} lượt đánh giá</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 pt-3">
              {q.texts.length === 0 ? (
                <p className="text-xs" style={{ color: '#8FA9C6' }}>Chưa có câu trả lời nào.</p>
              ) : q.texts.map((t, i) => (
                <div key={i} className="rounded-lg px-3 py-2" style={{ backgroundColor: '#0E1526', border: '1px solid rgba(155,196,232,0.12)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold" style={{ color: '#60A5FA' }}>{t.name}</p>
                    <p className="text-[10px]" style={{ color: '#8FA9C6' }}>
                      {new Date(t.submittedAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <p className="text-xs whitespace-pre-line" style={{ color: '#EEF3FB' }}>{t.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}