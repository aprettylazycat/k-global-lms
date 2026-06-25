/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Branch } from '@/types'

type ModuleOption = { id: number; name: string }

export default function LessonForm({ lessonId, onSaved }: { lessonId?: number; onSaved?: () => void }) {
  const isEditMode = !!lessonId

  const [branches, setBranches] = useState<Branch[]>([])
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [loadingModules, setLoadingModules] = useState(false)
  const [form, setForm] = useState({
    title: '', branch_id: '', module_id: '', order_index: 1,
    youtube_id: '', intro_text: '', practice_prompt: ''
  })
  const [mcqs, setMcqs] = useState([
    { question: '', options: ['', '', '', ''], correct: 0 }
  ])
  const [essays, setEssays] = useState<{ question: string }[]>([])
  const [isPublished, setIsPublished] = useState(true)
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingLesson, setLoadingLesson] = useState(isEditMode)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    supabase.from('branches').select('*').then(({ data }) => {
      if (data) setBranches(data)
    })
  }, [])

  // Tải danh sách module mỗi khi nhánh thay đổi
  useEffect(() => {
    if (!form.branch_id) {
      setModules([])
      return
    }
    setLoadingModules(true)
    fetch(`/api/admin/modules-list?branch_id=${form.branch_id}`)
      .then(res => res.json())
      .then(data => setModules(data.modules ?? []))
      .finally(() => setLoadingModules(false))
  }, [form.branch_id])

  // Chế độ edit: nạp dữ liệu bài học cũ
  useEffect(() => {
    if (!lessonId) return

    async function loadLesson() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoadingLesson(false); return }

      const res = await fetch(`/api/admin/get-lesson?id=${lessonId}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()

      if (res.ok && data.lesson) {
        const l = data.lesson
        setForm({
          title: l.title || '',
          branch_id: l.branch_id || '',
          module_id: l.module_id ? String(l.module_id) : '',
          order_index: l.order_index || 1,
          youtube_id: l.youtube_id || '',
          intro_text: l.intro_text || '',
          practice_prompt: l.practice_prompt || ''
        })
        const loadedMcqs = (l.questions || []).filter((q: any) => q.type === 'mcq')
        const loadedEssays = (l.questions || []).filter((q: any) => q.type === 'essay')
        setMcqs(loadedMcqs.length > 0 ? loadedMcqs : [{ question: '', options: ['', '', '', ''], correct: 0 }])
        setEssays(loadedEssays.length > 0 ? loadedEssays : [])
        setIsPublished(!!l.is_published)
        setAttachmentUrl(l.attachment_url || '')
      } else {
        alert(`Không tải được bài học: ${data.error || 'lỗi không rõ'}`)
      }
      setLoadingLesson(false)
    }
    loadLesson()
  }, [lessonId])

  async function handlePublish() {
    if (!form.title || !form.branch_id) {
      alert('Vui lòng điền tiêu đề và chọn nhánh')
      return
    }
    setLoading(true)
    // Upload PDF nếu có file mới chọn
    let finalAttachmentUrl = attachmentUrl
    if (attachmentFile) {
      setUploadingPdf(true)
      const path = `lessons/${Date.now()}_${attachmentFile.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lesson-attachments')
        .upload(path, attachmentFile, { upsert: true })
      if (uploadError) {
        alert(`Lỗi upload PDF: ${uploadError.message}`)
        setLoading(false)
        setUploadingPdf(false)
        return
      }
      const { data: urlData } = supabase.storage
        .from('lesson-attachments')
        .getPublicUrl(uploadData.path)
      finalAttachmentUrl = urlData.publicUrl
      setAttachmentUrl(finalAttachmentUrl)
      setUploadingPdf(false)
    }

    const questions = [
      ...mcqs.map((q, i) => ({ id: i + 1, type: 'mcq', ...q })),
      ...essays.map((q, i) => ({ id: mcqs.length + i + 1, type: 'essay', ...q }))
    ]

    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      alert('Phiên đăng nhập hết hạn, vui lòng đăng nhập lại')
      setLoading(false)
      return
    }

    const endpoint = isEditMode ? '/api/admin/update-lesson' : '/api/admin/publish-lesson'
    const payload = isEditMode
      ? { lessonId, ...form, module_id: form.module_id || null, attachment_url: finalAttachmentUrl || null, questions, is_published: isPublished }
      : { ...form, module_id: form.module_id || null, attachment_url: finalAttachmentUrl || null, questions, is_published: isPublished }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    })

    const result = await res.json()

    if (!res.ok) {
      alert(`Lỗi: ${result.error || 'Không lưu được bài học'}`)
      setLoading(false)
      return
    }

    if (isEditMode) {
      setSuccess(`Đã lưu thay đổi cho "${form.title}"`)
      onSaved?.()
    } else {
      setSuccess(`Đã ${isPublished ? 'xuất bản' : 'lưu nháp'} "${form.title}"`)
      setForm({ title: '', branch_id: '', module_id: '', order_index: 1, youtube_id: '', intro_text: '', practice_prompt: '' })
      setMcqs([{ question: '', options: ['', '', '', ''], correct: 0 }])
      setEssays([{ question: '' }])
      setIsPublished(true)
    }
    setLoading(false)
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors"
  const labelCls = "text-xs font-medium text-gray-500 block mb-1.5"

  if (loadingLesson) {
    return <div className="text-sm text-gray-400 p-8 text-center">Đang tải bài học...</div>
  }

  return (
    <div className="space-y-5">
      {/* Card 1: Thông tin cơ bản */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium mb-4">Thông tin bài học</p>

        <label className={labelCls}>Tiêu đề bài học</label>
        <input className={`${inputCls} mb-4`}
          placeholder="Bài 1: Giới thiệu kỹ thuật smock"
          value={form.title} onChange={e => setForm({...form, title: e.target.value})} />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>Nhánh đào tạo</label>
            <select className={inputCls}
              value={form.branch_id}
              onChange={e => setForm({...form, branch_id: e.target.value, module_id: ''})}>
              <option value="">Chọn nhánh...</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Thứ tự bài</label>
            <input type="number" min={1} className={inputCls}
              value={form.order_index}
              onChange={e => setForm({...form, order_index: parseInt(e.target.value)})} />
          </div>
        </div>

        <label className={labelCls}>Module</label>
        <select className={`${inputCls} mb-4`}
          value={form.module_id}
          disabled={!form.branch_id || loadingModules}
          onChange={e => setForm({...form, module_id: e.target.value})}>
          <option value="">
            {!form.branch_id ? 'Chọn nhánh trước...' : loadingModules ? 'Đang tải module...' : 'Không thuộc module nào'}
          </option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <label className={labelCls}>YouTube video ID</label>
        <input className={`${inputCls} mb-4`}
          placeholder="dQw4w9WgXcQ"
          value={form.youtube_id} onChange={e => setForm({...form, youtube_id: e.target.value})} />

        <label className={labelCls}>Nội dung giới thiệu</label>
        <textarea rows={3} className={inputCls}
          placeholder="Mô tả ngắn gọn nội dung bài học..."
          value={form.intro_text} onChange={e => setForm({...form, intro_text: e.target.value})} />
      </div>

      {/* Card 2: MCQ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Câu hỏi trắc nghiệm</p>
            <p className="text-xs text-gray-400 mt-0.5">{mcqs.length}/5 câu</p>
          </div>
          {mcqs.length < 5 && (
            <button
              onClick={() => setMcqs([...mcqs, { question: '', options: ['','','',''], correct: 0 }])}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-full flex items-center gap-1"
            >
              <i className="ti ti-plus" style={{fontSize:'12px'}} /> Thêm
            </button>
          )}
        </div>

        <div className="space-y-3">
          {mcqs.map((mcq, qi) => (
            <div key={qi} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-400">Câu {qi + 1}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Tick vào đáp án đúng</span>
                  {mcqs.length > 1 && (
                    <button onClick={() => setMcqs(mcqs.filter((_, i) => i !== qi))} className="text-gray-300 hover:text-red-500">
                      <i className="ti ti-x" style={{fontSize:'14px'}} />
                    </button>
                  )}
                </div>
              </div>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 bg-white"
                placeholder="Nhập câu hỏi..." value={mcq.question}
                onChange={e => { const u = [...mcqs]; u[qi].question = e.target.value; setMcqs(u) }} />
              <div className="grid grid-cols-2 gap-2">
                {mcq.options.map((opt: string, oi: number) => {
                  const isCorrect = mcq.correct === oi
                  return (
                    <div key={oi}
                      onClick={() => { const u = [...mcqs]; u[qi].correct = oi; setMcqs(u) }}
                      className={`flex items-center gap-2 border rounded-lg px-2.5 py-1.5 cursor-pointer transition-all ${
                        isCorrect ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300'
                      }`}>
                        {isCorrect && <i className="ti ti-check text-white" style={{fontSize:'11px'}} />}
                      </span>
                      <span className={`text-xs font-medium flex-shrink-0 ${isCorrect ? 'text-green-700' : 'text-gray-400'}`}>
                        {['A','B','C','D'][oi]}
                      </span>
                      <input
                        className="flex-1 min-w-0 text-sm bg-transparent outline-none"
                        placeholder="Đáp án..." value={opt}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const u = [...mcqs]; u[qi].options[oi] = e.target.value; setMcqs(u)
                        }} />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 3: Essay */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Câu hỏi tự luận</p>
            <p className="text-xs text-gray-400 mt-0.5">{essays.length}/5 câu</p>
          </div>
          {essays.length < 5 && (
            <button
              onClick={() => setEssays([...essays, { question: '' }])}
              className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-full flex items-center gap-1"
            >
              <i className="ti ti-plus" style={{fontSize:'12px'}} /> Thêm
            </button>
          )}
        </div>

        <div className="space-y-2">
          {essays.map((eq, qi) => (
            <div key={qi} className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                {qi + 1}
              </span>
              <input className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Câu hỏi tự luận..." value={eq.question}
                onChange={e => { const u = [...essays]; u[qi].question = e.target.value; setEssays(u) }} />
              {essays.length > 1 && (
                <button onClick={() => setEssays(essays.filter((_, i) => i !== qi))} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                  <i className="ti ti-x" style={{fontSize:'14px'}} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card 4: Bài tập thực hành */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium mb-3">Bài tập thực hành</p>
        <textarea rows={2} className={inputCls}
          placeholder="Mô tả yêu cầu bài tập học viên cần nộp..."
          value={form.practice_prompt}
          onChange={e => setForm({...form, practice_prompt: e.target.value})} />
      </div>
{/* Card 4b: Tài liệu đính kèm */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-sm font-medium mb-1">Tài liệu đính kèm (PDF)</p>
        <p className="text-xs text-gray-400 mb-3">Học viên sẽ xem được tài liệu ngay trong bài học qua Google Docs Viewer.</p>

        {attachmentUrl && (
          <div className="flex items-center gap-2 mb-3 p-3 bg-blue-50 rounded-xl">
            <i className="ti ti-file-type-pdf text-blue-600" style={{fontSize:'16px'}} />
            <a href={attachmentUrl} target="_blank" rel="noreferrer"
              className="text-xs text-blue-600 underline truncate flex-1">
              {attachmentUrl.split('/').pop()}
            </a>
            <button onClick={() => { setAttachmentUrl(''); setAttachmentFile(null) }}
              className="text-gray-400 hover:text-red-500 flex-shrink-0">
              <i className="ti ti-x" style={{fontSize:'14px'}} />
            </button>
          </div>
        )}

        <label className="block border border-dashed border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-400 transition-colors">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <i className="ti ti-upload" />
            {attachmentFile ? attachmentFile.name : attachmentUrl ? 'Thay thế file khác' : 'Chọn file PDF'}
          </div>
          <input type="file" accept=".pdf" className="hidden"
            onChange={e => setAttachmentFile(e.target.files?.[0] ?? null)} />
        </label>
        {uploadingPdf && <p className="text-xs text-gray-400 mt-2">Đang upload PDF...</p>}
      </div>

      {/* Card 5: Xuất bản */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={e => setIsPublished(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <div>
            <p className="text-sm font-medium">Xuất bản bài học này</p>
            <p className="text-xs text-gray-400">
              {isPublished ? 'Học viên sẽ thấy bài học ngay sau khi lưu' : 'Lưu nháp — học viên chưa thấy bài học này'}
            </p>
          </div>
        </label>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 flex items-center gap-2">
          <i className="ti ti-check text-green-600" />
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <button onClick={handlePublish} disabled={loading}
        className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-opacity-30 border-t-white rounded-full animate-spin" />
            {isEditMode ? 'Đang lưu...' : 'Đang xuất bản...'}
          </>
        ) : (
          <>
            <i className="ti ti-cloud-upload" style={{fontSize:'16px'}} />
            {isEditMode ? 'Lưu thay đổi' : isPublished ? 'Xuất bản bài học' : 'Lưu nháp'}
          </>
        )}
      </button>
    </div>
  )
}