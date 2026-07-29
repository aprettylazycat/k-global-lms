'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import LessonForm from '@/components/admin/LessonForm'
import ExcelImport from '@/components/admin/ExcelImport'
import { supabase } from '@/lib/supabase'

const ReviewPanel  = dynamic(() => import('@/components/admin/ReviewPanel'),  { ssr: false })
const LessonList   = dynamic(() => import('@/components/admin/LessonList'),   { ssr: false })
const ModuleManager = dynamic(() => import('@/components/admin/ModuleManager'), { ssr: false })
const ReportPanel  = dynamic(() => import('@/components/admin/ReportPanel'),  { ssr: false })
const GradingAuditTab = dynamic(() => import('@/components/admin/GradingAuditTab'), { ssr: false })

type Tab = 'upload' | 'review' | 'manage' | 'modules' | 'report' | 'audit'

const BASE_TABS: { key: Tab; label: string }[] = [
  { key: 'upload',  label: 'Upload bài học' },
  { key: 'review',  label: 'Duyệt bài' },
  { key: 'manage',  label: 'Bài học' },
  { key: 'modules', label: 'Module' },
  { key: 'report',  label: 'Báo cáo' },
]

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('upload')
  const [uploadTab, setUploadTab] = useState<'form' | 'excel'>('form')
  const [mounted, setMounted] = useState<Set<Tab>>(new Set(['upload']))
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    async function checkRole() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single()
      setIsSuperAdmin(profile?.role === 'super_admin')
    }
    checkRole()
  }, [])

  const TABS = isSuperAdmin ? [...BASE_TABS, { key: 'audit' as Tab, label: 'Ai chấm bài' }] : BASE_TABS

  function handleTabChange(t: Tab) {
    setTab(t)
    setMounted(prev => new Set([...prev, t]))
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#070B15', color: '#EEF3FB' }}>
      <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-lg font-medium mb-6">Admin Panel</h1>

      {/* Tab chính */}
      <div className="flex gap-0 mb-6 border rounded-lg overflow-hidden">
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`flex-1 py-2 text-sm ${tab === t.key ? 'bg-[#1A2542] font-medium' : 'text-[#8FA9C6]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Upload — luôn mounted, ẩn bằng hidden */}
      <div className={tab === 'upload' ? '' : 'hidden'}>
        <div className="flex gap-0 mb-6 border rounded-lg overflow-hidden">
          <button onClick={() => setUploadTab('form')}
            className={`flex-1 py-2 text-sm ${uploadTab === 'form' ? 'bg-[#1A2542] font-medium' : 'text-[#8FA9C6]'}`}>
            Nhập tay
          </button>
          <button onClick={() => setUploadTab('excel')}
            className={`flex-1 py-2 text-sm ${uploadTab === 'excel' ? 'bg-[#1A2542] font-medium' : 'text-[#8FA9C6]'}`}>
            Import Excel / CSV
          </button>
        </div>
        {uploadTab === 'form' ? <LessonForm /> : <ExcelImport />}
      </div>

      {/* Các tab lazy: chỉ render lần đầu khi tab được mở, sau đó giữ nguyên DOM, ẩn bằng hidden */}
      {mounted.has('review')  && <div className={tab === 'review'  ? '' : 'hidden'}><ReviewPanel /></div>}
      {mounted.has('manage')  && <div className={tab === 'manage'  ? '' : 'hidden'}><LessonList /></div>}
      {mounted.has('modules') && <div className={tab === 'modules' ? '' : 'hidden'}><ModuleManager /></div>}
      {mounted.has('report')  && <div className={tab === 'report'  ? '' : 'hidden'}><ReportPanel /></div>}
      {mounted.has('audit')   && <div className={tab === 'audit'   ? '' : 'hidden'}><GradingAuditTab /></div>}
      </div>
    </div>
  )
}