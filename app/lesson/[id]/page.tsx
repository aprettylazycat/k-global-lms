'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Lesson, Progress } from '@/types'

const NAVY = '#466898'
const GOLD = '#C9A84C'
const BLUE = '#0E62B1'
const CREAM = '#F5F0E8'
const BORDER = '#E2D8C8'

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = parseInt(params.id as string)

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [userId, setUserId] = useState<string>('')
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

      await supabase.from('lesson_timestamps').upsert(
        { user_id: session.user.id, lesson_id: lessonId, started_at: new Date().toISOString() },
        { onConflict: 'user_id,lesson_id' }
      )

      if (!prog?.tick1) {
        await supabase.from('lesson_timestamps').upsert(
          { user_id: session.user.id, lesson_id: lessonId, quiz_started_at: new Date().toISOString() },
          { onConflict: 'user_id,lesson_id' }
        )
      }

      setLoading(false)
    }
    load()
  }, [lessonId, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: CREAM }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BORDER, borderTopColor: NAVY }} />
      </div>
    )
  }
  if (!lesson) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm" style={{ backgroundColor: CREAM, color: NAVY }}>
        Không tìm thấy bài học.
      </div>
    )
  }

  const tick1Done = progress?.tick1 ?? false
  const tick2Done = progress?.tick2 ?? false
  const currentStep = !tick1Done ? 1 : !tick2Done ? 2 : 3

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: CREAM }}>

      {/* Top bar — navy */}
      <div className="px-5 py-3.5 sticky top-0 z-10" style={{ backgroundColor: NAVY, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 font-medium transition-opacity hover:opacity-70"
            style={{ color: 'white', fontSize: '14px' }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: '14px' }} />
            Dashboard
          </button>
          <StepIndicator currentStep={currentStep} />
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-5 pt-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-8 lg:items-start">

        {/* Cột trái */}
        <div className="space-y-5">
          <div className="rounded-3xl p-6" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
            <h1 className="text-xl lg:text-2xl font-bold mb-4" style={{ color: NAVY }}>
              {lesson.title}
            </h1>
            {lesson.youtube_id && (
              <div className="aspect-video rounded-2xl overflow-hidden mb-4" style={{ backgroundColor: CREAM }}>
                <iframe
                  src={`https://www.youtube.com/embed/${lesson.youtube_id}`}
                  className="w-full h-full" allowFullScreen
                />
              </div>
            )}
            <p className="text-sm leading-relaxed" style={{ color: '#4A5568' }}>{lesson.intro_text}</p>

            {(lesson as any).attachment_url && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ti ti-file-type-pdf" style={{ fontSize: '14px', color: NAVY }} />
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: NAVY }}>Tài liệu đính kèm</p>
                </div>
                <div className="rounded-2xl overflow-hidden" style={{ height: '520px', border: `1px solid ${BORDER}` }}>
                  <iframe
                    src={`https://docs.google.com/viewer?url=${encodeURIComponent((lesson as any).attachment_url)}&embedded=true`}
                    className="w-full h-full"
                    title="Tài liệu bài học"
                  />
                </div>
                <a href={(lesson as any).attachment_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: BLUE }}>
                  <i className="ti ti-external-link" style={{ fontSize: '12px' }} />
                  Mở PDF trong tab mới
                </a>
              </div>
            )}
          </div>

          <QuizSection
            lessonId={lessonId}
            questions={lesson.questions}
            tick1Done={tick1Done}
            userId={userId}
            onDone={() => setProgress((p: any) => p ? { ...p, tick1: true } : { tick1: true, tick2: false })}
          />
        </div>

        {/* Cột phải */}
        <div className="mt-5 lg:mt-0 lg:sticky lg:top-20">
          <PracticeSection
            lessonId={lessonId}
            prompt={lesson.practice_prompt}
            essays={lesson.questions.filter((q: any) => q.type === 'essay' && q.question?.trim())}
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
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: isDone || isActive ? GOLD : 'rgba(255,255,255,0.15)',
                  color: isDone || isActive ? NAVY : 'rgba(255,255,255,0.4)',
                }}>
                {isDone ? <i className="ti ti-check" style={{ fontSize: '10px' }} /> : s.n}
              </span>
              <span className="text-xs hidden sm:inline font-medium"
                style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.5)' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="w-4 border-t border-dashed" style={{ borderColor: 'rgba(255,255,255,0.25)' }} />
            )}
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
  const [slideState, setSlideState] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [submitted, setSubmitted] = useState(tick1Done)
  const [submitting, setSubmitting] = useState(false)
  const [attemptLog, setAttemptLog] = useState<Record<string, { selectedOption: number; isCorrect: boolean }[]>>({})

  const q = mcqs[currentSlide]
  const isLastSlide = currentSlide === mcqs.length - 1
  const selectedAnswer = answers[q?.id] ?? -1

  function handleSelectOption(optionIdx: number) {
    if (slideState !== 'idle') return
    const isCorrect = optionIdx === q.correct
    setAnswers(prev => ({ ...prev, [q.id]: optionIdx }))
    setSlideState(isCorrect ? 'correct' : 'wrong')
    setAttemptLog(prev => ({
      ...prev,
      [q.id]: [...(prev[q.id] || []), { selectedOption: optionIdx, isCorrect }]
    }))
  }

  function handleRetry() {
    setAnswers(prev => { const n = { ...prev }; delete n[q.id]; return n })
    setSlideState('idle')
  }

  async function handleNext() {
    if (isLastSlide) {
      setSubmitting(true)
      const res = await fetch('/api/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, userId, answers, attempts: attemptLog })
      })
      const data = await res.json()
      setSubmitting(false)
      if (res.ok && data.allCorrect) { setSubmitted(true); onDone() }
    } else {
      setCurrentSlide(prev => prev + 1)
      setSlideState('idle')
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl p-6" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: GOLD, color: NAVY }}>
            <i className="ti ti-check" />
          </span>
          <h2 className="font-semibold" style={{ color: NAVY }}>Bài kiểm tra</h2>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ backgroundColor: '#EAF3DE' }}>
          <i className="ti ti-check" style={{ color: '#27500A' }} />
          <p className="text-sm font-medium" style={{ color: '#27500A' }}>Đã hoàn thành bài kiểm tra — xem bài tập bên cạnh.</p>
        </div>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: NAVY, color: 'white' }}>1</span>
            <h2 className="font-semibold" style={{ color: NAVY }}>Bài kiểm tra</h2>
          </div>
          <span className="text-xs font-semibold" style={{ color: '#8AABC8' }}>Câu {currentSlide + 1}/{mcqs.length}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: CREAM }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((currentSlide + (slideState === 'correct' ? 1 : 0)) / mcqs.length) * 100}%`, backgroundColor: GOLD }} />
        </div>
      </div>

      {/* Slide */}
      <div className="px-6 py-5">
        <p className="text-base font-semibold mb-4 leading-snug" style={{ color: NAVY }}>{q.question}</p>

        <div className="space-y-2.5 mb-5">
          {q.options.map((opt: string, i: number) => {
            const isSelected = selectedAnswer === i
            let optStyle: React.CSSProperties = { borderColor: BORDER, backgroundColor: 'white' }
            let labelStyle: React.CSSProperties = { backgroundColor: CREAM, color: NAVY }

            if (slideState !== 'idle') {
              if (isSelected && slideState === 'wrong') {
                optStyle = { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }
                labelStyle = { backgroundColor: '#DC2626', color: 'white' }
              } else if (isSelected && slideState === 'correct') {
                optStyle = { borderColor: '#27500A', backgroundColor: '#EAF3DE' }
                labelStyle = { backgroundColor: '#27500A', color: 'white' }
              } else {
                optStyle = { borderColor: BORDER, backgroundColor: '#FAFAF9', opacity: 0.5 }
                labelStyle = { backgroundColor: CREAM, color: '#A8A29E' }
              }
            } else if (isSelected) {
              optStyle = { borderColor: NAVY, backgroundColor: '#EFF4F9' }
              labelStyle = { backgroundColor: NAVY, color: 'white' }
            }

            return (
              <button key={i} onClick={() => handleSelectOption(i)}
                disabled={slideState !== 'idle'}
                className="w-full text-left text-sm px-4 py-3 rounded-xl border transition-all flex items-center gap-3"
                style={optStyle}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all"
                  style={labelStyle}>
                  {slideState === 'correct' && isSelected
                    ? <i className="ti ti-check" style={{ fontSize: '11px' }} />
                    : slideState === 'wrong' && isSelected
                    ? <i className="ti ti-x" style={{ fontSize: '11px' }} />
                    : ['A', 'B', 'C', 'D'][i]}
                </span>
                <span className="flex-1 font-medium" style={{ color: NAVY }}>{opt}</span>
              </button>
            )
          })}
        </div>

        {slideState === 'correct' && (
          <div className="space-y-3">
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: '#EAF3DE' }}>
              <i className="ti ti-circle-check text-lg" style={{ color: '#27500A' }} />
              <p className="text-sm font-semibold" style={{ color: '#27500A' }}>Chính xác!</p>
            </div>
            <button onClick={handleNext} disabled={submitting}
              className="w-full text-sm font-semibold text-white py-3 rounded-xl transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: NAVY }}>
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
            <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5 bg-red-50 border border-red-100">
              <i className="ti ti-circle-x text-lg text-red-500" />
              <p className="text-sm font-semibold text-red-700">Chưa đúng — thử lại nhé!</p>
            </div>
            <button onClick={handleRetry}
              className="w-full text-sm font-semibold py-3 rounded-xl transition-colors"
              style={{ border: `1px solid ${BORDER}`, color: NAVY, backgroundColor: 'white' }}>
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
            <div key={i} className="rounded-full transition-all duration-300"
              style={{
                width: isCurrent ? '20px' : '6px',
                height: '6px',
                backgroundColor: isDone ? GOLD : isCurrent ? NAVY : BORDER,
              }} />
          )
        })}
      </div>
    </div>
  )
}

const MIN_ESSAY_CHARS = 150

function PracticeSection({ lessonId, prompt, essays, tick1Done, tick2Done, userId }: {
  lessonId: number; prompt: string; essays: any[]; tick1Done: boolean; tick2Done: boolean; userId: string
}) {
  const [text, setText] = useState('')
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showCongrats, setShowCongrats] = useState(false)

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
    if (res.ok) { setSubmitted(true); setShowCongrats(true) }
    setLoading(false)
  }

  useEffect(() => {
    if (!tick1Done || tick2Done) return
    supabase.from('lesson_timestamps')
      .update({ practice_started_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('lesson_id', lessonId)
      .then(() => {})
  }, [tick1Done]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showCongrats) return
    const canvas = document.getElementById('congrats-canvas') as HTMLCanvasElement
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const colors = ['#E63946','#F4A261','#2A9D8F','#E9C46A','#264653','#A8DADC','#F7B731','#6C5CE7','#00B894','#FD79A8','#FDCB6E','#0984E3','#E17055','#55EFC4']
    const particles: any[] = []
    function spawnBurst(x: number) {
      for (let i = 0; i < 14; i++) {
        particles.push({ x, y: -8, vx: (Math.random()-0.5)*4, vy: Math.random()*2.5+1, size: Math.random()*7+3, color: colors[Math.floor(Math.random()*colors.length)], rotation: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*0.25, alpha: 1, shape: Math.random()>0.4?'rect':'circle', wobbleSpeed: Math.random()*0.1, wobbleOffset: Math.random()*Math.PI*2 })
      }
    }
    let tick = 0
    const spawnTicks = [0,5,10,18,25,35,45,55,68,80,95,110]
    let rafId: number
    function animate() {
      ctx.clearRect(0,0,canvas.width,canvas.height)
      if (spawnTicks.includes(tick)) spawnBurst(20+Math.random()*(canvas.width-40))
      for (let i = particles.length-1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx + Math.sin(tick*p.wobbleSpeed+p.wobbleOffset)*0.6
        p.vy += 0.06; p.y += p.vy; p.rotation += p.rotSpeed
        if (p.y > canvas.height+10) { particles.splice(i,1); continue }
        if (p.y > canvas.height*0.7) p.alpha -= 0.02
        if (p.alpha <= 0) { particles.splice(i,1); continue }
        ctx.save(); ctx.globalAlpha = Math.max(0,p.alpha); ctx.translate(p.x,p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color
        if (p.shape==='rect') ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*0.45)
        else { ctx.beginPath(); ctx.arc(0,0,p.size/2.2,0,Math.PI*2); ctx.fill() }
        ctx.restore()
      }
      tick++
      if (tick < 180 || particles.length > 0) rafId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(rafId)
  }, [showCongrats])

  const isLocked = !tick1Done

  if (showCongrats) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl">
        <canvas id="congrats-canvas" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />
        <div className="relative p-8 text-center" style={{ zIndex: 1 }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: NAVY }}>
            <i className="ti ti-trophy" style={{ color: GOLD, fontSize: '28px' }} />
          </div>
          <p className="text-2xl font-bold mb-2" style={{ color: NAVY }}>Chúc mừng!</p>
          <p className="text-sm font-medium mb-8" style={{ color: '#8AABC8' }}>
            Bài tập đã được nộp thành công —<br />đang chờ admin duyệt.
          </p>
          <button
            onClick={() => window.location.href = `/lesson/${lessonId + 1}`}
            className="w-full text-sm font-semibold text-white py-3 rounded-xl flex items-center justify-center gap-2 mb-3 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: NAVY }}>
            Sang bài tiếp theo <i className="ti ti-arrow-right" style={{ fontSize: '14px' }} />
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="w-full text-sm font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
            style={{ border: `1px solid ${BORDER}`, color: '#8AABC8' }}>
            <i className="ti ti-layout-dashboard" style={{ fontSize: '14px' }} />
            Về Dashboard
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`rounded-3xl p-6 transition-opacity ${isLocked ? 'opacity-50' : ''}`}
      style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={
            tick2Done ? { backgroundColor: '#EAF3DE', color: '#27500A' } :
            isLocked ? { backgroundColor: CREAM, color: '#A8A29E' } :
            { backgroundColor: GOLD, color: NAVY }
          }>
          {tick2Done ? <i className="ti ti-check" /> : isLocked ? <i className="ti ti-lock" style={{ fontSize: '12px' }} /> : '2'}
        </span>
        <div>
          <h2 className="font-semibold" style={{ color: NAVY }}>Bài tập thực hành</h2>
          <p className="text-xs font-medium mt-0.5" style={{ color: '#8AABC8' }}>Tối thiểu {MIN_ESSAY_CHARS} ký tự mỗi câu tự luận</p>
        </div>
      </div>

      {isLocked ? (
        <p className="text-sm font-medium" style={{ color: '#8AABC8' }}>Hoàn thành bài kiểm tra để mở phần này.</p>
      ) : tick2Done ? (
        <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ backgroundColor: '#EAF3DE' }}>
          <i className="ti ti-check" style={{ color: '#27500A' }} />
          <p className="text-sm font-semibold" style={{ color: '#27500A' }}>Admin đã duyệt — bài kế tiếp đã mở.</p>
        </div>
      ) : submitted ? (
        <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#EAF3DE' }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ backgroundColor: '#27500A' }}>
            <i className="ti ti-trophy" style={{ color: '#EAF3DE', fontSize: '24px' }} />
          </div>
          <p className="text-lg font-bold mb-1" style={{ color: '#173404' }}>Chúc mừng!</p>
          <p className="text-sm font-medium" style={{ color: '#3D6B1E' }}>
            Bài tập đã được nộp thành công — đang chờ admin duyệt.
          </p>
        </div>
      ) : (
        <>
          {essays.length > 0 && (
            <div className="space-y-3 mb-4">
              {essays.map((q: any, qi: number) => (
                <div key={q.id} className="p-4 rounded-2xl" style={{ backgroundColor: CREAM, border: `1px solid ${BORDER}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#8AABC8' }}>Câu hỏi tự luận {qi + 1}</p>
                  <p className="text-sm font-semibold mb-2" style={{ color: NAVY }}>{q.question}</p>
                  <textarea rows={3}
                    className="w-full text-sm rounded-xl px-3.5 py-2.5 focus:outline-none transition-colors resize-none"
                    style={{ border: `1px solid ${BORDER}`, backgroundColor: 'white', color: NAVY }}
                    placeholder="Nhập câu trả lời..."
                    value={essayAnswers[q.id] || ''}
                    onChange={e => setEssayAnswers({ ...essayAnswers, [q.id]: e.target.value })} />
                  <div className="flex justify-end mt-1">
                    <span className="text-xs font-medium"
                      style={{ color: (essayAnswers[q.id] || '').length >= MIN_ESSAY_CHARS ? '#27500A' : '#8AABC8' }}>
                      {(essayAnswers[q.id] || '').length}/{MIN_ESSAY_CHARS} ký tự
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-sm font-medium mb-3" style={{ color: NAVY }}>{prompt}</p>
          <textarea rows={4}
            className="w-full text-sm rounded-xl px-3.5 py-2.5 mb-3 focus:outline-none transition-colors resize-none"
            style={{ border: `1px solid ${BORDER}`, backgroundColor: 'white', color: NAVY }}
            placeholder="Mô tả bài làm của bạn..."
            value={text} onChange={e => setText(e.target.value)} />

          <label className="block rounded-xl px-4 py-3 mb-1 cursor-pointer transition-colors"
            style={{ border: `1.5px dashed ${BORDER}`, backgroundColor: 'white' }}>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#8AABC8' }}>
              <i className="ti ti-paperclip" />
              {file ? file.name : 'Đính kèm ảnh hoặc file PDF (tùy chọn)'}
            </div>
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <p className="text-xs font-medium mb-4" style={{ color: '#8AABC8' }}>jpg, png, pdf — tối đa 10MB</p>

          <button onClick={handleSubmit}
            disabled={loading || !text || essays.some((q: any) => (essayAnswers[q.id] || '').length < MIN_ESSAY_CHARS)}
            className="w-full text-sm font-semibold text-white px-5 py-3 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: NAVY }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang nộp...
              </span>
            ) : 'Nộp bài tập'}
          </button>
        </>
      )}
    </div>
  )
}