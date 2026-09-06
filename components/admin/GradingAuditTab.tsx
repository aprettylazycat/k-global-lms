'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type McqQuestionResult = {
  kind: 'mcq'
  order: number
  question: string
  options: string[]
  correctIndex: number
  correctText: string | null
  selectedIndex: number | null
  selectedText: string | null
  isCorrect: boolean | null
  totalAttempts: number
  attemptsUntilCorrect: number | null
}

type TfItemResult = { statement: string; correct: boolean; selected: boolean | null }

type TfGroupResult = {
  kind: 'true_false'
  order: number
  groupQuestion: string
  items: TfItemResult[]
  firstCorrectCount: number
  firstTotalCount: number
  totalAttempts: number
  attemptsUntilAllCorrect: number | null
}

type QuizResult = McqQuestionResult | TfGroupResult

type Row = {
  submissionId: number
  status: string
  attemptNumber: number
  reviewedAt: string | null
  submittedAt?: string | null
  rejectReason: string | null
  answerText?: string | null
  fileUrl?: string | null
  learnerName: string
  learnerEmail: string
  lessonTitle: string
  graderName: string
  graderEmail: string
  mcqResults?: QuizResult[]
}

export default function GradingAuditTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all')
  const [graderFilter, setGraderFilter] = useState<string>('all')
  const [learnerFilter, setLearnerFilter] = useState<string>('all')
  const [viewing, setViewing] = useState<Row | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/admin/grading-audit', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Không xem được — chỉ super admin mới có quyền.'); setLoading(false); return }
      setRows(json.submissions)
      setLoading(false)
    }
    load()
  }, [])

  const graderOptions = Array.from(new Set(rows.map(r => r.graderEmail))).filter(Boolean).sort()
  const learnerOptions = Array.from(new Set(rows.map(r => r.learnerEmail))).filter(Boolean).sort()

  const visibleRows = rows
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => graderFilter === 'all' || r.graderEmail === graderFilter)
    .filter(r => learnerFilter === 'all' || r.learnerEmail === learnerFilter)

  if (loading) return <p className="text-sm text-[#8FA9C6] p-6">Đang tải…</p>
  if (error) return <p className="text-sm text-red-400 p-6">{error}</p>

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-sm font-medium">
          Ai đã chấm bài nào ({visibleRows.length}/{rows.length} bài)
        </h2>
        <div className="flex gap-2 flex-wrap items-center">
          <select value={graderFilter} onChange={e => setGraderFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#1A2542] text-[#EEF3FB] border border-[#233158] focus:outline-none">
            <option value="all">-- Tất cả người chấm --</option>
            {graderOptions.map(email => <option key={email} value={email}>{email}</option>)}
          </select>
          <select value={learnerFilter} onChange={e => setLearnerFilter(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg bg-[#1A2542] text-[#EEF3FB] border border-[#233158] focus:outline-none">
            <option value="all">-- Tất cả học viên --</option>
            {learnerOptions.map(email => <option key={email} value={email}>{email}</option>)}
          </select>
          <div className="flex gap-1">
            {(['all', 'approved', 'rejected'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg ${filter === f ? 'bg-[#1A2542] font-medium' : 'text-[#8FA9C6]'}`}>
                {f === 'all' ? 'Tất cả' : f === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
              </button>
            ))}
          </div>
          {(graderFilter !== 'all' || learnerFilter !== 'all' || filter !== 'all') && (
            <button onClick={() => { setGraderFilter('all'); setLearnerFilter('all'); setFilter('all') }}
              className="text-xs px-3 py-1.5 rounded-lg text-[#F87171] hover:bg-[#1A2542] transition-colors">
              Xoá lọc
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#1A2542]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0D1424] text-[#8FA9C6] text-left">
              <th className="p-3 font-medium">Học viên</th>
              <th className="p-3 font-medium">Bài học</th>
              <th className="p-3 font-medium">Lần nộp</th>
              <th className="p-3 font-medium">Trạng thái</th>
              <th className="p-3 font-medium">Người chấm</th>
              <th className="p-3 font-medium">Thời gian chấm</th>
              <th className="p-3 font-medium">Bài làm</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(r => (
              <tr key={r.submissionId} className="border-t border-[#1A2542]">
                <td className="p-3">
                  <p className="font-medium">{r.learnerName}</p>
                  <p className="text-[#8FA9C6]">{r.learnerEmail}</p>
                </td>
                <td className="p-3">{r.lessonTitle}</td>
                <td className="p-3">{r.attemptNumber}/3</td>
                <td className="p-3">
                  <span className={r.status === 'approved' ? 'text-emerald-400' : 'text-red-400'}>
                    {r.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
                  </span>
                  {r.status === 'rejected' && (
                    <p className="text-[#8FA9C6] mt-0.5 whitespace-pre-line">
                      Lý do: {r.rejectReason || '(Admin chưa ghi lý do)'}
                    </p>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium">{r.graderName}</p>
                  <p className="text-[#8FA9C6]">{r.graderEmail}</p>
                </td>
                <td className="p-3 text-[#8FA9C6]">
                  {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString('vi-VN') : '—'}
                </td>
                <td className="p-3">
                  <div className="flex gap-1.5">
                    {(r.answerText || r.fileUrl || (r.mcqResults && r.mcqResults.length > 0)) && (
                      <button onClick={() => setViewing(r)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1A2542] text-[#EEF3FB] hover:bg-[#233158] transition-colors">
                        Xem bài
                      </button>
                    )}
                    <button onClick={() => window.open(`/admin/print-submission/${r.submissionId}`, '_blank')}
                      title="Xuất PDF"
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1A2542] text-[#EEF3FB] hover:bg-[#233158] transition-colors">
                      Xuất PDF
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 && (
          <p className="text-center text-[#8FA9C6] text-sm p-6">Không có dữ liệu.</p>
        )}
      </div>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={() => setViewing(null)}>
          <div className="rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: '#0D1424', border: '1px solid #1A2542' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold">{viewing.learnerName} — {viewing.lessonTitle}</p>
                <p className="text-xs text-[#8FA9C6] mt-0.5">
                  Lần nộp {viewing.attemptNumber}/3
                  {viewing.submittedAt && ` · Nộp lúc ${new Date(viewing.submittedAt).toLocaleString('vi-VN')}`}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => window.open(`/admin/print-submission/${viewing.submissionId}`, '_blank')}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1A2542] text-[#EEF3FB] hover:bg-[#233158] transition-colors">
                  Xuất PDF
                </button>
                <button onClick={() => setViewing(null)} className="text-[#8FA9C6] hover:text-white text-xl leading-none">×</button>
              </div>
            </div>

            {viewing.mcqResults && viewing.mcqResults.length > 0 && (
              <div className="mb-3 space-y-2">
                <p className="text-xs font-semibold text-[#8FA9C6] uppercase tracking-wide">Câu hỏi trắc nghiệm &amp; Đúng/Sai</p>
                {viewing.mcqResults.map(item => (
                  <div key={item.order} className="rounded-xl p-3" style={{ backgroundColor: '#1A2542' }}>
                    {item.kind === 'mcq' ? (
                      <>
                        <p className="text-xs font-medium mb-1.5">Câu {item.order}: {item.question}</p>
                        <p className="text-xs text-emerald-400">Đáp án đúng: {item.correctText ?? '—'}</p>
                        {item.selectedIndex == null ? (
                          <p className="text-xs text-[#8FA9C6] italic">Lựa chọn lần đầu: học viên chưa làm câu này</p>
                        ) : (
                          <>
                            <p className={`text-xs ${item.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                              Lựa chọn lần đầu: {item.selectedText ?? '—'} {item.isCorrect ? '(Đúng)' : '(Sai)'}
                            </p>
                            <p className="text-xs text-[#8FA9C6] mt-0.5">
                              {item.attemptsUntilCorrect == null
                                ? `Chưa làm đúng (đã thử ${item.totalAttempts} lần)`
                                : item.attemptsUntilCorrect === 1
                                  ? 'Làm đúng ngay lần đầu'
                                  : `Làm đúng ở lần thử thứ ${item.attemptsUntilCorrect} (tổng ${item.totalAttempts} lần thử)`}
                            </p>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium mb-1.5">Câu {item.order} (Đúng/Sai): {item.groupQuestion}</p>
                        {item.items.map((it, idx) => {
                          const answered = it.selected != null
                          const isRight = answered && it.selected === it.correct
                          return (
                            <p key={idx} className={`text-xs mb-0.5 ${!answered ? 'text-[#8FA9C6]' : isRight ? 'text-emerald-400' : 'text-red-400'}`}>
                              - {it.statement} — Đáp án đúng: {it.correct ? 'Đúng' : 'Sai'} · Học viên chọn: {!answered ? 'chưa làm' : it.selected ? 'Đúng' : 'Sai'}
                            </p>
                          )
                        })}
                        {item.totalAttempts === 0 ? (
                          <p className="text-xs text-[#8FA9C6] italic mt-1">Học viên chưa làm nhóm câu này</p>
                        ) : (
                          <p className="text-xs text-[#8FA9C6] mt-1">
                            Lần đầu đúng {item.firstCorrectCount}/{item.firstTotalCount} câu con ·{' '}
                            {item.attemptsUntilAllCorrect == null
                              ? `chưa lần nào đúng hết cả nhóm (đã thử ${item.totalAttempts} lần)`
                              : item.attemptsUntilAllCorrect === 1
                                ? 'đúng hết cả nhóm ngay lần đầu'
                                : `đúng hết cả nhóm ở lần thử thứ ${item.attemptsUntilAllCorrect} (tổng ${item.totalAttempts} lần thử)`}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {viewing.answerText && (
              <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: '#1A2542' }}>
                <p className="text-xs whitespace-pre-line">{viewing.answerText}</p>
              </div>
            )}
            {viewing.fileUrl && (
              <a href={viewing.fileUrl} target="_blank" rel="noreferrer"
                className="text-xs font-medium underline inline-block mb-3" style={{ color: '#C9A84C' }}>
                📎 Xem file đính kèm
              </a>
            )}

            <div className="rounded-xl p-4" style={{ backgroundColor: viewing.status === 'approved' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
              <p className="text-xs font-semibold" style={{ color: viewing.status === 'approved' ? '#34D399' : '#F87171' }}>
                {viewing.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'} bởi {viewing.graderName} ({viewing.graderEmail})
              </p>
              {viewing.status === 'rejected' && (
                <p className="text-xs text-[#8FA9C6] mt-1 whitespace-pre-line">
                  Lý do: {viewing.rejectReason || '(Admin chưa ghi lý do)'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}