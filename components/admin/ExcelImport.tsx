/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useState } from 'react'
import * as XLSX from 'xlsx'

type MCQRow = {
  lesson_title: string
  question: string
  options: string[]
  correct: number
  rowError?: string
}

type EssayRow = {
  lesson_title: string
  question: string
  rowError?: string
}

type TrueFalseRow = {
  lesson_title: string
  group_id: number
  group_question: string
  item_id: number
  statement: string
  correct: boolean
  rowError?: string
}

type ParsedLesson = {
  title: string
  branch_slug: string
  module_name: string
  order_index: number
  youtube_id: string
  intro_text: string
  practice_prompt: string
  recap_content: string
  no_quiz: boolean
  questions: any[]
  mcqCount: number
  essayCount: number
  tfCount: number
  valid: boolean
  error?: string
}

const LETTER_TO_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, a: 0, b: 1, c: 2, d: 3 }

export default function ExcelImport() {
  const [preview, setPreview] = useState<ParsedLesson[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [success, setSuccess] = useState('')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSuccess('')
    setParseErrors([])

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })

        const lessonsSheet = wb.Sheets['lessons']
        if (!lessonsSheet) {
          setParseErrors(['Không tìm thấy sheet tên "lessons". File phải có ít nhất sheet này.'])
          return
        }

        const lessonRows = XLSX.utils.sheet_to_json<Record<string, any>>(lessonsSheet)
        const mcqRows = wb.Sheets['mcq']
          ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['mcq'])
          : []
        const essayRows = wb.Sheets['essay']
          ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['essay'])
          : []
        const trueFalseRows = wb.Sheets['true_false']
          ? XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets['true_false'])
          : []

        const errors: string[] = []

        // Parse MCQ rows
        const parsedMcqs: MCQRow[] = mcqRows.map((row, i) => {
          const lesson_title = String(row.lesson_title ?? '').trim()
          const question = String(row.question ?? '').trim()
          const options = [
            String(row.option_a ?? '').trim(),
            String(row.option_b ?? '').trim(),
            String(row.option_c ?? '').trim(),
            String(row.option_d ?? '').trim(),
          ]
          const correctLetter = String(row.correct ?? '').trim()
          const correct = LETTER_TO_INDEX[correctLetter]

          let rowError = ''
          if (!lesson_title) rowError = 'Thiếu lesson_title'
          else if (!question) rowError = 'Thiếu question'
          else if (options.some(o => !o)) rowError = 'Thiếu 1 trong 4 đáp án (option_a-d)'
          else if (correct === undefined) rowError = `Cột correct phải là A/B/C/D, đang là "${correctLetter}"`

          if (rowError) errors.push(`Sheet mcq, dòng ${i + 2}: ${rowError}`)

          return { lesson_title, question, options, correct, rowError: rowError || undefined }
        })

        // Parse essay rows
        const parsedEssays: EssayRow[] = essayRows.map((row, i) => {
          const lesson_title = String(row.lesson_title ?? '').trim()
          const question = String(row.question ?? '').trim()

          let rowError = ''
          if (!lesson_title) rowError = 'Thiếu lesson_title'
          else if (!question) rowError = 'Thiếu question'

          if (rowError) errors.push(`Sheet essay, dòng ${i + 2}: ${rowError}`)

          return { lesson_title, question, rowError: rowError || undefined }
        })

        // Parse True/False rows
        const parsedTrueFalse: TrueFalseRow[] = trueFalseRows.map((row, i) => {
          const lesson_title = String(row.lesson_title ?? '').trim()
          const group_id = parseInt(row.group_id) || 0
          const group_question = String(row.group_question ?? '').trim()
          const item_id = parseInt(row.item_id) || 0
          const statement = String(row.statement ?? '').trim()
          const correctRaw = String(row.correct ?? '').trim().toUpperCase()
          const correct = correctRaw === 'TRUE' || correctRaw === 'ĐÚNG' || correctRaw === '1'

          let rowError = ''
          if (!lesson_title) rowError = 'Thiếu lesson_title'
          else if (!group_id) rowError = 'Thiếu group_id'
          else if (!statement) rowError = 'Thiếu statement'

          if (rowError) errors.push(`Sheet true_false, dòng ${i + 2}: ${rowError}`)
          return { lesson_title, group_id, group_question, item_id, statement, correct, rowError: rowError || undefined }
        })

        // Parse lessons + ráp câu hỏi vào theo lesson_title
        const parsedLessons: ParsedLesson[] = lessonRows.map((row, i) => {
          const title = String(row.title ?? '').trim()
          const branch_slug = String(row.branch_slug ?? '').trim()
          const module_name = String(row.module_name ?? '').trim()
          const order_index = parseInt(row.order_index) || 0
          const no_quiz = String(row.no_quiz ?? '').trim().toUpperCase() === 'TRUE'

          const missing = []
          if (!title) missing.push('title')
          if (!branch_slug) missing.push('branch_slug')
          if (!row.order_index) missing.push('order_index')

          const matchedMcqs = parsedMcqs.filter(m => m.lesson_title === title && !m.rowError)
          const matchedEssays = parsedEssays.filter(e => e.lesson_title === title && !e.rowError)
          const matchedTf = parsedTrueFalse.filter(t => t.lesson_title === title && !t.rowError)

          // Group TF theo group_id
          const tfGroups = Object.values(
            matchedTf.reduce((acc, row) => {
              if (!acc[row.group_id]) {
                acc[row.group_id] = {
                  id: row.group_id,
                  type: 'true_false',
                  question: row.group_question,
                  items: []
                }
              }
              acc[row.group_id].items.push({ id: row.item_id, statement: row.statement, correct: row.correct })
              return acc
            }, {} as Record<number, any>)
          )

          const questions = [
            ...matchedMcqs.map((m, qi) => ({
              id: qi + 1, type: 'mcq', question: m.question, options: m.options, correct: m.correct
            })),
            ...tfGroups,
            ...matchedEssays.map((e, qi) => ({
              id: matchedMcqs.length + tfGroups.length + qi + 1, type: 'essay', question: e.question
            }))
          ]

          const valid = missing.length === 0
          if (!valid) errors.push(`Sheet lessons, dòng ${i + 2} ("${title || '(không tên)'}"): Thiếu ${missing.join(', ')}`)

          return {
            title,
            branch_slug,
            module_name,
            order_index,
            youtube_id: String(row.youtube_id ?? '').trim(),
            intro_text: String(row.intro_text ?? '').trim(),
            practice_prompt: String(row.practice_prompt ?? '').trim(),
            recap_content: String(row.recap_content ?? '').trim(),
            no_quiz,
            questions,
            mcqCount: matchedMcqs.length,
            essayCount: matchedEssays.length,
            tfCount: tfGroups.length,
            valid,
            error: valid ? undefined : `Thiếu: ${missing.join(', ')}`
          }
        })

        // Cảnh báo câu hỏi không khớp được bài nào
        const allTitles = new Set(parsedLessons.map(l => l.title))
        parsedMcqs.forEach((m, i) => {
          if (!m.rowError && !allTitles.has(m.lesson_title)) {
            errors.push(`Sheet mcq, dòng ${i + 2}: lesson_title "${m.lesson_title}" không khớp bài học nào trong sheet lessons`)
          }
        })
        parsedEssays.forEach((eRow, i) => {
          if (!eRow.rowError && !allTitles.has(eRow.lesson_title)) {
            errors.push(`Sheet essay, dòng ${i + 2}: lesson_title "${eRow.lesson_title}" không khớp bài học nào trong sheet lessons`)
          }
        })
        parsedTrueFalse.forEach((t, i) => {
          if (!t.rowError && !allTitles.has(t.lesson_title)) {
            errors.push(`Sheet true_false, dòng ${i + 2}: lesson_title "${t.lesson_title}" không khớp bài học nào`)
          }
        })

        setPreview(parsedLessons)
        setParseErrors(errors)
      } catch (err: any) {
        setParseErrors([`Không đọc được file: ${err.message || 'lỗi không rõ'}`])
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    setImporting(true)
    const valid = preview.filter(l => l.valid)

    const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession()
    if (!session) { setImporting(false); return }

    const res = await fetch('/api/admin/import-lessons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ lessons: valid })
    })
    if (res.ok) {
      setSuccess(`Đã import ${valid.length} bài học! Vào tab "Bài học" để xem lại và xuất bản.`)
      setPreview([])
    } else {
      const data = await res.json()
      alert(`Lỗi khi import: ${data.error || 'không rõ nguyên nhân'}`)
    }
    setImporting(false)
  }

  const validCount = preview.filter(l => l.valid).length

  return (
    <div className="space-y-4">
      {/* Hướng dẫn format */}
      <div className="border rounded-xl p-4 bg-gray-50">
        <p className="text-sm font-medium mb-2">Format file Excel (.xlsx)</p>
        <p className="text-xs text-gray-500 mb-1">
          File cần có 4 sheet: <code>lessons</code>, <code>mcq</code>, <code>essay</code>, <code>true_false</code>
        </p>
        <p className="text-xs text-gray-500 mb-1">
          Sheet <code>lessons</code>: <code>title</code>, <code>branch_slug</code>, <code>module_name</code> (tùy chọn), <code>order_index</code>, <code>youtube_id</code>, <code>intro_text</code>, <code>practice_prompt</code>, <code>recap_content</code>, <code>no_quiz</code> (TRUE/FALSE)
        </p>
        <p className="text-xs text-gray-500 mb-1">
          Sheet <code>mcq</code>: <code>lesson_title</code>, <code>question</code>, <code>option_a</code>, <code>option_b</code>, <code>option_c</code>, <code>option_d</code>, <code>correct</code> (A/B/C/D)
        </p>
        <p className="text-xs text-gray-500 mb-1">
          Sheet <code>essay</code>: <code>lesson_title</code>, <code>question</code>
        </p>
        <p className="text-xs text-gray-500 mb-1">
          Sheet <code>true_false</code>: <code>lesson_title</code>, <code>group_id</code>, <code>group_question</code>, <code>item_id</code>, <code>statement</code>, <code>correct</code> (TRUE/FALSE)
        </p>
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
          <p className="text-xs text-gray-400">
            <code>branch_slug</code>: dùng slug của nhánh trong DB (ví dụ: <code>k-embroidery</code>, <code>lotus-smock</code>, <code>hair</code>)
          </p>
          <p className="text-xs text-gray-400">
            <code>module_name</code>: tên module chính xác như trong DB. Để trống nếu bài không thuộc module nào.
          </p>
          <p className="text-xs text-gray-400">
            <code>lesson_title</code> ở sheet mcq/essay/true_false phải khớp chính xác với <code>title</code> ở sheet lessons.
          </p>
          <p className="text-xs text-gray-400">
            Sheet <code>true_false</code>: mỗi nhóm câu hỏi có cùng <code>group_id</code>, mỗi item là một dòng riêng với <code>item_id</code> tăng dần.
          </p>
          <p className="text-xs text-gray-400">
            <code>no_quiz</code>: ghi TRUE nếu bài không có câu hỏi (ví dụ: Bài 0 chỉ xem video).
          </p>
        </div>
      </div>

      {/* Upload */}
      <label className="block cursor-pointer" htmlFor="excel-upload">
        <input type="file" accept=".xlsx,.xls"
          onChange={handleFile} className="hidden" id="excel-upload" />
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-gray-400 hover:bg-gray-50 transition-all">
          <i className="ti ti-file-spreadsheet text-3xl text-gray-300" />
          <p className="text-sm font-medium mt-3">Chọn file Excel (.xlsx)</p>
          <p className="text-xs text-gray-400 mt-1">hoặc kéo thả vào đây</p>
        </div>
      </label>

      {/* Lỗi parse */}
      {parseErrors.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700 mb-2">Phát hiện {parseErrors.length} lỗi:</p>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {parseErrors.map((err, i) => (
              <p key={i} className="text-xs text-red-600">• {err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="border rounded-xl p-4">
          <p className="text-sm font-medium mb-3">
            Preview: {validCount}/{preview.length} bài hợp lệ
          </p>
          <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
            {preview.map((l, i) => (
              <div key={i} className="flex items-start gap-2 text-sm border-b border-gray-100 pb-2 last:border-0">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${
                  l.valid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>{l.valid ? '✓' : '!'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{l.title || '(chưa có tên)'}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{l.branch_slug}</span>
                    {l.module_name && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {l.module_name}
                      </span>
                    )}
                    {l.no_quiz && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        no quiz
                      </span>
                    )}
                  </div>
                  {l.valid && (
                    <p className="text-xs text-gray-400">
                      {l.mcqCount} trắc nghiệm · {l.tfCount} đúng/sai · {l.essayCount} tự luận · thứ tự {l.order_index}
                    </p>
                  )}
                  {l.error && <p className="text-xs text-red-500">{l.error}</p>}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {importing ? 'Đang import...' : `Import ${validCount} bài →`}
          </button>
        </div>
      )}

      {success && <p className="text-sm text-green-600 bg-green-50 rounded-lg p-3">{success}</p>}
    </div>
  )
}