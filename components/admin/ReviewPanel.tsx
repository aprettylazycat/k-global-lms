/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReviewPanel() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [perfectScores, setPerfectScores] = useState<Record<string, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set())
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())
  // Chỉ fetch 1 lần khi mount — bấm "Làm mới" mới fetch lại
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
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
      const subs = data.submissions ?? []
      setSubmissions(subs)
      if (subs.length > 0) setOpenUsers(new Set([subs[0].user_id]))
    }
    setLoading(false)
  }
  

  async function handleApprove(sub: any, perfectScore: boolean = false) {
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: sub.id, userId: sub.user_id, lessonId: sub.lesson_id, perfectScore })
    })
    if (res.ok) setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    else { const data = await res.json(); alert(`Lỗi: ${data.error || 'không rõ'}`) }
  }

  async function handleReject(sub: any) {
    const res = await fetch('/api/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: sub.id })
    })
    if (res.ok) setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    else { const data = await res.json(); alert(`Lỗi: ${data.error || 'không rõ'}`) }
  }

  function toggleUser(userId: string) {
    setOpenUsers(prev => { const n = new Set(prev); n.has(userId) ? n.delete(userId) : n.add(userId); return n })
  }
  function toggleSub(subId: string) {
    setOpenSubs(prev => { const n = new Set(prev); n.has(subId) ? n.delete(subId) : n.add(subId); return n })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  const grouped: Record<string, { user: any; subs: any[] }> = {}
  submissions.forEach(sub => {
    if (!grouped[sub.user_id]) grouped[sub.user_id] = { user: sub.user, subs: [] }
    grouped[sub.user_id].subs.push(sub)
  })

  const q = searchText.toLowerCase().trim()
  const filteredGroups = Object.entries(grouped).filter(([, g]) =>
    !q || g.user?.name?.toLowerCase().includes(q) || g.user?.email?.toLowerCase().includes(q)
  )

  return (
    <div className="space-y-5">

      {/* Header stats */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{ backgroundColor: '#0E62B1' }}>
        <div>
          <p className="text-2xl font-bold text-white">{submissions.length} bài chờ duyệt</p>
          <p className="text-sm mt-0.5" style={{ color: '#BFDBFE' }}>
            {Object.keys(grouped).length} học viên · Cập nhật mới nhất
          </p>
        </div>
        <button onClick={loadSubmissions}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
          <i className="ti ti-refresh" style={{ fontSize: '14px' }} />
          Làm mới
        </button>
      </div>

      {/* Thanh tìm kiếm */}
      <div className="relative">
        <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2" style={{ fontSize: '15px', color: '#0E62B1' }} />
        <input
          type="text"
          placeholder="Tìm tên hoặc email học viên..."
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

      {filteredGroups.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center"
          style={{ border: '2px solid #EFF6FF' }}>
          <i className="ti ti-inbox-off" style={{ fontSize: '40px', color: '#BFDBFE' }} />
          <p className="text-sm mt-3 font-medium" style={{ color: '#93C5FD' }}>
            {submissions.length === 0 ? 'Không có bài nộp nào chờ duyệt.' : 'Không tìm thấy học viên.'}
          </p>
        </div>
      )}

      {/* Accordion theo user */}
      {filteredGroups.map(([userId, { user, subs }]) => {
        const isUserOpen = openUsers.has(userId)
        return (
          <div key={userId} className="bg-white rounded-2xl overflow-hidden shadow-sm"
            style={{ border: '2px solid #BFDBFE' }}>

            {/* Header user */}
            <button
              onClick={() => toggleUser(userId)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
              style={{ backgroundColor: isUserOpen ? '#EFF6FF' : 'white' }}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: '#0E62B1' }}>
                {user?.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold" style={{ color: '#1E3A5F' }}>{user?.name ?? 'Không rõ'}</p>
                <p className="text-sm mt-0.5" style={{ color: '#60A5FA' }}>{user?.email}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: '#DBEAFE', color: '#0E62B1' }}>
                  {subs.length} bài chờ
                </span>
                <i className={`ti ti-chevron-down transition-transform duration-200 ${isUserOpen ? 'rotate-180' : ''}`}
                  style={{ fontSize: '18px', color: '#0E62B1' }} />
              </div>
            </button>

            {/* Danh sách bài */}
            {isUserOpen && (
              <div style={{ borderTop: '2px solid #EFF6FF' }}>
                {subs.map((sub, idx) => {
                  const isSubOpen = openSubs.has(sub.id)
                  return (
                    <div key={sub.id} style={{ borderTop: idx > 0 ? '1px solid #EFF6FF' : 'none' }}>

                      {/* Header bài */}
                      <button
                        onClick={() => toggleSub(sub.id)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-blue-50"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#DBEAFE', color: '#0E62B1' }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1E3A5F' }}>
                            {sub.lesson?.title}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#93C5FD' }}>
                            Nộp ngày {new Date(sub.submitted_at).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${isSubOpen ? 'rotate-180' : ''}`}
                          style={{ fontSize: '16px', color: '#93C5FD' }} />
                      </button>

                      {/* Nội dung bài */}
                      {isSubOpen && (
                        <div className="px-5 pb-5 space-y-4">

                          {/* Bài làm */}
                          <div className="rounded-2xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#60A5FA' }}>
                              Bài làm
                            </p>
                            <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: '#1E3A5F' }}>
                              {sub.answer_text}
                            </p>
                          </div>

                          {sub.file_url && (
                            <a href={sub.file_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                              style={{ color: '#0E62B1' }}>
                              <i className="ti ti-paperclip" style={{ fontSize: '14px' }} />
                              Xem file đính kèm
                            </a>
                          )}

                          {/* Perfect Score */}
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors"
                            style={{ border: '1.5px solid #BFDBFE', backgroundColor: perfectScores[sub.id] ? '#EFF6FF' : 'white' }}>
                            <input
                              type="checkbox"
                              checked={perfectScores[sub.id] ?? false}
                              onChange={e => setPerfectScores(prev => ({ ...prev, [sub.id]: e.target.checked }))}
                              className="w-4 h-4 rounded"
                            />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: '#1E3A5F' }}>⭐ Perfect Score</p>
                              <p className="text-xs" style={{ color: '#93C5FD' }}>Đánh dấu nếu bài làm xuất sắc</p>
                            </div>
                          </label>

                          {/* Nút */}
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleApprove(sub, perfectScores[sub.id] ?? false)}
                              className="flex-1 text-white rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                              style={{ backgroundColor: '#0E62B1' }}>
                              <i className="ti ti-check" style={{ fontSize: '16px' }} />
                              Duyệt bài
                            </button>
                            <button
                              onClick={() => handleReject(sub)}
                              className="flex-1 rounded-xl py-3 text-sm font-bold transition-colors hover:bg-red-50 flex items-center justify-center gap-2"
                              style={{ border: '2px solid #FECACA', color: '#DC2626' }}>
                              <i className="ti ti-x" style={{ fontSize: '16px' }} />
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