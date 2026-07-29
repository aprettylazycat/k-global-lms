'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Row = {
  submissionId: number
  status: string
  attemptNumber: number
  reviewedAt: string | null
  rejectReason: string | null
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
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 && (
          <p className="text-center text-[#8FA9C6] text-sm p-6">Không có dữ liệu.</p>
        )}
      </div>
    </div>
  )
}