'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Playfair_Display } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import type { Lesson, Progress } from '@/types'

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'] })

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = parseInt(params.id as string)

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [badgePopup, setBadgePopup] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserId(session.user.id)

      const { data: lessonData } = await supabase
        .from('lessons').select('*').eq('id', lessonId).single()
      setLesson(lessonData)

      const { data: prog } = await supabase
        .from('progress')
        .select('lesson_id, tick1, tick2, completed_at')
        .eq('user_id', session.user.id)
        .eq('lesson_id', lessonId)
        .single()
      setProgress(prog)

      setLoading(false)
    }
    load()
  }, [lessonId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#FAF8F4' }}>
        <div className="w-6 h-6 border-2 border-stone-200 border-t-stone-700 rounded-full animate-spin" />
      </div>
    )
  }
  if (!lesson) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-stone-400" style={{ backgroundColor: '#FAF8F4' }}>
        Không tìm thấy bài học.
      </div>
    )
  }

  const tick1Done = progress?.tick1 ?? false
  const tick2Done = progress?.tick2 ?? false
  const currentStep = !tick1Done ? 1 : !tick2Done ? 2 : 3

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: '#FAF8F4' }}>
      {/* Top bar */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-stone-200 px-5 py-3.5 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1 transition-colors"
          >
            <i className="ti ti-arrow-left" style={{fontSize:'14px'}} /> Dashboard
          </button>
          <StepIndicator currentStep={currentStep} />
        </div>
      </div>

      {/* Body — 2 cột trên PC */}
      <div className="max-w-6xl mx-auto px-5 pt-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">

        {/* Cột trái: Video + intro + Quiz */}
        <div className="space-y-5">
          {/* Tiêu đề + Video + intro */}
          <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
            <h1 className={`${playfair.className} text-xl lg:text-2xl font-bold text-stone-800 mb-4`}>
              {lesson.title}
            </h1>
            {lesson.youtube_id && (
              <div className="aspect-video bg-stone-100 rounded-2xl overflow-hidden mb-4">
                <iframe
                  src={`https://www.youtube.com/embed/${lesson.youtube_id}`}
                  className="w-full h-full" allowFullScreen
                />
              </div>
            )}
            <p className="text-sm text-stone-600 leading-relaxed">{lesson.intro_text}</p>

            {(lesson as any).attachment_url && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ti ti-file-type-pdf text-stone-400" style={{fontSize:'14px'}} />
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Tài liệu đính kèm</p>
                </div>
                <div className="rounded-2xl overflow-hidden border border-stone-200" style={{ height: '520px' }}>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent((lesson as any).attachment_url)}&embedded=true`}
                    className="w-full h-full"
                    title="Tài liệu bài học"
                  />
                </div>
                <a href={(lesson as any).attachment_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs text-stone-400 hover:text-stone-600 transition-colors">
                  <i className="ti ti-external-link" style={{fontSize:'12px'}} />
                  Mở PDF trong tab mới
                </a>
              </div>
            )}
          </div>

          {/* Bước 1: Quiz */}
          <QuizSection
            lessonId={lessonId}
            questions={lesson.questions}
            tick1Done={tick1Done}
            userId={userId}
            onDone={() => setProgress((p: any) => p ? {...p, tick1: true} : { tick1: true, tick2: false })}
          />
        </div>

        {/* Cột phải: Bài tập (PC) / Sau quiz (mobile) */}
        <div className="mt-5 lg:mt-0 lg:sticky lg:top-24">
          <PracticeSection
            lessonId={lessonId}
            prompt={lesson.practice_prompt}
            essays={lesson.questions.filter((q: any) => q.type === 'essay')}
            tick1Done={tick1Done}
            tick2Done={tick2Done}
            userId={userId}
          />
        </div>
      </div>
    </div>
  )
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { n: 1, label: 'Bài kiểm tra' },
    { n: 2, label: 'Bài tập' },
  ]
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const isActive = currentStep === s.n
        const isDone = currentStep > s.n
        return (
          <div key={s.n} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                isDone ? 'bg-stone-800 text-white' : isActive ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-400'
              }`}>
                {isDone ? <i className="ti ti-check" style={{fontSize:'10px'}} /> : s.n}
              </span>
              <span className={`text-xs hidden sm:inline ${isActive ? 'text-stone-800 font-medium' : 'text-stone-400'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <span className="w-4 border-t border-dashed border-stone-300" />}
          </div>
        )
      })}
    </div>
  )
}

function QuizSection({ lessonId, questions, tick1Done, userId, onDone }: {
  lessonId: number; questions: any[]; tick1Done: boolean; userId: string; onDone: () => void
}) {
  const mcqs = questions.filter(q => q.type === 'mcq')

  const [currentSlide, setCurrentSlide] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  // slideState: 'idle' = chưa chọn, 'correct' = đúng, 'wrong' = sai
  const [slideState, setSlideState] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [submitted, setSubmitted] = useState(tick1Done)
  const [submitting, setSubmitting] = useState(false)

  const q = mcqs[currentSlide]
  const isLastSlide = currentSlide === mcqs.length - 1
  const selectedAnswer = answers[q?.id] ?? -1

  function handleSelectOption(optionIdx: number) {
    if (slideState !== 'idle') return // đã chọn rồi, không cho chọn lại (trừ wrong)
    const isCorrect = optionIdx === q.correct
    setAnswers(prev => ({ ...prev, [q.id]: optionIdx }))
    setSlideState(isCorrect ? 'correct' : 'wrong')
  }

  function handleRetry() {
    // Xóa đáp án câu này, cho chọn lại
    setAnswers(prev => { const n = { ...prev }; delete n[q.id]; return n })
    setSlideState('idle')
  }

  async function handleNext() {
    if (isLastSlide) {
      // Tất cả câu đúng hết → submit lên server
      setSubmitting(true)
      const res = await fetch('/api/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, userId, answers })
      })
      const data = await res.json()
      setSubmitting(false)
      if (res.ok && data.allCorrect) {
        setSubmitted(true)
        onDone()
      }
    } else {
      setCurrentSlide(prev => prev + 1)
      setSlideState('idle')
    }
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-3xl border border-stone-200 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: '#EAF3DE', color: '#27500A' }}>
            <i className="ti ti-check" />
          </span>
          <h2 className={`${playfair.className} font-semibold text-stone-800`}>Bài kiểm tra</h2>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ backgroundColor: '#EAF3DE' }}>
          <i className="ti ti-check" style={{ color: '#27500A' }} />
          <p className="text-sm" style={{ color: '#27500A' }}>Đã hoàn thành bài kiểm tra — xem bài tập bên cạnh.</p>
        </div>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-stone-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ backgroundColor: '#1C1917', color: 'white' }}>1</span>
            <h2 className={`${playfair.className} font-semibold text-stone-800`}>Bài kiểm tra</h2>
          </div>
          <span className="text-xs text-stone-400">Câu {currentSlide + 1}/{mcqs.length}</span>
        </div>

        {/* Thanh tiến độ */}
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((currentSlide + (slideState === 'correct' ? 1 : 0)) / mcqs.length) * 100}%`, backgroundColor: '#27500A' }}
          />
        </div>
      </div>

      {/* Slide câu hỏi */}
      <div className="px-6 py-5">
        {/* Câu hỏi */}
        <p className="text-base font-semibold text-stone-800 mb-4 leading-snug">{q.question}</p>

        {/* Options */}
        <div className="space-y-2.5 mb-5">
          {q.options.map((opt: string, i: number) => {
            const isSelected = selectedAnswer === i
            const isCorrectOption = i === q.correct

            // Màu option sau khi đã chọn
            let optStyle: React.CSSProperties = { borderColor: '#E7E5E4', backgroundColor: 'white' }
            let labelStyle: React.CSSProperties = { backgroundColor: '#F5F5F4', color: '#78716C' }

            if (slideState !== 'idle') {
              if (isSelected && slideState === 'wrong') {
                // Chỉ highlight đỏ đáp án sai, không reveal đáp án đúng
                optStyle = { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }
                labelStyle = { backgroundColor: '#DC2626', color: 'white' }
              } else if (isSelected && slideState === 'correct') {
                // Highlight xanh khi chọn đúng
                optStyle = { borderColor: '#27500A', backgroundColor: '#EAF3DE' }
                labelStyle = { backgroundColor: '#27500A', color: 'white' }
              } else {
                // Các option còn lại mờ đi, không reveal
                optStyle = { borderColor: '#F0EFEE', backgroundColor: '#FAFAF9', opacity: 0.5 }
                labelStyle = { backgroundColor: '#F5F5F4', color: '#A8A29E' }
              }
            } else if (isSelected) {
              optStyle = { borderColor: '#1C1917', backgroundColor: '#F5F5F4' }
              labelStyle = { backgroundColor: '#1C1917', color: 'white' }
            }

            return (
              <button
                key={i}
                onClick={() => handleSelectOption(i)}
                disabled={slideState !== 'idle'}
                className="w-full text-left text-sm px-4 py-3 rounded-xl border transition-all flex items-center gap-3"
                style={optStyle}
              >
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 transition-all"
                  style={labelStyle}>
                  {slideState === 'correct' && isSelected
                    ? <i className="ti ti-check" style={{ fontSize: '11px' }} />
                    : slideState === 'wrong' && isSelected
                    ? <i className="ti ti-x" style={{ fontSize: '11px' }} />
                    : ['A','B','C','D'][i]}
                </span>
                <span className="flex-1">{opt}</span>
              </button>
            )
          })}
        </div>

        {/* Feedback + action */}
        {slideState === 'correct' && (
          <div className="space-y-3">
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: '#EAF3DE' }}>
              <i className="ti ti-circle-check text-lg" style={{ color: '#27500A' }} />
              <p className="text-sm font-medium" style={{ color: '#27500A' }}>Chính xác!</p>
            </div>
            <button
              onClick={handleNext}
              disabled={submitting}
              className="w-full text-sm font-medium text-white py-3 rounded-xl transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#1C1917' }}
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang nộp...</>
              ) : isLastSlide ? (
                <>Nộp bài kiểm tra <i className="ti ti-send" style={{ fontSize: '14px' }} /></>
              ) : (
                <>Câu tiếp <i className="ti ti-arrow-right" style={{ fontSize: '14px' }} /></>
              )}
            </button>
          </div>
        )}

        {slideState === 'wrong' && (
          <div className="space-y-3">
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5 bg-red-50">
              <i className="ti ti-circle-x text-lg text-red-500" />
              <p className="text-sm font-medium text-red-700">Chưa đúng — thử lại nhé!</p>
            </div>
            <button
              onClick={handleRetry}
              className="w-full text-sm font-medium py-3 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
            >
              Chọn lại đáp án
            </button>
          </div>
        )}
      </div>

      {/* Dot indicator */}
      <div className="px-6 pb-5 flex items-center justify-center gap-1.5">
        {mcqs.map((_, i) => {
          const isDone = i < currentSlide
          const isCurrent = i === currentSlide
          return (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: isCurrent ? '20px' : '6px',
                height: '6px',
                backgroundColor: isDone ? '#27500A' : isCurrent ? '#1C1917' : '#E7E5E4',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function PracticeSection({ lessonId, prompt, essays, tick1Done, tick2Done, userId }: {
  lessonId: number; prompt: string; essays: any[]; tick1Done: boolean; tick2Done: boolean; userId: string
}) {
  const [text, setText] = useState('')
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    let fileUrl = ''
    if (file) {
      const path = `${userId}/${lessonId}/${Date.now()}_${file.name}`
      const { data: uploadData } = await supabase.storage.from('submissions').upload(path, file)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(path)
        fileUrl = urlData.publicUrl
      }
    }
    const essayBlock = essays.length > 0
      ? essays.map((q, i) => `Câu hỏi tự luận ${i + 1}: ${q.question}\nTrả lời: ${essayAnswers[q.id] || '(chưa trả lời)'}`).join('\n\n')
      : ''
    const combinedText = [essayBlock, text].filter(Boolean).join('\n\n---\n\n')
    const res = await fetch('/api/submit-practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, userId, answer_text: combinedText, file_url: fileUrl })
    })
    if (res.ok) setSubmitted(true)
    setLoading(false)
  }

  const isLocked = !tick1Done

  return (
    <div className={`bg-white rounded-3xl border border-stone-200 p-6 shadow-sm transition-opacity ${isLocked ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
          style={
            tick2Done ? { backgroundColor: '#EAF3DE', color: '#27500A' } :
            isLocked ? { backgroundColor: '#F5F5F4', color: '#A8A29E' } :
            { backgroundColor: '#FEF3C7', color: '#92400E' }
          }>
          {tick2Done ? <i className="ti ti-check" /> : isLocked ? <i className="ti ti-lock" style={{fontSize:'12px'}} /> : '2'}
        </span>
        <h2 className={`${playfair.className} font-semibold text-stone-800`}>Bài tập thực hành</h2>
      </div>

      {isLocked ? (
        <p className="text-sm text-stone-400">Hoàn thành bài kiểm tra để mở phần này.</p>
      ) : tick2Done ? (
        <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ backgroundColor: '#EAF3DE' }}>
          <i className="ti ti-check" style={{ color: '#27500A' }} />
          <p className="text-sm" style={{ color: '#27500A' }}>Admin đã duyệt — bài kế tiếp đã mở.</p>
        </div>
      ) : submitted ? (
        <div className="bg-amber-50 rounded-2xl p-4 flex items-center gap-2.5">
          <i className="ti ti-clock text-amber-600" />
          <p className="text-sm text-amber-700">Đã nộp — đang chờ admin duyệt.</p>
        </div>
      ) : (
        <>
          {essays.length > 0 && (
            <div className="space-y-3 mb-4">
              {essays.map((q: any, qi: number) => (
                <div key={q.id} className="p-4 rounded-2xl bg-stone-50">
                  <p className="text-xs text-stone-400 mb-1">Câu hỏi tự luận {qi + 1}</p>
                  <p className="text-sm font-medium text-stone-800 mb-2">{q.question}</p>
                  <textarea rows={3}
                    className="w-full text-sm border border-stone-200 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:border-stone-400 transition-colors"
                    placeholder="Nhập câu trả lời..."
                    onChange={e => setEssayAnswers({...essayAnswers, [q.id]: e.target.value})} />
                </div>
              ))}
            </div>
          )}

          <p className="text-sm text-stone-600 mb-3">{prompt}</p>
          <textarea rows={4}
            className="w-full text-sm border border-stone-200 rounded-xl px-3.5 py-2.5 mb-3 focus:outline-none focus:border-stone-400 transition-colors"
            placeholder="Mô tả bài làm của bạn..."
            value={text} onChange={e => setText(e.target.value)} />

          <label className="block border border-dashed border-stone-300 rounded-xl px-4 py-3 mb-1 cursor-pointer hover:border-stone-400 transition-colors">
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <i className="ti ti-paperclip" />
              {file ? file.name : 'Đính kèm ảnh hoặc file PDF (tùy chọn)'}
            </div>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <p className="text-xs text-stone-400 mb-4">jpg, png, pdf — tối đa 10MB</p>

          <button onClick={handleSubmit} disabled={loading || !text}
            className="w-full text-sm text-white px-5 py-3 rounded-xl disabled:opacity-40 font-medium"
            style={{ backgroundColor: '#1C1917' }}>
            {loading ? 'Đang nộp...' : 'Nộp bài tập'}
          </button>
        </>
      )}
    </div>
  )
}