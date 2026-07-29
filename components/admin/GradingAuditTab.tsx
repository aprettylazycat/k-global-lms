'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
}

export default function GradingAuditTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all')
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

  const visibleRows = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  if (loading) return <p className="text-sm text-[#8FA9C6] p-6">Đang tải…</p>
  if (error) return <p className="text-sm text-red-400 p-6">{error}</p>

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium">Ai đã chấm bài nào ({rows.length} bài đã chấm)</h2>
        <div className="flex gap-1">
          {(['all', 'approved', 'rejected'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg ${filter === f ? 'bg-[#1A2542] font-medium' : 'text-[#8FA9C6]'}`}>
              {f === 'all' ? 'Tất cả' : f === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
            </button>
          ))}
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
                  {(r.answerText || r.fileUrl) ? (
                    <button onClick={() => setViewing(r)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1A2542] text-[#EEF3FB] hover:bg-[#233158] transition-colors">
                      Xem bài
                    </button>
                  ) : (
                    <span className="text-[#8FA9C6]">—</span>
                  )}
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
              <button onClick={() => setViewing(null)} className="text-[#8FA9C6] hover:text-white text-xl leading-none">×</button>
            </div>

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