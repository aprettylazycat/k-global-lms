'use client'
import { useState } from 'react'
import LessonForm from '@/components/admin/LessonForm'
import ExcelImport from '@/components/admin/ExcelImport'
import ReviewPanel from '@/components/admin/ReviewPanel'
import LessonList from '@/components/admin/LessonList'
import ModuleManager from '@/components/admin/ModuleManager'
import ReportPanel from '@/components/admin/ReportPanel'

export default function AdminPage() {
  const [tab, setTab] = useState<'upload' | 'review' | 'manage' | 'modules' | 'report'>('upload')
  const [uploadTab, setUploadTab] = useState<'form' | 'excel'>('form')

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-lg font-medium mb-6">Admin Panel</h1>

      {/* Tab chính */}
      <div className="flex gap-0 mb-6 border rounded-lg overflow-hidden">
        <button onClick={() => setTab('upload')}
          className={`flex-1 py-2 text-sm ${tab === 'upload' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
          Upload bài học
        </button>
        <button onClick={() => setTab('review')}
          className={`flex-1 py-2 text-sm ${tab === 'review' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
          Duyệt bài
        </button>
        <button onClick={() => setTab('manage')}
          className={`flex-1 py-2 text-sm ${tab === 'manage' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
          Bài học
        </button>
        <button onClick={() => setTab('modules')}
          className={`flex-1 py-2 text-sm ${tab === 'modules' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
          Module
        </button>
        <button onClick={() => setTab('report')}
          className={`flex-1 py-2 text-sm ${tab === 'report' ? 'bg-gray-100 font-medium' : 'text-gray-500'}`}>
          Báo cáo
        </button>
      </div>

      {tab === 'upload' && (
        <>
          {/* Tab upload */}
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
        </>
      )}

      {tab === 'review' && <ReviewPanel />}

      {tab === 'manage' && <LessonList />}

      {tab === 'modules' && <ModuleManager />}

      {tab === 'report' && <ReportPanel />}
    </div>
  )
}