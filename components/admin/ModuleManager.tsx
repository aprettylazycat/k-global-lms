/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ModuleItem = {
  id: number
  branch_id: string
  name: string
  description: string | null
  order_index: number
}

type BranchItem = {
  id: string
  name: string
  slug: string
}

type FormState = {
  branch_id: string
  name: string
  description: string
  order_index: number
}

type FeedbackQuestion = {
  id: string
  module_id: number
  question_text: string
  question_type: 'rating' | 'text'
  order_index: number
  is_active: boolean
}

const emptyForm = (branchId: string): FormState => ({
  branch_id: branchId,
  name: '',
  description: '',
  order_index: 1,
})

export default function ModuleManager() {
  const [branches, setBranches] = useState<BranchItem[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<number | null>(null)
  const hasFetched = useRef(false)

  async function loadAll() {
    setLoading(true)
    setError('')
    const { data: branchData } = await supabase.from('branches').select('id, name, slug').order('name')
    setBranches(branchData ?? [])
    const res = await fetch('/api/admin/modules-list')
    const data = await res.json()
    if (res.ok) setModules(data.modules ?? [])
    else setError(data.error || 'Không tải được danh sách module')
    setLoading(false)
  }

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    loadAll()
  }, [])

  function startCreate(branchId: string) {
    setEditingId(null)
    setSavingBranchId(branchId)
    setForm(emptyForm(branchId))
  }

  function startEdit(mod: ModuleItem) {
    setSavingBranchId(null)
    setEditingId(mod.id)
    setForm({
      branch_id: mod.branch_id,
      name: mod.name,
      description: mod.description ?? '',
      order_index: mod.order_index,
    })
  }

  function cancelForm() {
    setSavingBranchId(null)
    setEditingId(null)
    setForm(null)
    setError('')
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim()) { setError('Vui lòng nhập tên module'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Phiên đăng nhập đã hết hạn'); return }
    const isEditing = editingId !== null
    const body = isEditing
      ? { id: editingId, name: form.name, description: form.description, order_index: form.order_index }
      : { branch_id: form.branch_id, name: form.name, description: form.description, order_index: form.order_index }
    const res = await fetch('/api/admin/manage-module', {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify(body)
    })
    const data = await res.json()
    if (res.ok) { cancelForm(); loadAll() }
    else setError(data.error || 'Không lưu được module')
  }

  async function handleDelete(mod: ModuleItem) {
    const confirmed = window.confirm(`Xóa module "${mod.name}"?\nChỉ xóa được nếu module này chưa có bài học nào.`)
    if (!confirmed) return
    setDeletingId(mod.id)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setDeletingId(null); return }
    const res = await fetch('/api/admin/manage-module', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: mod.id })
    })
    const data = await res.json()
    if (res.ok) setModules(prev => prev.filter(m => m.id !== mod.id))
    else setError(data.error || 'Không xóa được module')
    setDeletingId(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-[rgba(96,165,250,0.3)] border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  const totalModules = modules.length

  return (
    <div className="space-y-5">

      {/* Header stats */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
        <div>
          <p className="text-2xl font-bold text-white">{totalModules} module</p>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(96,165,250,0.3)' }}>
            {branches.length} nhánh · Quản lý lộ trình học
          </p>
        </div>
        <button onClick={loadAll}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#0E1526' }}>
          <i className="ti ti-refresh" style={{ fontSize: '14px' }} />
          Làm mới
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid #FECACA' }}>
          <i className="ti ti-alert-circle mr-2" />
          {error}
        </div>
      )}

      {/* Danh sách theo nhánh */}
      {branches.map(branch => {
        const branchModules = modules
          .filter(m => m.branch_id === branch.id)
          .sort((a, b) => a.order_index - b.order_index)
        const isCreatingHere = savingBranchId === branch.id

        return (
          <div key={branch.id}>
            {/* Branch header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold uppercase tracking-widest"
                style={{ color: '#3B82F6' }}>
                {branch.name}
              </p>
              {!isCreatingHere && (
                <button
                  onClick={() => startCreate(branch.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                  style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#3B82F6', border: '1.5px solid #BFDBFE' }}>
                  <i className="ti ti-plus" style={{ fontSize: '12px' }} />
                  Thêm module
                </button>
              )}
            </div>

            <div className="space-y-2">
              {/* Empty state */}
              {branchModules.length === 0 && !isCreatingHere && (
                <div className="rounded-2xl p-6 text-center"
                  style={{ backgroundColor: 'rgba(96,165,250,0.12)', border: '2px dashed #BFDBFE' }}>
                  <i className="ti ti-layout-list" style={{ fontSize: '24px', color: 'rgba(96,165,250,0.3)' }} />
                  <p className="text-xs font-medium mt-2" style={{ color: '#60A5FA' }}>
                    Chưa có module nào trong nhánh này.
                  </p>
                </div>
              )}

              {/* Module rows */}
              {branchModules.map(mod => {
                const isEditingThis = editingId === mod.id
                if (isEditingThis && form) {
                  return (
                    <ModuleForm
                      key={mod.id}
                      form={form}
                      setForm={setForm}
                      onSave={handleSave}
                      onCancel={cancelForm}
                      saveLabel="Lưu thay đổi"
                    />
                  )
                }
                const isFeedbackOpen = expandedFeedbackId === mod.id
                return (
                  <div key={mod.id} className="space-y-0">
                    <div
                      className="bg-[#0E1526] px-5 py-4 flex items-center gap-4 shadow-sm"
                      style={{
                        border: '1px solid rgba(96,165,250,0.3)',
                        borderBottom: isFeedbackOpen ? 'none' : '2px solid #BFDBFE',
                        borderRadius: isFeedbackOpen ? '16px 16px 0 0' : '16px',
                      }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#3B82F6' }}>
                        {mod.order_index}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: '#EEF3FB' }}>
                          {mod.name}
                        </p>
                        {mod.description && (
                          <p className="text-xs mt-0.5 truncate" style={{ color: '#60A5FA' }}>
                            {mod.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => setExpandedFeedbackId(isFeedbackOpen ? null : mod.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors"
                          style={{
                            borderColor: isFeedbackOpen ? '#3B82F6' : 'rgba(96,165,250,0.3)',
                            color: '#3B82F6',
                            backgroundColor: isFeedbackOpen ? 'rgba(96,165,250,0.12)' : '#0E1526',
                          }}>
                          <i className="ti ti-message-star" style={{ fontSize: '12px' }} />
                          Feedback
                          <i className={`ti ti-chevron-${isFeedbackOpen ? 'up' : 'down'}`} style={{ fontSize: '11px' }} />
                        </button>
                        <button
                          onClick={() => startEdit(mod)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors"
                          style={{ borderColor: 'rgba(96,165,250,0.3)', color: '#3B82F6' }}>
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(mod)}
                          disabled={deletingId === mod.id}
                          className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors disabled:opacity-40"
                          style={{ borderColor: 'rgba(248,113,113,0.35)', color: '#F87171' }}>
                          {deletingId === mod.id ? '...' : 'Xóa'}
                        </button>
                      </div>
                    </div>
                    {isFeedbackOpen && <FeedbackQuestionsPanel moduleId={mod.id} />}
                  </div>
                )
              })}

              {/* Form tạo mới */}
              {isCreatingHere && form && (
                <ModuleForm
                  form={form}
                  setForm={setForm}
                  onSave={handleSave}
                  onCancel={cancelForm}
                  saveLabel="Tạo module"
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ModuleForm({
  form, setForm, onSave, onCancel, saveLabel,
}: {
  form: FormState
  setForm: (f: FormState) => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
}) {
  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'rgba(96,165,250,0.12)', border: '2px solid #0E62B1' }}>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: '#3B82F6' }}>
          Tên module
        </label>
        <input
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-[#0E1526] focus:outline-none"
          style={{ border: '1px solid rgba(96,165,250,0.3)' }}
          placeholder="Ví dụ: Module 1. Giới thiệu chung"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          onFocus={e => e.target.style.borderColor = '#3B82F6'}
          onBlur={e => e.target.style.borderColor = 'rgba(96,165,250,0.3)'}
        />
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: '#3B82F6' }}>
          Mô tả <span style={{ color: '#60A5FA', fontWeight: 400 }}>(tùy chọn)</span>
        </label>
        <input
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-[#0E1526] focus:outline-none"
          style={{ border: '1px solid rgba(96,165,250,0.3)' }}
          placeholder="Mô tả ngắn về module này"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          onFocus={e => e.target.style.borderColor = '#3B82F6'}
          onBlur={e => e.target.style.borderColor = 'rgba(96,165,250,0.3)'}
        />
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: '#3B82F6' }}>
          Thứ tự
        </label>
        <input
          type="number"
          min={1}
          className="w-24 rounded-xl px-4 py-2.5 text-sm bg-[#0E1526] focus:outline-none"
          style={{ border: '1px solid rgba(96,165,250,0.3)' }}
          value={form.order_index}
          onChange={e => setForm({ ...form, order_index: Number(e.target.value) })}
          onFocus={e => e.target.style.borderColor = '#3B82F6'}
          onBlur={e => e.target.style.borderColor = 'rgba(96,165,250,0.3)'}
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSave}
          className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          style={{ color: '#60A5FA' }}>
          Hủy
        </button>
      </div>
    </div>
  )
}

const emptyQuestionForm = () => ({ question_text: '', question_type: 'rating' as 'rating' | 'text', order_index: 0 })

function FeedbackQuestionsPanel({ moduleId }: { moduleId: number }) {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newQ, setNewQ] = useState(emptyQuestionForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQ, setEditQ] = useState(emptyQuestionForm())
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Phiên đăng nhập đã hết hạn'); setLoading(false); return }
    const res = await fetch(`/api/admin/manage-feedback-questions?module_id=${moduleId}`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    })
    const data = await res.json()
    if (res.ok) setQuestions(data.questions ?? [])
    else setError(data.error || 'Không tải được câu hỏi feedback')
    setLoading(false)
  }

  useEffect(() => { load() }, [moduleId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!newQ.question_text.trim()) { setError('Vui lòng nhập nội dung câu hỏi'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin/manage-feedback-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ module_id: moduleId, ...newQ })
    })
    const data = await res.json()
    if (res.ok) { setCreating(false); setNewQ(emptyQuestionForm()); load() }
    else setError(data.error || 'Không tạo được câu hỏi')
  }

  function startEditQuestion(q: FeedbackQuestion) {
    setEditingId(q.id)
    setEditQ({ question_text: q.question_text, question_type: q.question_type, order_index: q.order_index })
  }

  async function handleSaveEdit(id: string) {
    if (!editQ.question_text.trim()) { setError('Vui lòng nhập nội dung câu hỏi'); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin/manage-feedback-questions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ id, ...editQ })
    })
    const data = await res.json()
    if (res.ok) { setEditingId(null); load() }
    else setError(data.error || 'Không lưu được thay đổi')
  }

  // Soft-delete: chỉ đổi is_active=false, KHÔNG xóa cứng — giữ lại response cũ đã có
  async function toggleActive(q: FeedbackQuestion) {
    setBusyId(q.id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setBusyId(null); return }
    const res = await fetch('/api/admin/manage-feedback-questions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ id: q.id, is_active: !q.is_active })
    })
    const data = await res.json()
    if (res.ok) load()
    else setError(data.error || 'Không cập nhật được trạng thái')
    setBusyId(null)
  }

  return (
    <div className="rounded-b-2xl p-5 space-y-3"
      style={{ backgroundColor: '#0E1526', border: '1px solid rgba(96,165,250,0.3)', borderTop: 'none' }}>

      {error && (
        <div className="rounded-xl px-3 py-2 text-xs font-medium"
          style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: '#F87171', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-[rgba(96,165,250,0.3)] border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {questions.length === 0 && !creating && (
            <p className="text-xs font-medium py-2" style={{ color: '#60A5FA' }}>
              Chưa có câu hỏi feedback nào cho module này. Nếu không thêm câu hỏi, hệ thống sẽ chỉ hiện pháo hoa + badge khi học viên hoàn thành, bỏ qua bước feedback.
            </p>
          )}

          {questions.map(q => {
            const isEditingThis = editingId === q.id
            if (isEditingThis) {
              return (
                <div key={q.id} className="rounded-xl p-4 space-y-2.5 bg-[#0E1526]" style={{ border: '2px solid #0E62B1' }}>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ border: '1.5px solid #BFDBFE' }}
                    value={editQ.question_text}
                    onChange={e => setEditQ({ ...editQ, question_text: e.target.value })}
                  />
                  <div className="flex items-center gap-3">
                    <select
                      className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none"
                      style={{ border: '1.5px solid #BFDBFE' }}
                      value={editQ.question_type}
                      onChange={e => setEditQ({ ...editQ, question_type: e.target.value as 'rating' | 'text' })}>
                      <option value="rating">⭐ Rating (1-5 sao)</option>
                      <option value="text">💬 Text (câu trả lời tự do)</option>
                    </select>
                    <input
                      type="number"
                      className="w-16 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                      style={{ border: '1.5px solid #BFDBFE' }}
                      value={editQ.order_index}
                      onChange={e => setEditQ({ ...editQ, order_index: Number(e.target.value) })}
                    />
                    <div className="flex-1" />
                    <button onClick={() => handleSaveEdit(q.id)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                      style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
                      Lưu
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg"
                      style={{ color: '#60A5FA' }}>
                      Hủy
                    </button>
                  </div>
                </div>
              )
            }
            return (
              <div key={q.id}
                className="rounded-xl px-4 py-3 flex items-center gap-3 bg-[#0E1526]"
                style={{ border: '1.5px solid #E2E8F0', opacity: q.is_active ? 1 : 0.5 }}>
                <span className="text-base flex-shrink-0">{q.question_type === 'rating' ? '⭐' : '💬'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#EEF3FB' }}>{q.question_text}</p>
                  {!q.is_active && (
                    <p className="text-xs mt-0.5" style={{ color: '#60A5FA' }}>Đã ẩn — không hiện cho học viên</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => startEditQuestion(q)}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
                    style={{ borderColor: 'rgba(96,165,250,0.3)', color: '#3B82F6' }}>
                    Sửa
                  </button>
                  <button onClick={() => toggleActive(q)} disabled={busyId === q.id}
                    className="text-xs font-semibold px-2.5 py-1 rounded-lg border disabled:opacity-40"
                    style={q.is_active
                      ? { borderColor: 'rgba(248,113,113,0.35)', color: '#F87171' }
                      : { borderColor: 'rgba(74,222,128,0.35)', color: '#4ADE80' }}>
                    {busyId === q.id ? '...' : q.is_active ? 'Ẩn' : 'Khôi phục'}
                  </button>
                </div>
              </div>
            )
          })}

          {creating ? (
            <div className="rounded-xl p-4 space-y-2.5 bg-[#0E1526]" style={{ border: '2px solid #0E62B1' }}>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ border: '1.5px solid #BFDBFE' }}
                placeholder="Nội dung câu hỏi feedback"
                value={newQ.question_text}
                onChange={e => setNewQ({ ...newQ, question_text: e.target.value })}
              />
              <div className="flex items-center gap-3">
                <select
                  className="rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none"
                  style={{ border: '1.5px solid #BFDBFE' }}
                  value={newQ.question_type}
                  onChange={e => setNewQ({ ...newQ, question_type: e.target.value as 'rating' | 'text' })}>
                  <option value="rating">⭐ Rating (1-5 sao)</option>
                  <option value="text">💬 Text (câu trả lời tự do)</option>
                </select>
                <input
                  type="number"
                  className="w-16 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  style={{ border: '1.5px solid #BFDBFE' }}
                  placeholder="Thứ tự"
                  value={newQ.order_index}
                  onChange={e => setNewQ({ ...newQ, order_index: Number(e.target.value) })}
                />
                <div className="flex-1" />
                <button onClick={handleCreate}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)', border: '1px solid rgba(155,196,232,0.28)' }}>
                  Tạo câu hỏi
                </button>
                <button onClick={() => { setCreating(false); setNewQ(emptyQuestionForm()) }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ color: '#60A5FA' }}>
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
              style={{ backgroundColor: 'rgba(96,165,250,0.12)', color: '#3B82F6', border: '1.5px solid #BFDBFE' }}>
              <i className="ti ti-plus" style={{ fontSize: '12px' }} />
              Thêm câu hỏi feedback
            </button>
          )}
        </>
      )}
    </div>
  )
}