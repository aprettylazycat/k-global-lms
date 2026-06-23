/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LessonForm from './LessonForm'

export default function LessonList() {
  const [lessons, setLessons] = useState<any[]>([])
  const [modules, setModules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [publishingId, setPublishingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())

  async function loadData() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const [lessonsRes, modulesRes] = await Promise.all([
      fetch('/api/admin/all-lessons', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      }),
      supabase.from('modules').select('id, name, order_index, branch_id, branches(name)').order('order_index')
    ])

    const lessonsData = await lessonsRes.json()
    if (lessonsRes.ok) setLessons(lessonsData.lessons ?? [])
    if (modulesRes.data) setModules(modulesRes.data)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

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
    if (res.ok) {
      setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_published: newState } : l))
    } else {
      const d = await res.json(); alert(`Lỗi: ${d.error || 'không rõ'}`)
    }
    setPublishingId(null)
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

  if (loading) return <p className="text-sm text-stone-400 py-4 text-center">Đang tải...</p>
  if (lessons.length === 0) return (
    <p className="text-sm text-stone-400 bg-stone-50 rounded-xl p-6 text-center">
      Chưa có bài học nào được tạo.
    </p>
  )

  // Nhóm: branch → module → lessons
  const branchMap: Record<string, { branchName: string; modules: Record<string, { module: any; lessons: any[] }> }> = {}

  lessons.forEach(l => {
    const bName = l.branch?.name || 'Không rõ nhánh'
    const bId = l.branch_id || 'unknown'
    if (!branchMap[bId]) branchMap[bId] = { branchName: bName, modules: {} }

    const mod = modules.find(m => m.id === l.module_id)
    const mKey = mod ? String(mod.id) : 'no-module'
    const mName = mod ? mod.name : 'Chưa gán module'
    const mOrder = mod ? mod.order_index : 999

    if (!branchMap[bId].modules[mKey]) {
      branchMap[bId].modules[mKey] = { module: { id: mKey, name: mName, order_index: mOrder }, lessons: [] }
    }
    branchMap[bId].modules[mKey].lessons.push(l)
  })

  // Sort modules by order_index
  Object.values(branchMap).forEach(branch => {
    Object.values(branch.modules).forEach(mg => {
      mg.lessons.sort((a, b) => a.order_index - b.order_index)
    })
  })

  return (
    <>
      <div className="space-y-8">
        {Object.entries(branchMap).map(([bId, { branchName, modules: modulesInBranch }]) => {
          const sortedModules = Object.values(modulesInBranch).sort((a, b) => a.module.order_index - b.module.order_index)
          const totalLessons = sortedModules.reduce((s, m) => s + m.lessons.length, 0)
          const publishedLessons = sortedModules.reduce((s, m) => s + m.lessons.filter(l => l.is_published).length, 0)

          return (
            <div key={bId}>
              {/* Branch header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">{branchName}</p>
                <p className="text-xs text-stone-400">{publishedLessons}/{totalLessons} đã xuất bản</p>
              </div>

              <div className="space-y-2">
                {sortedModules.map(({ module: mod, lessons: modLessons }) => {
                  const openKey = `${bId}-${mod.id}`
                  const isOpen = openModules.has(openKey)
                  const published = modLessons.filter(l => l.is_published).length
                  const total = modLessons.length
                  const allPublished = published === total

                  return (
                    <div key={mod.id} className="border border-stone-200 rounded-2xl overflow-hidden bg-white">
                      {/* Module accordion header */}
                      <button
                        onClick={() => toggleModule(openKey)}
                        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-stone-50 transition-colors"
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                          allPublished ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                        }`}>
                          {allPublished ? <i className="ti ti-check" style={{fontSize:'11px'}} /> : mod.order_index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-stone-800 truncate">{mod.name}</p>
                          <p className="text-xs text-stone-400 mt-0.5">{published}/{total} bài đã xuất bản</p>
                        </div>
                        {/* Publish all button */}
                        {!allPublished && (
                          <span
                            onClick={async e => {
                              e.stopPropagation()
                              const unpublished = modLessons.filter(l => !l.is_published)
                              const { data: { session } } = await supabase.auth.getSession()
                              if (!session) return
                              await Promise.all(unpublished.map(l =>
                                fetch('/api/admin/publish-lesson', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                                  body: JSON.stringify({ lessonId: l.id, publish: true })
                                })
                              ))
                              setLessons(prev => prev.map(l =>
                                l.module_id === mod.id && l.branch_id === bId ? { ...l, is_published: true } : l
                              ))
                            }}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-800 text-white hover:bg-stone-700 transition-colors flex-shrink-0 cursor-pointer"
                          >
                            Xuất bản tất cả
                          </span>
                        )}
                        <i className={`ti ti-chevron-down text-stone-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          style={{fontSize:'14px'}} />
                      </button>

                      {/* Lesson rows */}
                      {isOpen && (
                        <div className="border-t border-stone-100 divide-y divide-stone-100">
                          {modLessons.map(lesson => (
                            <div key={lesson.id} className="px-4 py-3 flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-[11px] font-semibold flex-shrink-0 text-stone-500">
                                {lesson.order_index}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-stone-800 truncate">{lesson.title}</p>
                                <p className={`text-xs font-medium mt-0.5 ${lesson.is_published ? 'text-green-600' : 'text-amber-600'}`}>
                                  {lesson.is_published ? 'Đã xuất bản' : 'Chưa xuất bản'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {/* Toggle publish */}
                                <button
                                  onClick={() => handleTogglePublish(lesson)}
                                  disabled={publishingId === lesson.id}
                                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
                                    lesson.is_published
                                      ? 'border-stone-200 text-stone-500 hover:bg-stone-50'
                                      : 'border-green-200 text-green-700 hover:bg-green-50'
                                  }`}
                                >
                                  {publishingId === lesson.id ? '...' : lesson.is_published ? 'Bỏ XB' : 'Xuất bản'}
                                </button>
                                <button
                                  onClick={() => setEditingId(lesson.id)}
                                  className="text-[11px] text-stone-600 border border-stone-200 rounded-lg px-2.5 py-1 hover:bg-stone-50 font-medium"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => handleDelete(lesson)}
                                  disabled={deletingId === lesson.id}
                                  className="text-[11px] text-red-600 border border-red-200 rounded-lg px-2.5 py-1 disabled:opacity-40 hover:bg-red-50 font-medium"
                                >
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

      {/* Modal sửa */}
      {editingId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-y-auto z-50">
          <div className="bg-stone-50 rounded-2xl max-w-2xl w-full my-8 p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-stone-800">Sửa bài học</p>
              <button onClick={() => setEditingId(null)} className="text-stone-400 hover:text-stone-700 text-sm">
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