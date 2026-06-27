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
      <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  const totalModules = modules.length

  return (
    <div className="space-y-5">

      {/* Header stats */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{ backgroundColor: '#0E62B1' }}>
        <div>
          <p className="text-2xl font-bold text-white">{totalModules} module</p>
          <p className="text-sm mt-0.5" style={{ color: '#BFDBFE' }}>
            {branches.length} nhánh · Quản lý lộ trình học
          </p>
        </div>
        <button onClick={loadAll}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white' }}>
          <i className="ti ti-refresh" style={{ fontSize: '14px' }} />
          Làm mới
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
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
                style={{ color: '#0E62B1' }}>
                {branch.name}
              </p>
              {!isCreatingHere && (
                <button
                  onClick={() => startCreate(branch.id)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                  style={{ backgroundColor: '#EFF6FF', color: '#0E62B1', border: '1.5px solid #BFDBFE' }}>
                  <i className="ti ti-plus" style={{ fontSize: '12px' }} />
                  Thêm module
                </button>
              )}
            </div>

            <div className="space-y-2">
              {/* Empty state */}
              {branchModules.length === 0 && !isCreatingHere && (
                <div className="rounded-2xl p-6 text-center"
                  style={{ backgroundColor: '#EFF6FF', border: '2px dashed #BFDBFE' }}>
                  <i className="ti ti-layout-list" style={{ fontSize: '24px', color: '#BFDBFE' }} />
                  <p className="text-xs font-medium mt-2" style={{ color: '#93C5FD' }}>
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
                return (
                  <div key={mod.id}
                    className="bg-white rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm"
                    style={{ border: '2px solid #BFDBFE' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: '#EFF6FF', color: '#0E62B1' }}>
                      {mod.order_index}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1E3A5F' }}>
                        {mod.name}
                      </p>
                      {mod.description && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: '#93C5FD' }}>
                          {mod.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEdit(mod)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors"
                        style={{ borderColor: '#BFDBFE', color: '#0E62B1' }}>
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(mod)}
                        disabled={deletingId === mod.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors disabled:opacity-40"
                        style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                        {deletingId === mod.id ? '...' : 'Xóa'}
                      </button>
                    </div>
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
      style={{ backgroundColor: '#EFF6FF', border: '2px solid #0E62B1' }}>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: '#0E62B1' }}>
          Tên module
        </label>
        <input
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none"
          style={{ border: '2px solid #BFDBFE' }}
          placeholder="Ví dụ: Module 1. Giới thiệu chung"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          onFocus={e => e.target.style.borderColor = '#0E62B1'}
          onBlur={e => e.target.style.borderColor = '#BFDBFE'}
        />
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: '#0E62B1' }}>
          Mô tả <span style={{ color: '#93C5FD', fontWeight: 400 }}>(tùy chọn)</span>
        </label>
        <input
          className="w-full rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none"
          style={{ border: '2px solid #BFDBFE' }}
          placeholder="Mô tả ngắn về module này"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          onFocus={e => e.target.style.borderColor = '#0E62B1'}
          onBlur={e => e.target.style.borderColor = '#BFDBFE'}
        />
      </div>
      <div>
        <label className="text-xs font-semibold block mb-1.5" style={{ color: '#0E62B1' }}>
          Thứ tự
        </label>
        <input
          type="number"
          min={1}
          className="w-24 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none"
          style={{ border: '2px solid #BFDBFE' }}
          value={form.order_index}
          onChange={e => setForm({ ...form, order_index: Number(e.target.value) })}
          onFocus={e => e.target.style.borderColor = '#0E62B1'}
          onBlur={e => e.target.style.borderColor = '#BFDBFE'}
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSave}
          className="text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0E62B1' }}>
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
          style={{ color: '#93C5FD' }}>
          Hủy
        </button>
      </div>
    </div>
  )
}