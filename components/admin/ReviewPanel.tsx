/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

function parseAnswerText(text: string) {
  const parts = (text || '').split('\n\n---\n\n')
  const essayPart = parts[0]
  const freeText = parts.slice(1).join('\n\n---\n\n')

  const blocks = essayPart.split(/\n\n(?=Câu hỏi tự luận)/g).filter(Boolean)
  const qas = blocks
    .map(block => {
      const match = block.match(/^Câu hỏi tự luận \d+:\s*([\s\S]*?)\nTrả lời:\s*([\s\S]*)$/)
      return match ? { question: match[1].trim(), answer: match[2].trim() } : null
    })
    .filter(Boolean) as { question: string; answer: string }[]

  return { qas, freeText: qas.length > 0 ? freeText : text }
}


function renderTextWithLinks(text: string) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer"
        className="underline break-all" style={{ color: '#60A5FA' }}
        onClick={e => e.stopPropagation()}>
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default function ReviewPanel() {
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [perfectScores, setPerfectScores] = useState<Record<string, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sortOldestFirst, setSortOldestFirst] = useState(true)
  const [branchFilter, setBranchFilter] = useState('all')
  const [openUsers, setOpenUsers] = useState<Set<string>>(new Set())
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set())
  const [processingId, setProcessingId] = useState<string | null>(null)
  const hasFetched = useRef(false)
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [grantEmail, setGrantEmail] = useState('')
  const [grantLessonTitle, setGrantLessonTitle] = useState('')
  const [grantLoading, setGrantLoading] = useState(false)
  const [grantMessage, setGrantMessage] = useState<string | null>(null)

  async function handleGrantAttempts() {
    if (!grantEmail.trim() || !grantLessonTitle.trim()) return
    setGrantLoading(true)
    setGrantMessage(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setGrantLoading(false); return }

    // Tìm user_id theo email, lesson_id theo tên bài (khớp gần đúng)
    const { data: userRow } = await supabase.from('profiles').select('id, name').eq('email', grantEmail.trim()).maybeSingle()
    if (!userRow) {
      setGrantMessage('Không tìm thấy học viên với email này.')
      setGrantLoading(false)
      return
    }
    const { data: lessonRows } = await supabase.from('lessons').select('id, title').ilike('title', `%${grantLessonTitle.trim()}%`)
    if (!lessonRows || lessonRows.length === 0) {
      setGrantMessage('Không tìm thấy bài học khớp tên này.')
      setGrantLoading(false)
      return
    }
    if (lessonRows.length > 1) {
      setGrantMessage(`Có ${lessonRows.length} bài khớp tên, gõ tên đầy đủ/chính xác hơn: ${lessonRows.map((l: any) => l.title).join(' | ')}`)
      setGrantLoading(false)
      return
    }

    const res = await fetch('/api/admin/grant-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ userId: userRow.id, lessonId: lessonRows[0].id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setGrantMessage(json.error || 'Có lỗi xảy ra.')
    } else {
      setGrantMessage(`Đã gỡ ${json.deletedCount} lượt nộp cũ cho ${userRow.name} — bài "${lessonRows[0].title}". Học viên vào lại là nộp được từ lần 1/3.`)
      setGrantEmail('')
      setGrantLessonTitle('')
    }
    setGrantLoading(false)
  }

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    loadSubmissions()
  }, [])

  async function handleCleanupStorage() {
  if (!confirm('Xóa toàn bộ ảnh đính kèm của các bài đã duyệt/từ chối để tiết kiệm dung lượng? Hành động này KHÔNG thể hoàn tác.')) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  const res = await fetch('/api/admin/cleanup-storage', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}` }
  })
  const data = await res.json()
  if (res.ok) {
    alert(`Đã xóa ${data.deletedCount}/${data.total} ảnh (${data.failedCount} lỗi).`)
  } else {
    alert(`Lỗi: ${data.error}`)
  }
}

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
    setProcessingId(sub.id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ submissionId: sub.id, userId: sub.user_id, lessonId: sub.lesson_id, perfectScore })
    })
    if (res.ok) setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    else { const data = await res.json(); alert(`Lỗi: ${data.error || 'không rõ'}`) }
    setProcessingId(null)
  }

  async function handleReject(sub: any) {
    setProcessingId(sub.id)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ submissionId: sub.id, reason: rejectReasons[sub.id] || '' })
    })
    if (res.ok) setSubmissions(prev => prev.filter(s => s.id !== sub.id))
    else { const data = await res.json(); alert(`Lỗi: ${data.error || 'không rõ'}`) }
    setProcessingId(null)
  }

  function toggleUser(userId: string) {
    setOpenUsers(prev => { const n = new Set(prev); n.has(userId) ? n.delete(userId) : n.add(userId); return n })
  }
  function toggleSub(subId: string) {
    setOpenSubs(prev => { const n = new Set(prev); n.has(subId) ? n.delete(subId) : n.add(subId); return n })
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[rgba(96,165,250,0.3)] border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  const dateFilteredSubmissions = (dateFilter
    ? submissions.filter(sub => {
        if (!sub.submitted_at) return false
        const d = new Date(sub.submitted_at)
        const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
        return localDate === dateFilter
      })
    : submissions
  ).filter(sub => branchFilter === 'all' || sub.user?.branch?.slug === branchFilter)

  const branchOptions = Array.from(
    new Map(
      submissions
        .map(sub => sub.user?.branch)
        .filter(Boolean)
        .map((b: any) => [b.slug, b.name])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const grouped: Record<string, { user: any; subs: any[] }> = {}
  dateFilteredSubmissions.forEach(sub => {
    if (!grouped[sub.user_id]) grouped[sub.user_id] = { user: sub.user, subs: [] }
    grouped[sub.user_id].subs.push(sub)
  })

  const q = searchText.toLowerCase().trim()
  const filteredGroups = Object.entries(grouped)
    .filter(([, g]) =>
      !q || g.user?.name?.toLowerCase().includes(q) || g.user?.email?.toLowerCase().includes(q)
    )
    .sort(([, a], [, b]) => {
      const earliestA = Math.min(...a.subs.map(s => new Date(s.submitted_at).getTime()))
      const earliestB = Math.min(...b.subs.map(s => new Date(s.submitted_at).getTime()))
      return sortOldestFirst ? earliestA - earliestB : earliestB - earliestA
    })

  return (
    <div className="space-y-5">

      {/* Header stats */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
        <div>
          <p className="text-2xl font-bold text-white">
            {dateFilteredSubmissions.length} bài chờ duyệt
            {dateFilter && <span className="text-sm font-normal ml-1">/ {submissions.length} tổng</span>}
          </p>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(96,165,250,0.3)' }}>
            {Object.keys(grouped).length} học viên · Cập nhật mới nhất
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadSubmissions}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#0E1526' }}>
            <i className="ti ti-refresh" style={{ fontSize: '14px' }} />
            Làm mới
          </button>
          <button onClick={handleCleanupStorage}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#0E1526' }}>
            <i className="ti ti-trash" style={{ fontSize: '14px' }} />
            Dọn ảnh cũ
          </button>
        </div>
      </div>

      {/* Gỡ bí học viên bị hết 3/3 lượt nộp bài mà vẫn bị từ chối */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: '#F87171' }}>
          <i className="ti ti-lock-open" style={{ fontSize: '14px', marginRight: '4px' }} />
          Cấp lại lượt nộp bài (dùng khi học viên hết 3/3 lượt mà vẫn bị từ chối)
        </p>
        <p className="text-xs mb-3" style={{ color: '#8FA9C6' }}>
          Xoá sạch lịch sử nộp cũ của đúng học viên + bài học này — họ vào lại sẽ nộp được từ lần 1/3.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input type="text" placeholder="Email học viên..." value={grantEmail}
            onChange={e => setGrantEmail(e.target.value)}
            className="flex-1 min-w-[180px] rounded-xl px-3 py-2 text-sm bg-[#0E1526] focus:outline-none"
            style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#EEF3FB' }} />
          <input type="text" placeholder="Tên bài học (VD: Bài 1.1)..." value={grantLessonTitle}
            onChange={e => setGrantLessonTitle(e.target.value)}
            className="flex-1 min-w-[220px] rounded-xl px-3 py-2 text-sm bg-[#0E1526] focus:outline-none"
            style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#EEF3FB' }} />
          <button onClick={handleGrantAttempts} disabled={grantLoading || !grantEmail.trim() || !grantLessonTitle.trim()}
            className="text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
            style={{ backgroundColor: '#F87171', color: '#0E1526' }}>
            {grantLoading ? 'Đang xử lý...' : 'Cấp lại lượt'}
          </button>
        </div>
        {grantMessage && (
          <p className="text-xs mt-2 whitespace-pre-line" style={{ color: '#8FA9C6' }}>{grantMessage}</p>
        )}
      </div>

      {/* Thanh tìm kiếm + lọc ngày nộp + sắp xếp */}
      <div className="flex gap-2 flex-wrap items-stretch">
        <div className="relative flex-1 min-w-[220px]">
          <i className="ti ti-search absolute left-4 top-1/2 -translate-y-1/2" style={{ fontSize: '15px', color: '#3B82F6' }} />
          <input
            type="text"
            placeholder="Tìm tên hoặc email học viên..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full h-full rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none transition-colors bg-[#0E1526]"
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

        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="rounded-2xl px-4 py-3 text-sm focus:outline-none bg-[#0E1526]"
          style={{ border: '1px solid rgba(96,165,250,0.3)', color: dateFilter ? '#EEF3FB' : '#8FA9C6' }}
        />
        {dateFilter && (
          <button onClick={() => setDateFilter('')}
            className="text-xs px-3 rounded-2xl transition-colors"
            style={{ border: '1px solid rgba(239,68,68,0.3)', color: '#F87171' }}>
            Xoá ngày
          </button>
        )}

        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
          className="rounded-2xl px-4 py-3 text-sm focus:outline-none bg-[#0E1526]"
          style={{ border: '1px solid rgba(96,165,250,0.3)', color: branchFilter === 'all' ? '#8FA9C6' : '#EEF3FB' }}>
          <option value="all">-- Tất cả nhánh --</option>
          {branchOptions.map(([slug, name]) => (
            <option key={slug} value={slug}>{name}</option>
          ))}
        </select>

        <button onClick={() => setSortOldestFirst(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium px-4 py-3 rounded-2xl transition-colors bg-[#0E1526]"
          style={{ border: '1px solid rgba(96,165,250,0.3)', color: '#EEF3FB' }}>
          <i className={`ti ${sortOldestFirst ? 'ti-sort-ascending' : 'ti-sort-descending'}`} style={{ fontSize: '15px' }} />
          {sortOldestFirst ? 'Chờ lâu nhất trước' : 'Mới nộp trước'}
        </button>
      </div>

      {filteredGroups.length === 0 && (
        <div className="bg-[#0E1526] rounded-2xl p-12 text-center"
          style={{ border: '2px solid #EFF6FF' }}>
          <i className="ti ti-inbox-off" style={{ fontSize: '40px', color: 'rgba(96,165,250,0.3)' }} />
          <p className="text-sm mt-3 font-medium" style={{ color: '#60A5FA' }}>
            {submissions.length === 0 ? 'Không có bài nộp nào chờ duyệt.' : 'Không tìm thấy học viên.'}
          </p>
        </div>
      )}

      {/* Accordion theo user */}
      {filteredGroups.map(([userId, { user, subs }]) => {
        const isUserOpen = openUsers.has(userId)
        return (
          <div key={userId} className="bg-[#0E1526] rounded-2xl overflow-hidden shadow-sm"
            style={{ border: '1px solid rgba(96,165,250,0.3)' }}>

            {/* Header user */}
            <button
              onClick={() => toggleUser(userId)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors"
              style={{ backgroundColor: isUserOpen ? 'rgba(96,165,250,0.12)' : '#0E1526' }}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
                {user?.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold" style={{ color: '#EEF3FB' }}>{user?.name ?? 'Không rõ'}</p>
                <p className="text-sm mt-0.5" style={{ color: '#60A5FA' }}>{user?.email}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: 'rgba(96,165,250,0.16)', color: '#3B82F6' }}>
                  {subs.length} bài chờ
                </span>
                <i className={`ti ti-chevron-down transition-transform duration-200 ${isUserOpen ? 'rotate-180' : ''}`}
                  style={{ fontSize: '18px', color: '#3B82F6' }} />
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
                        className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[rgba(96,165,250,0.14)]"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: 'rgba(96,165,250,0.16)', color: '#3B82F6' }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#EEF3FB' }}>
                            {sub.lesson?.title}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#60A5FA' }}>
                            Nộp ngày {new Date(sub.submitted_at).toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${isSubOpen ? 'rotate-180' : ''}`}
                          style={{ fontSize: '16px', color: '#60A5FA' }} />
                      </button>

                      {/* Nội dung bài */}
                      {isSubOpen && (
                        <div className="px-5 pb-5 space-y-4">

                          {/* Bài làm — tách riêng từng câu hỏi/trả lời */}
                          {(() => {
                            const { qas, freeText } = parseAnswerText(sub.answer_text)
                            return (
                              <div className="space-y-3">
                                {qas.map((qa, i) => (
                                  <div key={i} className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(96,165,250,0.12)', border: '1px solid #BFDBFE' }}>
                                    <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#60A5FA' }}>
                                      Câu hỏi {i + 1}
                                    </p>
                                    <p className="text-sm font-semibold mb-3 leading-relaxed whitespace-pre-line" style={{ color: '#EEF3FB' }}>
                                      {qa.question}
                                    </p>
                                    <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#60A5FA' }}>
                                      Trả lời
                                    </p>
                                    <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: '#EEF3FB' }}>
                                      {renderTextWithLinks(qa.answer)}
                                    </p>
                                  </div>
                                ))}
                                {freeText.trim() && (
                                  <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(96,165,250,0.12)', border: '1px solid #BFDBFE' }}>
                                    <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#60A5FA' }}>
                                      Bài thực hành
                                    </p>
                                    {sub.lesson?.practice_prompt && (
                                      <p className="text-sm font-semibold mb-3 leading-relaxed whitespace-pre-line" style={{ color: '#EEF3FB' }}>
                                        {sub.lesson.practice_prompt}
                                      </p>
                                    )}
                                    <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: '#60A5FA' }}>
                                      Trả lời
                                    </p>
                                    <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: '#EEF3FB' }}>
                                      {renderTextWithLinks(freeText)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )
                          })()}

                          {sub.file_url && (
                            <a href={sub.file_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                              style={{ color: '#3B82F6' }}>
                              <i className="ti ti-paperclip" style={{ fontSize: '14px' }} />
                              Xem file đính kèm
                            </a>
                          )}

                          {/* Perfect Score */}
                          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl transition-colors"
                            style={{ border: '1.5px solid #BFDBFE', backgroundColor: perfectScores[sub.id] ? 'rgba(96,165,250,0.12)' : '#0E1526' }}>
                            <input
                              type="checkbox"
                              checked={perfectScores[sub.id] ?? false}
                              onChange={e => setPerfectScores(prev => ({ ...prev, [sub.id]: e.target.checked }))}
                              className="w-4 h-4 rounded"
                            />
                            <div>
                              <p className="text-sm font-semibold" style={{ color: '#EEF3FB' }}>⭐ Perfect Score</p>
                              <p className="text-xs" style={{ color: '#60A5FA' }}>Đánh dấu nếu bài làm xuất sắc</p>
                            </div>
                          </label>

                          {/* Lý do từ chối */}
<textarea
  rows={2}
  placeholder="Lý do từ chối (học viên sẽ thấy khi làm lại)..."
  value={rejectReasons[sub.id] || ''}
  onChange={e => setRejectReasons(prev => ({ ...prev, [sub.id]: e.target.value }))}
  className="w-full text-sm rounded-xl px-3.5 py-2.5 focus:outline-none resize-none"
  style={{ border: '1.5px solid #FECACA' }}
/>

{/* Nút */}
<div className="flex gap-3">
  <button
    onClick={() => handleApprove(sub, perfectScores[sub.id] ?? false)}
    disabled={processingId === sub.id}
    className="flex-1 text-white rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
    style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
    {processingId === sub.id ? (
      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    ) : (
      <><i className="ti ti-check" style={{ fontSize: '16px' }} />Duyệt bài</>
    )}
  </button>
  <button
    onClick={() => handleReject(sub)}
    disabled={processingId === sub.id}
    className="flex-1 rounded-xl py-3 text-sm font-bold transition-colors hover:bg-[rgba(248,113,113,0.14)] disabled:opacity-50 flex items-center justify-center gap-2"
    style={{ border: '2px solid #FECACA', color: '#F87171' }}>
    {processingId === sub.id ? (
      <div className="w-4 h-4 border-2 border-[rgba(248,113,113,0.35)] border-t-red-600 rounded-full animate-spin" />
    ) : (
      <><i className="ti ti-x" style={{ fontSize: '16px' }} />Từ chối</>
    )}
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
