/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'

type ModuleOption = {
  id: number
  name: string
  branch_id: string
}

type FeedbackResponse = {
  id: string
  user_id: string
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

export default function FeedbackReportTab() {
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null)
  const [responses, setResponses] = useState<FeedbackResponse[]>([])
  const [loadingModules, setLoadingModules] = useState(true)
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [error, setError] = useState('')
  const hasFetchedModules = useRef(false)

  useEffect(() => {
    if (hasFetchedModules.current) return
    hasFetchedModules.current = true
    async function loadModules() {
      setLoadingModules(true)
      const res = await fetch('/api/admin/modules-list')
      const data = await res.json()
      if (res.ok) {
        setModules(data.modules ?? [])
        if (data.modules?.length > 0) setSelectedModuleId(data.modules[0].id)
      } else {
        setError(data.error || 'Không tải được danh sách module')
      }
      setLoadingModules(false)
    }
    loadModules()
  }, [])

  useEffect(() => {
    if (!selectedModuleId) return
    async function loadResponses() {
      setLoadingResponses(true)
      setError('')
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Phiên đăng nhập đã hết hạn'); setLoadingResponses(false); return }
      const res = await fetch(`/api/admin/feedback?module_id=${selectedModuleId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (res.ok) setResponses(data.responses ?? [])
      else setError(data.error || 'Không tải được feedback')
      setLoadingResponses(false)
    }
    loadResponses()
  }, [selectedModuleId])

  const questionGroups: QuestionGroup[] = (() => {
    const map: Record<string, QuestionGroup> = {}
    responses.forEach(r => {
      if (!r.question) return
      if (!map[r.question_id]) {
        map[r.question_id] = {
          questionId: r.question_id,
          questionText: r.question.question_text,
          questionType: r.question.question_type,
          ratings: [],
          texts: [],
        }
      }
      if (r.rating_value != null) map[r.question_id].ratings.push(r.rating_value)
      if (r.text_value) {
        map[r.question_id].texts.push({
          name: r.user?.name || 'Không rõ',
          email: r.user?.email || '',
          text: r.text_value,
          submittedAt: r.submitted_at,
        })
      }
    })
    return Object.values(map)
  })()

  const selectedModule = modules.find(m => m.id === selectedModuleId)
  const respondentCount = new Set(responses.map(r => r.user_id)).size

  function exportExcel() {
    if (!selectedModule) return
    const wb = XLSX.utils.book_new()

    const summaryHeader = ['Câu hỏi', 'Loại', 'Số lượt trả lời', 'Điểm TB (nếu rating)']
    const summaryRows = questionGroups.map(q => [
      q.questionText,
      q.questionType === 'rating' ? 'Rating' : 'Text',
      q.questionType === 'rating' ? q.ratings.length : q.texts.length,
      q.questionType === 'rating' && q.ratings.length > 0
        ? (q.ratings.reduce((a, b) => a + b, 0) / q.ratings.length).toFixed(2)
        : '—',
    ])
    const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows])
    wsSummary['!cols'] = [{ wch: 50 }, { wch: 10 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng quan')

    const detailHeader = ['Câu hỏi', 'Học viên', 'Email', 'Rating', 'Câu trả lời', 'Ngày gửi']
    const detailRows = responses.map(r => [
      r.question?.question_text || '',
      r.user?.name || '',
      r.user?.email || '',
      r.rating_value ?? '',
      r.text_value ?? '',
      new Date(r.submitted_at).toLocaleDateString('vi-VN'),
    ])
    const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows])
    wsDetail['!cols'] = [{ wch: 40 }, { wch: 25 }, { wch: 30 }, { wch: 8 }, { wch: 50 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết')

    XLSX.writeFile(wb, `feedback-${selectedModule.name.replace(/\s/g, '-')}.xlsx`)
  }

  if (loadingModules) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  if (modules.length === 0) return (
    <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#EFF6FF', border: '2px dashed #BFDBFE' }}>
      <p className="text-sm font-medium" style={{ color: '#93C5FD' }}>Chưa có module nào.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          <i className="ti ti-alert-circle mr-2" />{error}
        </div>
      )}

      {/* Chọn module */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedModuleId ?? ''}
          onChange={e => setSelectedModuleId(Number(e.target.value))}
          className="rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none bg-white"
          style={{ border: '2px solid #BFDBFE', color: '#1E3A5F' }}
        >
          {modules.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <button onClick={exportExcel}
          disabled={responses.length === 0}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40"
          style={{ backgroundColor: '#EFF6FF', color: '#0E62B1', border: '2px solid #BFDBFE' }}>
          <i className="ti ti-download" style={{ fontSize: '14px' }} />
          Xuất Excel
        </button>
        {responses.length > 0 && (
          <span className="text-xs font-medium" style={{ color: '#93C5FD' }}>
            {respondentCount} học viên đã gửi feedback
          </span>
        )}
      </div>

      {loadingResponses ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : questionGroups.length === 0 ? (
        <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#EFF6FF', border: '2px dashed #BFDBFE' }}>
          <p className="text-sm font-medium" style={{ color: '#93C5FD' }}>
            Chưa có feedback nào cho module này.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {questionGroups.map(q => {
            const avg = q.ratings.length > 0
              ? (q.ratings.reduce((a, b) => a + b, 0) / q.ratings.length)
              : null
            return (
              <div key={q.questionId} className="rounded-2xl p-5 bg-white" style={{ border: '2px solid #BFDBFE' }}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <p className="text-sm font-semibold flex-1" style={{ color: '#1E3A5F' }}>
                    {q.questionType === 'rating' ? '⭐' : '💬'} {q.questionText}
                  </p>
                  {q.questionType === 'rating' && avg != null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold" style={{ color: '#0E62B1' }}>{avg.toFixed(1)}</p>
                      <p className="text-[10px]" style={{ color: '#93C5FD' }}>{q.ratings.length} lượt đánh giá</p>
                    </div>
                  )}
                </div>

                {q.questionType === 'rating' ? (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span key={star} className="text-lg"
                        style={{ color: avg != null && avg >= star - 0.5 ? '#C9A84C' : '#E2E8F0' }}>★</span>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {q.texts.length === 0 ? (
                      <p className="text-xs" style={{ color: '#93C5FD' }}>Chưa có câu trả lời nào.</p>
                    ) : q.texts.map((t, i) => (
                      <div key={i} className="rounded-xl px-3 py-2" style={{ backgroundColor: '#EFF6FF' }}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold" style={{ color: '#0E62B1' }}>{t.name}</p>
                          <p className="text-[10px]" style={{ color: '#93C5FD' }}>
                            {new Date(t.submittedAt).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <p className="text-xs" style={{ color: '#1E3A5F' }}>{t.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
