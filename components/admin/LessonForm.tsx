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
    youtube_id: '', youtube_id_2: '', intro_text: '', practice_prompt: '', recap_content: ''
  })
  const [mcqs, setMcqs] = useState([
    { question: '', options: ['', '', '', ''], correct: 0 }
  ])
  const [essays, setEssays] = useState<{ question: string }[]>([])
  const [tfGroups, setTfGroups] = useState<{ question: string; items: { statement: string; correct: boolean }[] }[]>([])
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
          youtube_id_2: l.youtube_id_2 || '',
          intro_text: l.intro_text || '',
          practice_prompt: l.practice_prompt || '',
          recap_content: l.recap_content || ''
        })
        const loadedMcqs = (l.questions || []).filter((q: any) => q.type === 'mcq')
        const loadedEssays = (l.questions || []).filter((q: any) => q.type === 'essay')
        const loadedTf = (l.questions || []).filter((q: any) => q.type === 'true_false')
        setMcqs(loadedMcqs.length > 0 ? loadedMcqs : [{ question: '', options: ['', '', '', ''], correct: 0 }])
        setEssays(loadedEssays.length > 0 ? loadedEssays : [])
        setTfGroups(loadedTf.length > 0
          ? loadedTf.map((g: any) => ({
              question: g.question || '',
              items: (g.items || []).map((it: any) => ({ statement: it.statement || '', correct: !!it.correct }))
            }))
          : [])
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
      ...essays.map((q, i) => ({ id: mcqs.length + i + 1, type: 'essay', ...q })),
      ...tfGroups.map((g, i) => ({
        id: mcqs.length + essays.length + i + 1,
        type: 'true_false',
        question: g.question,
        items: g.items.map((it, ii) => ({ id: ii + 1, statement: it.statement, correct: it.correct }))
      }))
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
      setForm({ title: '', branch_id: '', module_id: '', order_index: 1, youtube_id: '', youtube_id_2: '', intro_text: '', practice_prompt: '', recap_content: '' })
      setMcqs([{ question: '', options: ['', '', '', ''], correct: 0 }])
      setEssays([{ question: '' }])
      setTfGroups([])
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

        <label className={labelCls}>YouTube video ID 2 <span className="text-gray-400 font-normal">(video phụ, để trống nếu không có)</span></label>
        <input className={`${inputCls} mb-4`}
          placeholder="dQw4w9WgXcQ"
          value={form.youtube_id_2} onChange={e => setForm({...form, youtube_id_2: e.target.value})} />

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
            <p className="text-xs text-gray-400 mt-0.5">{mcqs.length} câu</p>
          </div>
          <button
            onClick={() => setMcqs([...mcqs, { question: '', options: ['','','',''], correct: 0 }])}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-full flex items-center gap-1"
          >
            <i className="ti ti-plus" style={{fontSize:'12px'}} /> Thêm
          </button>
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
          {['A','B','C','D','E','F'][oi]}
        </span>
        <input
          className="flex-1 min-w-0 text-sm bg-transparent outline-none"
          placeholder="Đáp án..." value={opt}
          onClick={e => e.stopPropagation()}
          onChange={e => {
            const u = [...mcqs]; u[qi].options[oi] = e.target.value; setMcqs(u)
          }} />
        {mcq.options.length > 2 && (
          <button onClick={e => {
            e.stopPropagation()
            const u = [...mcqs]
            u[qi].options = u[qi].options.filter((_: string, i: number) => i !== oi)
            if (u[qi].correct >= u[qi].options.length) u[qi].correct = 0
            setMcqs(u)
          }} className="text-gray-300 hover:text-red-400 flex-shrink-0">
            <i className="ti ti-x" style={{fontSize:'11px'}} />
          </button>
        )}
      </div>
    )
  })}
</div>
{mcq.options.length < 6 && (
  <button
    onClick={() => {
      const u = [...mcqs]
      u[qi].options = [...u[qi].options, '']
      setMcqs(u)
    }}
    className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
  >
    <i className="ti ti-plus" style={{fontSize:'11px'}} /> Thêm đáp án
  </button>
)}
            </div>
          ))}
        </div>
      </div>

      {/* Card 3: Essay */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Câu hỏi tự luận</p>
            <p className="text-xs text-gray-400 mt-0.5">{essays.length} câu</p>
          </div>
          <button
            onClick={() => setEssays([...essays, { question: '' }])}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-full flex items-center gap-1"
          >
            <i className="ti ti-plus" style={{fontSize:'12px'}} /> Thêm
          </button>
        </div>

        <div className="space-y-2">
          {essays.map((eq, qi) => (
            <div key={qi} className="flex items-start gap-2">
              <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs text-gray-500 flex-shrink-0 mt-1.5">
                {qi + 1}
              </span>
              <textarea rows={2} className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y"
                placeholder="Câu hỏi tự luận... (Enter để xuống dòng)" value={eq.question}
                onChange={e => { const u = [...essays]; u[qi].question = e.target.value; setEssays(u) }} />
              {essays.length > 0 && (
                <button onClick={() => setEssays(essays.filter((_, i) => i !== qi))} className="text-gray-300 hover:text-red-500 flex-shrink-0 mt-2">
                  <i className="ti ti-x" style={{fontSize:'14px'}} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card 3b: Đúng/Sai */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium">Câu hỏi Đúng/Sai</p>
            <p className="text-xs text-gray-400 mt-0.5">{tfGroups.length} nhóm</p>
          </div>
          <button
            onClick={() => setTfGroups([...tfGroups, { question: '', items: [{ statement: '', correct: true }] }])}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-full flex items-center gap-1"
          >
            <i className="ti ti-plus" style={{fontSize:'12px'}} /> Thêm nhóm
          </button>
        </div>

        <div className="space-y-4">
          {tfGroups.map((group, gi) => (
            <div key={gi} className="bg-gray-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-400">Nhóm {gi + 1}</span>
                <button onClick={() => setTfGroups(tfGroups.filter((_, i) => i !== gi))} className="text-gray-300 hover:text-red-500">
                  <i className="ti ti-x" style={{fontSize:'14px'}} />
                </button>
              </div>

              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 bg-white"
                placeholder="Đề bài nhóm (vd: Xác định các câu sau đúng hay sai)"
                value={group.question}
                onChange={e => {
                  const u = [...tfGroups]; u[gi].question = e.target.value; setTfGroups(u)
                }} />

              <div className="space-y-2">
                {group.items.map((item, ii) => (
                  <div key={ii} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                      {ii + 1}
                    </span>
                    <input className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                      placeholder="Nội dung câu..."
                      value={item.statement}
                      onChange={e => {
                        const u = [...tfGroups]; u[gi].items[ii].statement = e.target.value; setTfGroups(u)
                      }} />
                    <div className="flex gap-1 flex-shrink-0">
                      {[true, false].map(val => (
                        <button key={String(val)}
                          onClick={() => { const u = [...tfGroups]; u[gi].items[ii].correct = val; setTfGroups(u) }}
                          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                            item.correct === val
                              ? (val ? 'bg-green-500 text-white' : 'bg-red-500 text-white')
                              : 'bg-white border border-gray-200 text-gray-400'
                          }`}>
                          {val ? 'Đúng' : 'Sai'}
                        </button>
                      ))}
                    </div>
                    {group.items.length > 1 && (
                      <button onClick={() => {
                        const u = [...tfGroups]; u[gi].items = u[gi].items.filter((_, i) => i !== ii); setTfGroups(u)
                      }} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                        <i className="ti ti-x" style={{fontSize:'14px'}} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const u = [...tfGroups]; u[gi].items = [...u[gi].items, { statement: '', correct: true }]; setTfGroups(u)
                }}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <i className="ti ti-plus" style={{fontSize:'11px'}} /> Thêm câu
              </button>
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
{/* Card 4b: Recap bài học */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="mb-3">
          <p className="text-sm font-medium">Nội dung Recap</p>
          <p className="text-xs text-gray-400 mt-0.5">Hiển thị sau khi học viên hoàn thành bài — tóm tắt điểm quan trọng cần nhớ.</p>
        </div>
        <textarea rows={8} className={inputCls}
          placeholder="Điều quan trọng cần ghi nhớ&#10;&#10;1. ...&#10;2. ...&#10;3. ..."
          value={form.recap_content}
          onChange={e => setForm({...form, recap_content: e.target.value})} />
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