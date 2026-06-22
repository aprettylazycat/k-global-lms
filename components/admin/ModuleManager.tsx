/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useState } from 'react'
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

  async function loadAll() {
    setLoading(true)
    setError('')

    const { data: branchData } = await supabase.from('branches').select('id, name, slug').order('name')
    setBranches(branchData ?? [])

    const res = await fetch('/api/admin/modules-list')
    const data = await res.json()
    if (res.ok) {
      setModules(data.modules ?? [])
    } else {
      setError(data.error || 'Không tải được danh sách module')
    }

    setLoading(false)
  }

  useEffect(() => {
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
    const url = '/api/admin/manage-module'
    const method = isEditing ? 'PUT' : 'POST'
    const body = isEditing
      ? { id: editingId, name: form.name, description: form.description, order_index: form.order_index }
      : { branch_id: form.branch_id, name: form.name, description: form.description, order_index: form.order_index }

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })

    const data = await res.json()

    if (res.ok) {
      cancelForm()
      loadAll()
    } else {
      setError(data.error || 'Không lưu được module')
    }
  }

  async function handleDelete(mod: ModuleItem) {
    const confirmed = window.confirm(`Xóa module "${mod.name}"? Chỉ xóa được nếu module này chưa có bài học nào.`)
    if (!confirmed) return

    setDeletingId(mod.id)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setDeletingId(null); return }

    const res = await fetch('/api/admin/manage-module', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ id: mod.id })
    })

    const data = await res.json()

    if (res.ok) {
      setModules(prev => prev.filter(m => m.id !== mod.id))
    } else {
      setError(data.error || 'Không xóa được module')
    }
    setDeletingId(null)
  }

  if (loading) return <p className="text-sm text-gray-400">Đang tải...</p>

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {branches.map(branch => {
        const branchModules = modules.filter(m => m.branch_id === branch.id)
        const isCreatingHere = savingBranchId === branch.id

        return (
          <div key={branch.id}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-medium text-gray-400">{branch.name}</p>
              {!isCreatingHere && (
                <button
                  onClick={() => startCreate(branch.id)}
                  className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-50"
                >
                  + Thêm module
                </button>
              )}
            </div>

            <div className="space-y-2">
              {branchModules.length === 0 && !isCreatingHere && (
                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
                  Chưa có module nào trong nhánh này.
                </p>
              )}

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
                  <div key={mod.id} className="border rounded-xl p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium flex-shrink-0">
                        {mod.order_index}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{mod.name}</p>
                        {mod.description && (
                          <p className="text-xs text-gray-400 truncate">{mod.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => startEdit(mod)}
                        className="text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(mod)}
                        disabled={deletingId === mod.id}
                        className="text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 disabled:opacity-50 hover:bg-red-50"
                      >
                        {deletingId === mod.id ? 'Đang xóa...' : 'Xóa'}
                      </button>
                    </div>
                  </div>
                )
              })}

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
  form,
  setForm,
  onSave,
  onCancel,
  saveLabel,
}: {
  form: FormState
  setForm: (f: FormState) => void
  onSave: () => void
  onCancel: () => void
  saveLabel: string
}) {
  return (
    <div className="border-2 border-gray-900 rounded-xl p-4 space-y-3 bg-gray-50">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Tên module</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          placeholder="Ví dụ: Module 1. Giới thiệu chung"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Mô tả (tùy chọn)</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
          placeholder="Mô tả ngắn về module này"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Thứ tự</label>
        <input
          type="number"
          min={1}
          className="w-24 border rounded-lg px-3 py-2 text-sm bg-white"
          value={form.order_index}
          onChange={e => setForm({ ...form, order_index: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          className="text-xs bg-gray-900 text-white rounded-lg px-4 py-2"
        >
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-gray-500 px-3 py-2"
        >
          Hủy
        </button>
      </div>
    </div>
  )
}