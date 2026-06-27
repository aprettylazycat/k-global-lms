/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LessonForm from './LessonForm'

export default function LessonList() {
  const [lessons, setLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())
  const [activeBranch, setActiveBranch] = useState<string>('all')
  const hasFetched = useRef(false)

  async function loadData() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }
    const res = await fetch('/api/admin/all-lessons', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (res.ok) setLessons(data.lessons ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    loadData()
  }, [])

  async function handleDelete(lesson: any) {
    const confirmed = window.confirm(
      `Xóa bài "${lesson.title}"?\n\nHành động này sẽ xóa VĨNH VIỄN bài học, cùng toàn bộ tiến độ học tập và bài nộp của học viên liên quan. Không thể hoàn tác.`
    )
    if (!confirmed) return
    setDeletingId(lesson.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setDeletingId(null); return }
    const res = await fetch('/api/admin/delete-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ lessonId: lesson.id })
    })
    if (res.ok) setLessons(prev => prev.filter(l => l.id !== lesson.id))
    else { const d = await res.json(); alert(`Lỗi khi xóa: ${d.error || 'không rõ nguyên nhân'}`) }
    setDeletingId(null)
  }

  async function handleTogglePublish(lesson: any) {
    setPublishingId(lesson.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setPublishingId(null); return }
    const newState = !lesson.is_published
    const res = await fetch('/api/admin/publish-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ lessonId: lesson.id, publish: newState })
    })
    if (res.ok) setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_published: newState } : l))
    else { const d = await res.json(); alert(`Lỗi: ${d.error || 'không rõ'}`) }
    setPublishingId(null)
  }

  async function handlePublishAll(modLessons: any[]) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const unpublished = modLessons.filter(l => !l.is_published)
    await Promise.all(unpublished.map(l =>
      fetch('/api/admin/publish-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ lessonId: l.id, publish: true })
      })
    ))
    setLessons(prev => prev.map(l =>
      modLessons.find(ml => ml.id === l.id) ? { ...l, is_published: true } : l
    ))
  }

  function toggleModule(key: string) {
    setOpenModules(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleEditSaved() {
    setEditingId(null)
    loadData()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  // Nhóm: branch → module → lessons
  const branchMap: Record<string, {
    branchName: string
    modules: Record<string, { modName: string; modOrder: number; lessons: any[] }>
  }> = {}

  lessons.forEach(l => {
    const bId = l.branch_id || 'unknown'
    const bName = l.branch?.name || 'Không rõ nhánh'
    const mId = l.module?.id ? String(l.module.id) : 'no-module'
    const mName = l.module?.name || 'Chưa gán module'
    const mOrder = l.module?.order_index ?? 999
    if (!branchMap[bId]) branchMap[bId] = { branchName: bName, modules: {} }
    if (!branchMap[bId].modules[mId]) branchMap[bId].modules[mId] = { modName: mName, modOrder: mOrder, lessons: [] }
    branchMap[bId].modules[mId].lessons.push(l)
  })

  Object.values(branchMap).forEach(branch => {
    Object.values(branch.modules).forEach(mg => {
      mg.lessons.sort((a, b) => a.order_index - b.order_index)
    })
  })

  const allBranches = Object.entries(branchMap)
  const filteredBranches = activeBranch === 'all'
    ? allBranches
    : allBranches.filter(([bId]) => bId === activeBranch)

  const totalAll = lessons.length
  const publishedAll = lessons.filter(l => l.is_published).length

  if (lessons.length === 0) return (
    <div className="bg-white rounded-2xl p-12 text-center" style={{ border: '2px solid #E7EDF3' }}>
      <i className="ti ti-books-off" style={{ fontSize: '40px', color: '#8AABC8' }} />
      <p className="text-sm mt-3 font-medium" style={{ color: '#8AABC8' }}>Chưa có bài học nào được tạo.</p>
    </div>
  )

  return (
    <>
      <div className="space-y-5">

        {/* Header stats */}
        <div className="rounded-2xl p-5 flex items-center justify-between"
          style={{ backgroundColor: '#466898' }}>
          <div>
            <p className="text-2xl font-bold text-white">{publishedAll}/{totalAll} bài đã xuất bản</p>
            <p className="text-sm mt-0.5" style={{ color: '#8AABC8' }}>
              {allBranches.length} nhánh · {Object.values(branchMap).reduce((s, b) => s + Object.keys(b.modules).length, 0)} module
            </p>
          </div>
          <button onClick={loadData}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
            <i className="ti ti-refresh" style={{ fontSize: '14px' }} />
            Làm mới
          </button>
        </div>

        {/* Filter nhánh */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveBranch('all')}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: activeBranch === 'all' ? '#466898' : 'white',
              color: activeBranch === 'all' ? 'white' : '#466898',
              border: '2px solid #466898'
            }}>
            Tất cả
          </button>
          {allBranches.map(([bId, { branchName }]) => (
            <button key={bId}
              onClick={() => setActiveBranch(bId)}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: activeBranch === bId ? '#466898' : 'white',
                color: activeBranch === bId ? 'white' : '#466898',
                border: '2px solid #466898'
              }}>
              {branchName}
            </button>
          ))}
        </div>

        {/* Danh sách theo nhánh */}
        {filteredBranches.map(([bId, { branchName, modules: modulesInBranch }]) => {
          const sortedModules = Object.entries(modulesInBranch)
            .sort(([, a], [, b]) => a.modOrder - b.modOrder)
          const totalLessons = sortedModules.reduce((s, [, m]) => s + m.lessons.length, 0)
          const publishedLessons = sortedModules.reduce((s, [, m]) => s + m.lessons.filter(l => l.is_published).length, 0)

          return (
            <div key={bId}>
              {/* Branch header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#466898' }}>
                  {branchName}
                </p>
                <p className="text-xs font-medium" style={{ color: '#8AABC8' }}>
                  {publishedLessons}/{totalLessons} đã xuất bản
                </p>
              </div>

              <div className="space-y-2">
                {sortedModules.map(([mKey, modData]) => {
                  const openKey = `${bId}-${mKey}`
                  const isOpen = openModules.has(openKey)
                  const published = modData.lessons.filter(l => l.is_published).length
                  const total = modData.lessons.length
                  const allPublished = published === total

                  return (
                    <div key={openKey} className="rounded-2xl overflow-hidden bg-white shadow-sm"
                      style={{ border: '2px solid #E7EDF3' }}>

                      {/* Module header */}
                      <button
                        onClick={() => toggleModule(openKey)}
                        className="w-full px-5 py-4 flex items-center gap-3 text-left transition-colors"
                        style={{ backgroundColor: isOpen ? '#F0F4F8' : 'white' }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            backgroundColor: allPublished ? '#E8F5E9' : '#EEF2F7',
                            color: allPublished ? '#2E7D32' : '#466898'
                          }}>
                          {allPublished
                            ? <i className="ti ti-check" style={{ fontSize: '12px' }} />
                            : modData.modOrder}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#1E3A5F' }}>
                            {modData.modName}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#8AABC8' }}>
                            {published}/{total} bài đã xuất bản
                          </p>
                        </div>
                        {!allPublished && (
                          <button
                            onClick={e => { e.stopPropagation(); handlePublishAll(modData.lessons) }}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                            style={{ backgroundColor: '#466898', color: 'white' }}>
                            Xuất bản tất cả
                          </button>
                        )}
                        <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          style={{ fontSize: '16px', color: '#8AABC8' }} />
                      </button>

                      {/* Lesson rows */}
                      {isOpen && (
                        <div style={{ borderTop: '2px solid #EEF2F7' }}>
                          {modData.lessons.map((lesson, idx) => (
                            <div key={lesson.id}
                              className="px-5 py-3.5 flex items-center gap-3"
                              style={{ borderTop: idx > 0 ? '1px solid #EEF2F7' : 'none' }}>
                              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: '#EEF2F7', color: '#466898' }}>
                                {lesson.order_index}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate" style={{ color: '#1E3A5F' }}>
                                  {lesson.title}
                                </p>
                                <p className="text-xs font-medium mt-0.5"
                                  style={{ color: lesson.is_published ? '#2E7D32' : '#B45309' }}>
                                  {lesson.is_published ? '● Đã xuất bản' : '○ Chưa xuất bản'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                  onClick={() => handleTogglePublish(lesson)}
                                  disabled={publishingId === lesson.id}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
                                  style={lesson.is_published
                                    ? { borderColor: '#E7EDF3', color: '#466898' }
                                    : { borderColor: '#BBF7D0', color: '#15803D', backgroundColor: '#F0FDF4' }}>
                                  {publishingId === lesson.id ? '...' : lesson.is_published ? 'Bỏ XB' : 'Xuất bản'}
                                </button>
                                <button
                                  onClick={() => setEditingId(lesson.id)}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                                  style={{ borderColor: '#E7EDF3', color: '#466898' }}>
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleDelete(lesson)}
                                  disabled={deletingId === lesson.id}
                                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
                                  style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                                  {deletingId === lesson.id ? '...' : 'Xóa'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal sửa bài */}
      {editingId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-y-auto z-50">
          <div className="bg-stone-50 rounded-2xl max-w-2xl w-full my-8 p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: '#1E3A5F' }}>Sửa bài học</p>
              <button onClick={() => setEditingId(null)}
                className="text-sm font-medium"
                style={{ color: '#8AABC8' }}>
                ✕ Đóng
              </button>
            </div>
            <LessonForm lessonId={editingId} onSaved={handleEditSaved} />
          </div>
        </div>
      )}
    </>
  )
}