/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import LessonForm from './LessonForm'

export default function LessonList() {
  const [lessons, setLessons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  async function loadLessons() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setLoading(false); return }

    const res = await fetch('/api/admin/all-lessons', {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()

    if (res.ok) {
      setLessons(data.lessons ?? [])
    } else {
      console.error('Lỗi tải danh sách bài học:', data.error)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadLessons()
  }, [])

  async function handleDelete(lesson: any) {
    const confirmed = window.confirm(
      `Xóa bài "${lesson.title}"?\n\nHành động này sẽ xóa VĨNH VIỄN bài học, cùng toàn bộ tiến độ học tập và bài nộp của học viên liên quan đến bài này. Không thể hoàn tác.`
    )
    if (!confirmed) return

    setDeletingId(lesson.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setDeletingId(null); return }

    const res = await fetch('/api/admin/delete-lesson', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ lessonId: lesson.id })
    })

    if (res.ok) {
      setLessons(prev => prev.filter(l => l.id !== lesson.id))
    } else {
      const data = await res.json()
      alert(`Lỗi khi xóa: ${data.error || 'không rõ nguyên nhân'}`)
    }
    setDeletingId(null)
  }

  function handleEditSaved() {
    setEditingId(null)
    loadLessons() // tải lại danh sách để cập nhật trạng thái xuất bản mới nhất
  }

  if (loading) return <p className="text-sm text-gray-400">Đang tải...</p>
  if (lessons.length === 0) return (
    <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-6 text-center">
      Chưa có bài học nào được tạo.
    </p>
  )

  // Nhóm theo nhánh để dễ nhìn
  const grouped: Record<string, any[]> = {}
  lessons.forEach(l => {
    const key = l.branch?.name || 'Không rõ nhánh'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(l)
  })

  return (
    <>
      <div className="space-y-6">
        {Object.entries(grouped).map(([branchName, branchLessons]) => (
          <div key={branchName}>
            <p className="text-xs font-medium text-gray-400 mb-2 px-1">{branchName}</p>
            <div className="space-y-2">
              {branchLessons.map(lesson => (
                <div key={lesson.id} className="border rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {lesson.order_index}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lesson.title}</p>
                      <p className={`text-xs ${lesson.is_published ? 'text-green-600' : 'text-amber-600'}`}>
                        {lesson.is_published ? 'Đã xuất bản' : 'Chưa xuất bản'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setEditingId(lesson.id)}
                      className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(lesson)}
                      disabled={deletingId === lesson.id}
                      className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-red-50"
                    >
                      {deletingId === lesson.id ? 'Đang xóa...' : 'Xóa'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal sửa bài học */}
      {editingId !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 overflow-y-auto z-50">
          <div className="bg-gray-50 rounded-2xl max-w-2xl w-full my-8 p-5 relative">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium">Sửa bài học</p>
              <button
                onClick={() => setEditingId(null)}
                className="text-gray-400 hover:text-gray-700 text-sm"
              >
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