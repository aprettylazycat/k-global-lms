'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import LessonForm from '@/components/admin/LessonForm'
import ExcelImport from '@/components/admin/ExcelImport'

const ReviewPanel  = dynamic(() => import('@/components/admin/ReviewPanel'),  { ssr: false })
const LessonList   = dynamic(() => import('@/components/admin/LessonList'),   { ssr: false })
const ModuleManager = dynamic(() => import('@/components/admin/ModuleManager'), { ssr: false })
const ReportPanel  = dynamic(() => import('@/components/admin/ReportPanel'),  { ssr: false })

type Tab = 'upload' | 'review' | 'manage' | 'modules' | 'report'

const TABS: { key: Tab; label: string }[] = [
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

  function handleTabChange(t: Tab) {
    setTab(t)
    setMounted(prev => new Set([...prev, t]))
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-medium mb-6">Admin Panel</h1>

      {/* Tab chính */}
      <div className="flex gap-0 mb-6 border rounded-lg overflow-hidden">
        {TABS.map(t => (
          <button key={t.key} onClick={() => handleTabChange(t.key)}
            className={`flex-1 py-2 text-sm ${tab === t.key ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Upload — luôn mounted, ẩn bằng hidden */}
      <div className={tab === 'upload' ? '' : 'hidden'}>
        <div className="flex gap-0 mb-6 border rounded-lg overflow-hidden">
          <button onClick={() => setUploadTab('form')}
            className={`flex-1 py-2 text-sm ${uploadTab === 'form' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
            Nhập tay
          </button>
          <button onClick={() => setUploadTab('excel')}
            className={`flex-1 py-2 text-sm ${uploadTab === 'excel' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
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
    </div>
  )
}