/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReviewPanel() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [perfectScores, setPerfectScores] = useState<Record<string, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set())
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())

  useEffect(() => { loadSubmissions() }, [])

  async function loadSubmissions() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const res = await fetch('/api/admin/pending-submissions', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (res.ok) {
      const subs = data.submissions ?? []
      setSubmissions(subs)
      // Auto-expand user đầu tiên
      if (subs.length > 0) {
        setOpenUsers(new Set([subs[0].user_id]))
      }
    }
    setLoading(false)
  }

  async function handleApprove(sub: any, perfectScore: boolean = false) {
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: sub.id, userId: sub.user_id, lessonId: sub.lesson_id, perfectScore })
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

  function toggleUser(userId: string) {
    setOpenUsers(prev => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  function toggleSub(subId: string) {
    setOpenSubs(prev => {
      const next = new Set(prev)
      next.has(subId) ? next.delete(subId) : next.add(subId)
      return next
    })
  }

  if (loading) return <p className="text-sm text-stone-400 py-4 text-center">Đang tải...</p>

  // Group theo user
  const grouped: Record<string, { user: any; subs: any[] }> = {}
  submissions.forEach(sub => {
    if (!grouped[sub.user_id]) grouped[sub.user_id] = { user: sub.user, subs: [] }
    grouped[sub.user_id].subs.push(sub)
  })

  // Filter theo search
  const q = searchText.toLowerCase().trim()
  const filteredGroups = Object.entries(grouped).filter(([, g]) =>
    !q || g.user?.name?.toLowerCase().includes(q) || g.user?.email?.toLowerCase().includes(q)
  )

  return (
    <div className="space-y-4">

      {/* Thanh tìm kiếm */}
      <div className="relative">
        <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" style={{ fontSize: '14px' }} />
        <input
          type="text"
          placeholder="Tìm tên hoặc email học viên..."
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

      {filteredGroups.length === 0 && (
        <p className="text-sm text-stone-400 bg-stone-50 rounded-xl p-6 text-center">
          {submissions.length === 0 ? 'Không có bài nộp nào chờ duyệt.' : 'Không tìm thấy học viên.'}
        </p>
      )}

      {/* Accordion theo user */}
      {filteredGroups.map(([userId, { user, subs }]) => {
        const isUserOpen = openUsers.has(userId)
        return (
          <div key={userId} className="bg-white border border-stone-200 rounded-2xl overflow-hidden">

            {/* Header user */}
            <button
              onClick={() => toggleUser(userId)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-xs font-semibold text-stone-600 flex-shrink-0">
                {user?.name?.split(' ').slice(-1)[0]?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800">{user?.name ?? 'Không rõ'}</p>
                <p className="text-xs text-stone-400">{user?.email}</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700 flex-shrink-0">
                {subs.length} bài chờ
              </span>
              <i className={`ti ti-chevron-down text-stone-400 flex-shrink-0 transition-transform duration-200 ${isUserOpen ? 'rotate-180' : ''}`}
                style={{ fontSize: '14px' }} />
            </button>

            {/* Danh sách bài của user */}
            {isUserOpen && (
              <div className="border-t border-stone-100 divide-y divide-stone-50">
                {subs.map(sub => {
                  const isSubOpen = openSubs.has(sub.id)
                  return (
                    <div key={sub.id}>

                      {/* Header bài */}
                      <button
                        onClick={() => toggleSub(sub.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-stone-700 truncate">{sub.lesson?.title}</p>
                          <p className="text-[11px] text-stone-400 mt-0.5">
                            Nộp lúc {new Date(sub.submitted_at).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <i className={`ti ti-chevron-down text-stone-300 flex-shrink-0 transition-transform duration-200 ${isSubOpen ? 'rotate-180' : ''}`}
                          style={{ fontSize: '13px' }} />
                      </button>

                      {/* Nội dung bài */}
                      {isSubOpen && (
                        <div className="px-4 pb-4 space-y-3">
                          <p className="text-sm text-stone-600 bg-stone-50 rounded-xl p-3 whitespace-pre-line leading-relaxed">
                            {sub.answer_text}
                          </p>

                          {sub.file_url && (
                            <a href={sub.file_url} target="_blank" rel="noreferrer"
                              className="text-xs text-blue-500 underline flex items-center gap-1">
                              <i className="ti ti-paperclip" style={{ fontSize: '12px' }} />
                              Xem file đính kèm
                            </a>
                          )}

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perfectScores[sub.id] ?? false}
                              onChange={e => setPerfectScores(prev => ({ ...prev, [sub.id]: e.target.checked }))}
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm font-medium text-stone-700">⭐ Perfect Score</span>
                          </label>

                          <div className="flex gap-2">
                            <button onClick={() => handleApprove(sub, perfectScores[sub.id] ?? false)}
                              className="flex-1 bg-stone-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-stone-700 transition-colors">
                              ✓ Duyệt
                            </button>
                            <button onClick={() => handleReject(sub)}
                              className="flex-1 border border-stone-200 rounded-xl py-2.5 text-sm text-stone-600 hover:bg-stone-50 transition-colors">
                              Từ chối
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}