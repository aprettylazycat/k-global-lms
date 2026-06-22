/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReviewPanel() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSubmissions()
  }, [])

  async function loadSubmissions() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const res = await fetch('/api/admin/pending-submissions', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()

    if (res.ok) {
      setSubmissions(data.submissions ?? [])
    } else {
      console.error('Lỗi tải submissions:', data.error)
    }
    setLoading(false)
  }

  async function handleApprove(sub: any) {
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionId: sub.id,
        userId: sub.user_id,
        lessonId: sub.lesson_id
      })
    })
    if (res.ok) {
      setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    } else {
      const data = await res.json()
      alert(`Lỗi khi duyệt: ${data.error || 'không rõ nguyên nhân'}`)
    }
  }

  async function handleReject(sub: any) {
    const res = await fetch('/api/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: sub.id })
    })
    if (res.ok) {
      setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    } else {
      const data = await res.json()
      alert(`Lỗi khi từ chối: ${data.error || 'không rõ nguyên nhân'}`)
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Đang tải...</p>
  if (submissions.length === 0) return (
    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-6 text-center">
      Không có bài nộp nào chờ duyệt.
    </p>
  )

  return (
    <div className="space-y-3">
      {submissions.map(sub => (
        <div key={sub.id} className="border rounded-xl p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium">{sub.user?.name}</p>
              <p className="text-xs text-gray-400">{sub.lesson?.title}</p>
            </div>
            <span className="text-xs text-gray-400">
              {new Date(sub.submitted_at).toLocaleDateString('vi-VN')}
            </span>
          </div>

          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3 whitespace-pre-line">
            {sub.answer_text}
          </p>

          {sub.file_url && (
            <a href={sub.file_url} target="_blank" rel="noreferrer"
              className="text-xs text-blue-500 underline block mb-3">
              Xem file đính kèm →
            </a>
          )}

          <div className="flex gap-2">
            <button onClick={() => handleApprove(sub)}
              className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium">
              ✓ Duyệt
            </button>
            <button onClick={() => handleReject(sub)}
              className="flex-1 border rounded-lg py-2 text-sm text-gray-600">
              Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}