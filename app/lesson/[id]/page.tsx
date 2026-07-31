'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Lesson, Progress } from '@/types'
import Mascot from '@/components/Mascot'
import { SPACE, PANEL, CHIP, RAISED, TEXT, MUTED, FAINT, GOLD, GOLD_GLOW, GOLD_SOFT, NAVY, BLUE, BORDER, BORDER_STRONG, CREAM, OK, OK_BG, OK_BORDER, WARN, WARN_BG, WARN_BORDER, ERR, ERR_BG, ERR_BORDER, INFO, INFO_BG, INFO_BORDER, SHADOW } from '@/lib/theme'

const DARK_ON_GOLD = '#0A0E1A'

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const lessonId = parseInt(params.id as string)

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [nextLessonId, setNextLessonId] = useState<number | null>(null)  // ← thêm ở đây
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setUserId(session.user.id)

      const { data: lessonData } = await supabase
        .from('lessons').select('*').eq('id', lessonId).single()
      setLesson(lessonData)

      // Kiểm tra thật sự đã mở khoá bài này chưa — không chỉ dựa vào UI dashboard
      if (lessonData) {
        const { data: allModules } = await supabase
          .from('modules').select('id, order_index, unlock_mode')
          .eq('branch_id', lessonData.branch_id)
          .order('order_index', { ascending: true })

        const { data: allLessons } = await supabase
          .from('lessons').select('id, module_id, order_index')
          .eq('branch_id', lessonData.branch_id)
          .eq('is_published', true)

        const { data: allProgress } = await supabase
          .from('progress').select('lesson_id, tick1')
          .eq('user_id', session.user.id)

        if (allModules && allLessons) {
          const progressByLesson = new Map((allProgress ?? []).map((p: any) => [p.lesson_id, p.tick1]))
          const orderedLessons = allModules.flatMap(m =>
            allLessons.filter(l => l.module_id === m.id).sort((a, b) => a.order_index - b.order_index)
          )
          const idx = orderedLessons.findIndex(l => l.id === lessonId)
          const currentModule = allModules.find(m => m.id === lessonData.module_id)

          if (currentModule?.unlock_mode === 'full') {
            const firstModuleId = allModules[0]?.id
            if (lessonData.module_id === firstModuleId) {
              // Chính module này là module đầu tiên -> luôn mở sẵn, không cần điều kiện gì
            } else {
              // Module "mở full" khác: chỉ cần Module 1 xong hết là mọi bài trong module này mở luôn
              const firstModuleLessons = allLessons.filter(l => l.module_id === firstModuleId)
              const unlocked = firstModuleLessons.every(l => progressByLesson.get(l.id))
              if (!unlocked) {
                setLocked(true)
                setLoading(false)
                return
              }
            }
          } else if (idx > 0) {
            const prevLesson = orderedLessons[idx - 1]
            let unlocked: boolean
            if (lessonData.module_id !== prevLesson.module_id) {
              if (currentModule?.unlock_mode === 'open') {
                unlocked = true
              } else {
                const firstModuleId = allModules[0]?.id
                const firstModuleLessons = allLessons.filter(l => l.module_id === firstModuleId)
                unlocked = firstModuleLessons.every(l => progressByLesson.get(l.id))
              }
            } else {
              unlocked = !!progressByLesson.get(prevLesson.id)
            }
            if (!unlocked) {
              setLocked(true)
              setLoading(false)
              return
            }
          }
        }
      }

      // Fetch bài tiếp theo trong cùng module
      if (lessonData) {
        const { data: nextLesson } = await supabase
          .from('lessons')
          .select('id')
          .eq('branch_id', lessonData.branch_id)
          .eq('module_id', lessonData.module_id)
          .eq('is_published', true)
          .gt('order_index', lessonData.order_index)
          .order('order_index', { ascending: true })
          .limit(1)
          .maybeSingle()
        setNextLessonId(nextLesson?.id ?? null)

        // Nếu bài no_quiz → gọi API để tự động mark tick1+tick2=true (server-side, có xác thực)
        // API tự kiểm tra đã hoàn thành chưa — chỉ ghi 1 lần duy nhất, giữ nguyên completed_at gốc
        if (lessonData.no_quiz) {
          await fetch('/api/mark-no-quiz-done', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ lessonId })
          })
        }
      }

      const { data: prog } = await supabase
        .from('progress')
        .select('lesson_id, tick1, tick2, completed_at, perfect_score')
        .eq('user_id', session.user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle()
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
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: SPACE, color: TEXT }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BORDER, borderTopColor: GOLD }} />
      </div>
    )
  }
  if (!lesson) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm" style={{ backgroundColor: SPACE, color: TEXT }}>
        Không tìm thấy bài học.
      </div>
    )
  }
  if (locked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6" style={{ backgroundColor: SPACE, color: TEXT }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: PANEL, border: `2px solid ${BORDER}` }}>
          <i className="ti ti-lock" style={{ fontSize: '24px', color: TEXT }} />
        </div>
        <p className="text-base font-bold mb-2" style={{ color: TEXT }}>Bài học này chưa được mở khoá</p>
        <p className="text-sm mb-6" style={{ color: MUTED }}>Hoàn thành bài học trước đó để mở bài này nhé.</p>
        <button onClick={() => router.push('/dashboard')}
          className="text-sm font-semibold text-white px-5 py-3 rounded-xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
          Về Dashboard
        </button>
      </div>
    )
  }

  const noQuiz = (lesson as any).no_quiz === true
  const tick1Done = noQuiz ? true : (progress?.tick1 ?? false)
  const tick2Done = progress?.tick2 ?? false
  const currentStep = !tick1Done ? 1 : !tick2Done ? 2 : 3

  const noPractice = !((lesson.practice_prompt ?? '').trim()) &&
  lesson.questions.filter((q: any) => q.type === 'essay' && q.question?.trim()).length === 0
  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: SPACE, color: TEXT }}>

      {/* Top bar — navy */}
      <div className="px-5 py-3.5 sticky top-0 z-10" style={{ backgroundColor: 'rgba(7,11,21,0.88)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-1.5 font-medium transition-opacity hover:opacity-70"
            style={{ color: TEXT, fontSize: '14px' }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: '14px' }} />
            Dashboard
          </button>
          <StepIndicator currentStep={currentStep} />
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">

        {/* Cột trái */}
        <div className="space-y-5">
          <div className="rounded-3xl p-6" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
            <h1 className="text-xl lg:text-2xl font-bold mb-4" style={{ color: TEXT }}>
              {lesson.title}
            </h1>
            {(lesson.youtube_id || lesson.video_url) && (
              <div className="aspect-video rounded-2xl overflow-hidden mb-4" style={{ backgroundColor: SPACE, color: TEXT }}>
                <iframe
                  src={lesson.youtube_id
                  ? `https://www.youtube.com/embed/${lesson.youtube_id}`
                  : lesson.video_url || undefined} 
                  className="w-full h-full"
                  allow="autoplay"
                  allowFullScreen
                />
              </div>
            )}
            {lesson.youtube_id_2 && (
  <div className="mt-3">
    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: TEXT }}>
      Video xem thêm
    </p>
    <div className="aspect-video rounded-2xl overflow-hidden" style={{ backgroundColor: SPACE, color: TEXT }}>
      <iframe
        src={`https://www.youtube.com/embed/${lesson.youtube_id_2}`}
        className="w-full h-full"
        allow="autoplay"
        allowFullScreen
      />
    </div>
  </div>
)}
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: MUTED }}>
  {renderTextWithLinks(lesson.intro_text)}
</p>

            {(lesson as any).attachment_url && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <i className="ti ti-file-type-pdf" style={{ fontSize: '14px', color: TEXT }} />
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: TEXT }}>Tài liệu đính kèm</p>
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

          {noQuiz ? (
            <div className="rounded-3xl p-6" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: GOLD, color: TEXT }}>
                  <i className="ti ti-check" />
                </span>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>
                  Bài này không có bài kiểm tra — xem xong video là hoàn thành phần lý thuyết.
                </p>
              </div>
            </div>
          ) : (
            <QuizSection
              lessonId={lessonId}
              questions={lesson.questions}
              tick1Done={tick1Done}
              userId={userId}
              onDone={() => setProgress((p: any) => p ? { ...p, tick1: true } : { tick1: true, tick2: false })}
            />
          )}
        </div>

        {/* Cột phải */}
        <div className="space-y-5">
          {noQuiz ? (
            <div className="rounded-3xl p-6" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: GOLD, color: TEXT }}>
                  <i className="ti ti-check" />
                </span>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>
                  Bài học này không có bài tập — xem xong video là hoàn thành!
                </p>
              </div>
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => {
                    if (nextLessonId) {
                      window.location.href = `/lesson/${nextLessonId}`
                    } else {
                      window.location.href = '/dashboard'
                    }
                  }}
                  className="w-full text-sm font-semibold text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
                  {nextLessonId ? (
                    <>Sang bài tiếp theo <i className="ti ti-arrow-right" style={{ fontSize: '14px' }} /></>
                  ) : (
                    <>Hoàn thành khóa học <i className="ti ti-trophy" style={{ fontSize: '14px' }} /></>
                  )}
                </button>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="w-full text-sm font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                  style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
                  <i className="ti ti-layout-dashboard" style={{ fontSize: '14px' }} />
                  Về Dashboard
                </button>
              </div>
            </div>
          ) : (
            <PracticeSection
              lessonId={lessonId}
              nextLessonId={nextLessonId}
              prompt={lesson.practice_prompt}
              essays={lesson.questions.filter((q: any) => q.type === 'essay' && q.question?.trim())}
              tick1Done={tick1Done}
              tick2Done={tick2Done}
              perfectScore={(progress as any)?.perfect_score}
              userId={userId}
              recapContent={(lesson as any).recap_content}
              noPractice={noPractice}
            />
          )}
        </div>
      </div>
      <Mascot variant="study" />
    </div>
  )
}

function renderTextWithLinks(text: string) {
  if (!text) return null
  // Tách theo **bold** trước — split với regex có capturing group cho ra mảng xen kẽ [thường, đậm, thường, đậm, ...]
  const boldChunks = text.split(/\*\*(.+?)\*\*/g)
  let key = 0
  return boldChunks.map((chunk, idx) => {
    const isBold = idx % 2 === 1 // các phần tử ở vị trí lẻ là nội dung nằm giữa **...**
    const urlParts = chunk.split(/(https?:\/\/[^\s]+)/g)
    return urlParts.map(part => {
      key++
      const isUrl = /^https?:\/\//.test(part)
      if (isUrl) {
        return (
          <a key={key} href={part} target="_blank" rel="noreferrer"
            className="underline break-all"
            style={{ color: NAVY, fontWeight: isBold ? 700 : undefined }}
            onClick={e => e.stopPropagation()}>
            {part}
          </a>
        )
      }
      return isBold ? <strong key={key}>{part}</strong> : <span key={key}>{part}</span>
    })
  })
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
                  color: isDone || isActive ? DARK_ON_GOLD : FAINT,
                }}>
                {isDone ? <i className="ti ti-check" style={{ fontSize: '10px' }} /> : s.n}
              </span>
              <span className="text-xs hidden sm:inline font-medium"
                style={{ color: isActive ? TEXT : FAINT }}>
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
  const trueFalseGroups = questions.filter(q => q.type === 'true_false')

  const [currentSlide, setCurrentSlide] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [slideState, setSlideState] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [submitted, setSubmitted] = useState(tick1Done)
  const [submitting, setSubmitting] = useState(false)
  const [attemptLog, setAttemptLog] = useState<Record<string, { selectedOption: number; isCorrect: boolean }[]>>({})

  // True/False state
  const [tfAnswers, setTfAnswers] = useState<Record<number, Record<number, boolean>>>({})
  const [tfSubmitted, setTfSubmitted] = useState<Record<number, boolean>>({})
  const [tfResults, setTfResults] = useState<Record<number, boolean>>({})
// Tự động hoàn thành bước 1 nếu bài không có MCQ và không có Đúng/Sai (chỉ có tự luận)
  useEffect(() => {
    if (tick1Done || submitted) return
    if (mcqs.length > 0 || trueFalseGroups.length > 0) return
    async function autoComplete() {
      setSubmitting(true)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ lessonId, answers: {}, attempts: {}, tfAnswers: {}, tfQuestions: [] })  // bỏ userId
      })
      setSubmitting(false)
      if (res.ok) {
        setSubmitted(true)
        onDone()
      }
    }
    autoComplete()
  }, [mcqs.length, trueFalseGroups.length, tick1Done, submitted]) // eslint-disable-line react-hooks/exhaustive-deps
  const allTfDone = trueFalseGroups.length === 0 ||
    trueFalseGroups.every(g => tfSubmitted[g.id])
  const allTfCorrect = trueFalseGroups.every(g => tfResults[g.id])

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

  function handleTfToggle(groupId: number, itemId: number, value: boolean) {
    if (tfSubmitted[groupId]) return
    setTfAnswers(prev => ({
      ...prev,
      [groupId]: { ...(prev[groupId] || {}), [itemId]: value }
    }))
  }

  function handleTfSubmit(group: any) {
    const answers = tfAnswers[group.id] || {}
    const allCorrect = group.items.every((item: any) => answers[item.id] === item.correct)
    setTfSubmitted(prev => ({ ...prev, [group.id]: true }))
    setTfResults(prev => ({ ...prev, [group.id]: allCorrect }))
  }

  async function handleNext() {
    if (isLastSlide) {
      if (!allTfDone) return // chờ TF xong
      setSubmitting(true)
     const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          lessonId, answers, attempts: attemptLog,   // bỏ userId
          tfAnswers, tfQuestions: trueFalseGroups
        })
      })
      const data = await res.json()
      setSubmitting(false)
      if (res.ok) {
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
      <div className="rounded-3xl p-6" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: GOLD, color: TEXT }}>
            <i className="ti ti-check" />
          </span>
          <h2 className="font-semibold" style={{ color: TEXT }}>Bài kiểm tra</h2>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-2.5" style={{ backgroundColor: OK_BG, border: `1px solid ${OK_BORDER}` }}>
          <i className="ti ti-check" style={{ color: OK }} />
          <p className="text-sm font-medium" style={{ color: OK }}>Đã hoàn thành bài kiểm tra — xem bài tập bên cạnh.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* MCQ slides */}
      {mcqs.length > 0 && q && (
        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
          {/* Header */}
          <div className="px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: CHIP, color: GOLD }}>1</span>
                <h2 className="font-semibold" style={{ color: TEXT }}>Bài kiểm tra</h2>
              </div>
              <span className="text-xs font-semibold" style={{ color: MUTED }}>Câu {currentSlide + 1}/{mcqs.length}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: SPACE, color: TEXT }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${((currentSlide + (slideState === 'correct' ? 1 : 0)) / mcqs.length) * 100}%`, backgroundColor: GOLD }} />
            </div>
          </div>

          {/* Slide */}
          <div className="px-6 py-5">
            <p className="text-base font-semibold mb-4 leading-snug" style={{ color: TEXT }}>{q.question}</p>
            <div className="space-y-2.5 mb-5">
              {q.options.map((opt: string, i: number) => {
                const isSelected = selectedAnswer === i
                let optStyle: React.CSSProperties = { borderColor: BORDER, backgroundColor: PANEL }
                let labelStyle: React.CSSProperties = { backgroundColor: CHIP, color: MUTED }
                if (slideState !== 'idle') {
                  if (isSelected && slideState === 'wrong') {
                    optStyle = { borderColor: ERR, backgroundColor: ERR_BG }
                    labelStyle = { backgroundColor: ERR, color: DARK_ON_GOLD }
                  } else if (isSelected && slideState === 'correct') {
                    optStyle = { borderColor: OK, backgroundColor: OK_BG }
                    labelStyle = { backgroundColor: OK, color: DARK_ON_GOLD }
                  } else {
                    optStyle = { borderColor: BORDER, backgroundColor: PANEL, opacity: 0.5 }
                    labelStyle = { backgroundColor: SPACE, color: FAINT }
                  }
                } else if (isSelected) {
                  optStyle = { borderColor: GOLD, backgroundColor: GOLD_SOFT }
                  labelStyle = { backgroundColor: CHIP, color: GOLD }
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
                        : ['A', 'B', 'C', 'D', 'E', 'F'][i]}
                    </span>
                    <span className="flex-1 font-medium" style={{ color: TEXT }}>{opt}</span>
                  </button>
                )
              })}
            </div>
            {slideState === 'correct' && (
              <div className="space-y-3">
                <div className="rounded-2xl px-4 py-3 flex items-center gap-2.5" style={{ backgroundColor: OK_BG, border: `1px solid ${OK_BORDER}` }}>
                  <i className="ti ti-circle-check text-lg" style={{ color: OK }} />
                  <p className="text-sm font-semibold" style={{ color: OK }}>Chính xác!</p>
                </div>
                <button onClick={handleNext} disabled={submitting || (isLastSlide && !allTfDone)}
                  className="w-full text-sm font-semibold text-white py-3 rounded-xl transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang nộp...</>
                  ) : isLastSlide ? (
                    allTfDone
                      ? <>Nộp bài kiểm tra <i className="ti ti-send" style={{ fontSize: '14px' }} /></>
                      : <>Hoàn thành Đúng/Sai bên dưới trước <i className="ti ti-arrow-down" style={{ fontSize: '14px' }} /></>
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
                  style={{ border: `1px solid ${BORDER}`, color: TEXT, backgroundColor: PANEL }}>
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
                    backgroundColor: isDone ? GOLD : isCurrent ? BLUE : BORDER,
                  }} />
              )
            })}
          </div>
        </div>
      )}

      {/* True/False sections */}
{trueFalseGroups.map((group: any) => {
  const answeredCount = group.items.filter((item: any) => tfAnswers[group.id]?.[item.id] !== undefined).length
  const totalCount = group.items.length
  const pct = Math.round((answeredCount / totalCount) * 100)
  const isSubmitted = tfSubmitted[group.id]

  return (
    <div key={group.id} className="rounded-3xl overflow-hidden" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: isSubmitted ? (tfResults[group.id] ? OK_BG : ERR_BG) : CHIP }}>
              {isSubmitted
                ? <i className={`ti ti-${tfResults[group.id] ? 'check' : 'x'}`} style={{ fontSize: '16px', color: tfResults[group.id] ? OK : ERR }} />
                : <i className="ti ti-list-check" style={{ fontSize: '16px', color: TEXT }} />}
            </span>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: TEXT }}>Đúng / Sai</h2>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>{group.question}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-semibold" style={{ color: answeredCount === totalCount ? OK : MUTED }}>
              Đã trả lời {answeredCount}/{totalCount} câu
            </p>
            <div className="w-24 h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ backgroundColor: SPACE, color: TEXT }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, backgroundColor: answeredCount === totalCount ? OK : GOLD }} />
            </div>
            <p className="text-xs mt-1" style={{ color: MUTED }}>{pct}%</p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-6 py-4 space-y-3">
        {group.items.map((item: any, idx: number) => {
          const selected = tfAnswers[group.id]?.[item.id]
          const isCorrect = isSubmitted ? selected === item.correct : null
          return (
            <div key={item.id} className="flex items-start gap-3 py-3 px-4 rounded-2xl transition-all"
              style={{
                border: `1px solid ${isSubmitted ? (isCorrect ? OK_BORDER : ERR_BORDER) : BORDER}`,
                backgroundColor: isSubmitted ? (isCorrect ? OK_BG : ERR_BG) : PANEL
              }}>
              {/* Số thứ tự */}
              <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: isSubmitted ? (isCorrect ? OK : ERR) : (selected !== undefined ? BLUE : BORDER),
                  color: DARK_ON_GOLD
                }}>
                {isSubmitted
                  ? <i className={`ti ti-${isCorrect ? 'check' : 'x'}`} style={{ fontSize: '10px' }} />
                  : idx + 1}
              </span>

              {/* Statement */}
              <p className="flex-1 text-sm font-medium" style={{ color: TEXT }}>{item.statement}</p>

              {/* Buttons */}
              <div className="flex gap-2 flex-shrink-0">
                {[true, false].map(val => {
                  const isSelected = selected === val
                  const label = val ? 'Đúng' : 'Sai'
                  const showResult = isSubmitted && isSelected
                  const resultCorrect = showResult && isCorrect

                  let bg = PANEL
                  let border = BORDER
                  let color = MUTED
                  if (!isSubmitted && isSelected) { bg = BLUE; border = BLUE; color = DARK_ON_GOLD }
                  if (isSubmitted && isSelected && isCorrect) { bg = OK; border = OK; color = DARK_ON_GOLD }
                  if (isSubmitted && isSelected && !isCorrect) { bg = ERR; border = ERR; color = DARK_ON_GOLD }

                  return (
                    <button key={String(val)}
                      onClick={() => handleTfToggle(group.id, item.id, val)}
                      disabled={isSubmitted}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                      style={{ backgroundColor: bg, border: `1.5px solid ${border}`, color, minWidth: '72px', justifyContent: 'center' }}>
                      {showResult
                        ? <i className={`ti ti-${resultCorrect ? 'check' : 'x'}`} style={{ fontSize: '13px' }} />
                        : <i className={`ti ti-${val ? 'check' : 'x'}`} style={{ fontSize: '13px', opacity: 0.5 }} />}
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Đáp án đúng nếu sai */}
              {isSubmitted && !isCorrect && (
                <span className="text-xs font-semibold flex-shrink-0" style={{ color: ERR }}>
                  → {item.correct ? 'Đúng' : 'Sai'}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-6 pb-5">
        {!isSubmitted ? (
          <div>
            <button
              onClick={() => handleTfSubmit(group)}
              disabled={answeredCount === 0}
              className="w-full text-sm font-semibold text-white py-3 rounded-xl transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
              <i className="ti ti-clipboard-check" style={{ fontSize: '14px' }} />
              Kiểm tra đáp án
            </button>
            <p className="text-xs text-center mt-2" style={{ color: MUTED }}>
              <i className="ti ti-lock" style={{ fontSize: '11px' }} /> Bạn có thể kiểm tra đáp án bất cứ lúc nào trước khi hoàn thành.
            </p>
          </div>
        ) : (
          <div className="rounded-xl px-4 py-3 flex items-center gap-2.5"
            style={{ backgroundColor: tfResults[group.id] ? OK_BG : ERR_BG }}>
            <i className={`ti ti-${tfResults[group.id] ? 'circle-check' : 'circle-x'}`}
              style={{ color: tfResults[group.id] ? OK : ERR, fontSize: '18px' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: tfResults[group.id] ? OK : ERR }}>
                {tfResults[group.id]
                  ? `Xuất sắc! Tất cả ${totalCount} câu đều đúng.`
                  : `${group.items.filter((i: any) => tfAnswers[group.id]?.[i.id] === i.correct).length}/${totalCount} câu đúng — xem đáp án bên trên.`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})}

      {/* Nút nộp cuối nếu CÓ Đúng/Sai nhưng không có MCQ (trường hợp chỉ tự luận đã tự động xử lý ở useEffect trên) */}
      {mcqs.length === 0 && trueFalseGroups.length > 0 && allTfDone && (
        <button onClick={async () => {
          setSubmitting(true)
         const { data: { session } } = await supabase.auth.getSession()
          const res = await fetch('/api/submit-quiz', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({
              lessonId, answers: {}, attempts: {},   // bỏ userId
              tfAnswers, tfQuestions: trueFalseGroups
            })
          })
          const data = await res.json()
          setSubmitting(false)
          if (res.ok) {
            setSubmitted(true)
            onDone()
            }
        }} disabled={submitting}
          className="w-full text-sm font-semibold text-white py-3 rounded-xl transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
          {submitting
            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang nộp...</>
            : <>Nộp bài kiểm tra <i className="ti ti-send" style={{ fontSize: '14px' }} /></>}
        </button>
      )}
    </div>
  )
}

const MIN_ESSAY_CHARS = 150
const DRAFT_KEY = (lessonId: number) => `draft_lesson_${lessonId}`

function PracticeSection({ lessonId, nextLessonId, prompt, essays, tick1Done, tick2Done, userId, recapContent, noPractice, perfectScore }: {
  lessonId: number; nextLessonId: number | null; prompt: string; essays: any[]; tick1Done: boolean; tick2Done: boolean; userId: string; recapContent?: string; noPractice?: boolean; perfectScore?: boolean
}) {
  const [text, setText] = useState('')
  const [essayAnswers, setEssayAnswers] = useState<Record<number, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showCongrats, setShowCongrats] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState<'pending' | 'rejected' | 'approved' | null>(null)
  const [approvedAnswerText, setApprovedAnswerText] = useState<string | null>(null)
  const [approvedFileUrl, setApprovedFileUrl] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<string | null>(null)
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [resubmitting, setResubmitting] = useState(false)
  const MAX_ATTEMPTS = 3
  const FINAL_ATTEMPT_MESSAGES = [
    { title: 'Cơ hội cuối rồi!', body: 'Cố lên — đạt Perfect nào! 💪' },
    { title: 'Vượt giới hạn bản thân!', body: 'Đây là lần cuối, dồn hết sức nhé! 🔥' },
    { title: 'Đạt Perfect ngay!', body: 'Làm thật chính xác để nhận thưởng liền tay 🎁' },
    { title: 'Chỉ còn 1 lần này thôi!', body: 'Đọc kỹ, làm chậm mà chắc — bạn làm được mà! ⭐' },
  ]
  const [finalMsgIndex, setFinalMsgIndex] = useState(() => Math.floor(Math.random() * FINAL_ATTEMPT_MESSAGES.length))
  const finalMessage = FINAL_ATTEMPT_MESSAGES[finalMsgIndex]

  // Xoay vòng câu cổ vũ mỗi 15s khi đang ở lượt nộp cuối cùng
  useEffect(() => {
    if (attemptsUsed + 1 !== MAX_ATTEMPTS) return
    const timer = setInterval(() => {
      setFinalMsgIndex(prev => (prev + 1) % FINAL_ATTEMPT_MESSAGES.length)
    }, 15000)
    return () => clearInterval(timer)
  }, [attemptsUsed])

  // Load draft từ localStorage khi mở bài
  useEffect(() => {
    if (!tick1Done || !userId) return
    async function fetchSubmission() {
      const { data: progRow } = await supabase
        .from('progress')
        .select('attempt_reset_at')
        .eq('user_id', userId)
        .eq('lesson_id', lessonId)
        .maybeSingle()
      const resetAt = (progRow as any)?.attempt_reset_at ?? null

      const { data } = await supabase
        .from('submissions')
        .select('status, reject_reason, submitted_at, attempt_number, answer_text, file_url')
        .eq('lesson_id', lessonId)
        .eq('user_id', userId)
        .order('attempt_number', { ascending: false })
      const rows = data ?? []
      // Chỉ đếm những lần nộp SAU mốc admin cấp lại lượt gần nhất (nếu có)
      const countedRows = resetAt ? rows.filter(r => r.submitted_at && r.submitted_at > resetAt) : rows
      setAttemptsUsed(countedRows.length)
      const latest = rows[0]
      if (!latest) return
      if (latest.status === 'pending') {
        setSubmitted(true)
        setSubmissionStatus('pending')
      } else if (latest.status === 'rejected') {
        setSubmitted(false)
        setSubmissionStatus('rejected')
        setRejectReason(latest.reject_reason ?? null)
      } else if (latest.status === 'approved') {
        setSubmissionStatus('approved')
      }
      setApprovedAnswerText(latest.answer_text ?? null)
      setApprovedFileUrl(latest.file_url ?? null)
    }
    fetchSubmission()
  }, [tick1Done, lessonId, userId])

useEffect(() => {
  if (!tick1Done || tick2Done) return
  try {
    const raw = localStorage.getItem(DRAFT_KEY(lessonId))
    if (!raw) return
    const draft = JSON.parse(raw)
    if (draft.text) setText(draft.text)
    if (draft.essayAnswers) setEssayAnswers(draft.essayAnswers)
  } catch {}
}, [tick1Done, lessonId, tick2Done])

  // Auto-save draft mỗi khi text hoặc essayAnswers thay đổi
  useEffect(() => {
    if (!tick1Done || tick2Done || submitted) return
    const hasSomething = text.trim() || Object.values(essayAnswers).some(v => v.trim())
    if (!hasSomething) return
    try {
      localStorage.setItem(DRAFT_KEY(lessonId), JSON.stringify({ text, essayAnswers }))
      setDraftSaved(true)
      const timer = setTimeout(() => setDraftSaved(false), 2000)
      return () => clearTimeout(timer)
    } catch {}
  }, [text, essayAnswers, tick1Done, tick2Done, submitted, lessonId])

  async function handleSubmit() {
    setLoading(true)
    let fileUrl = ''
    if (file) {
      const path = `${userId}/${lessonId}/${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase.storage.from('submissions').upload(path, file)
      if (uploadError) {
        alert(`Lỗi upload file: ${uploadError.message}. Bài vẫn nộp nhưng KHÔNG có file đính kèm — vui lòng báo admin.`)
      } else if (uploadData) {
        const { data: urlData } = supabase.storage.from('submissions').getPublicUrl(path)
        fileUrl = urlData.publicUrl
      }
    }
    const essayBlock = essays.length > 0
      ? essays.map((q, i) => `Câu hỏi tự luận ${i + 1}: ${q.question}\nTrả lời: ${essayAnswers[q.id] || '(chưa trả lời)'}`).join('\n\n')
      : ''
    const combinedText = [essayBlock, text].filter(Boolean).join('\n\n---\n\n')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/submit-practice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ lessonId, answer_text: combinedText, file_url: fileUrl })  // bỏ userId
    })
    if (res.ok) {
      // Xóa draft sau khi nộp thành công
      localStorage.removeItem(DRAFT_KEY(lessonId))
      setResubmitting(false)
      setShowCongrats(true)
      // Không cần reload thủ công: 2 nút trong modal chúc mừng đều điều hướng
      // sang trang khác (bài tiếp theo / dashboard), tự làm mới dữ liệu khi đó.
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Có lỗi khi nộp bài, vui lòng thử lại.')
    }
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

  // ── Tự chữa bài noPractice bị kẹt ──
  // Học viên làm xong quiz (tick1) từ khi bài CÒN phần thực hành, sau đó admin xoá
  // phần thực hành đi → bài thành noPractice nhưng tick2 không ai set, kẹt vĩnh viễn.
  // Gọi API đóng bài để hoàn tất; server tự xác minh lại nên không tick khống được.
  useEffect(() => {
    if (!noPractice || !tick1Done || tick2Done || !userId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session || cancelled) return
        const res = await fetch('/api/close-no-practice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ lessonId }),
        })
        if (res.ok && !cancelled) window.location.reload()
      } catch { /* im lặng — lần vào bài sau sẽ thử lại */ }
    })()
    return () => { cancelled = true }
  }, [noPractice, tick1Done, tick2Done, userId, lessonId])

  // Bài có practice_prompt thật sự mới hiện ô mô tả tự do + upload file.
  // Bài chỉ có câu tự luận (essay) thì ẩn 2 phần đó — học viên chỉ trả lời essay rồi nộp.
  const hasPrompt = ((prompt ?? '') as string).trim().length > 0

  if (noPractice && tick1Done) {
    return (
      <div className="rounded-3xl p-6" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: GOLD, color: TEXT }}>
            <i className="ti ti-check" />
          </span>
          <p className="text-sm font-semibold" style={{ color: TEXT }}>
            Bài này không có phần thực hành — hoàn thành trắc nghiệm là bạn đã xong bài!
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <button
            onClick={() => window.location.href = nextLessonId ? `/lesson/${nextLessonId}` : '/dashboard'}
            className="w-full text-sm font-semibold text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
            {nextLessonId ? (<>Sang bài tiếp theo <i className="ti ti-arrow-right" style={{ fontSize: '14px' }} /></>)
              : (<>Hoàn thành khóa học <i className="ti ti-trophy" style={{ fontSize: '14px' }} /></>)}
          </button>
        </div>
      </div>
    )
  }

  if (showCongrats) return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="relative rounded-3xl max-w-lg w-full my-8 overflow-hidden" style={{ backgroundColor: RAISED, border: `1px solid ${BORDER_STRONG}`, boxShadow: SHADOW }}>
        <canvas id="congrats-canvas" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />
        <div className="relative" style={{ zIndex: 1 }}>

          {/* Header chúc mừng */}
          <div className="p-8 text-center" style={{ borderBottom: recapContent ? `1px solid ${BORDER}` : 'none' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
              <i className="ti ti-trophy" style={{ color: GOLD, fontSize: '28px' }} />
            </div>
            <p className="text-2xl font-bold mb-2" style={{ color: TEXT }}>Chúc mừng!</p>
            <p className="text-sm font-medium" style={{ color: MUTED }}>
              Bài tập đã được nộp thành công —<br />đang chờ admin duyệt.
            </p>
          </div>

          {/* Recap content */}
          {recapContent && (() => {
            // Parse recap thành sections dựa theo số thứ tự "1." "2." "3."
            const lines = recapContent.split('\n').filter(l => l.trim())
            const sections: { type: 'header' | 'point' | 'principle' | 'text'; title?: string; body?: string; content?: string }[] = []
            let i = 0
            while (i < lines.length) {
              const line = lines[i].trim()
              // Dòng số thứ tự "1. Tiêu đề"
              const pointMatch = line.match(/^(\d+)\.\s+(.+)/)
              if (pointMatch) {
                const title = pointMatch[2]
                const bodyLines: string[] = []
                i++
                while (i < lines.length && !lines[i].trim().match(/^(\d+)\.\s+/) && !lines[i].trim().startsWith('Nguyên tắc')) {
                  bodyLines.push(lines[i].trim())
                  i++
                }
                sections.push({ type: 'point', title, body: bodyLines.join(' ') })
              } else if (line.startsWith('Nguyên tắc')) {
                const bodyLines: string[] = []
                i++
                while (i < lines.length) {
                  bodyLines.push(lines[i].trim())
                  i++
                }
                sections.push({ type: 'principle', title: line, body: bodyLines.filter(Boolean).join(' ') })
              } else if (line.match(/^Điều quan trọng/) || line.match(/^Bài học này/)) {
                sections.push({ type: 'header', content: line })
                i++
              } else {
                i++
              }
            }
            const pointSections = sections.filter(s => s.type === 'point')
            const principle = sections.find(s => s.type === 'principle')

            return (
              <div style={{ backgroundColor: SPACE, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
                {/* Header */}
                <div className="px-6 pt-5 pb-3 flex items-center gap-2">
                  <i className="ti ti-bulb" style={{ fontSize: '16px', color: GOLD }} />
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: TEXT }}>Điểm quan trọng cần nhớ</p>
                </div>

                {/* Point cards */}
                {pointSections.length > 0 && (
                  <div className="px-6 pb-4 space-y-3 max-h-72 overflow-y-auto">
                    {pointSections.map((s, idx) => (
                      <div key={idx} className="rounded-2xl p-4"
                        style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: CHIP, color: GOLD, border: `1px solid ${BORDER}` }}>
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-bold mb-1" style={{ color: TEXT }}>{s.title}</p>
                            {s.body && <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{s.body}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Principle box */}
                {principle && (
                  <div className="mx-6 mb-5 rounded-2xl p-4"
                    style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
                    <div className="flex items-center gap-2 mb-2">
                      <i className="ti ti-star" style={{ fontSize: '13px', color: GOLD }} />
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: GOLD }}>{principle.title}</p>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: TEXT }}>
                      {principle.body}
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Nút điều hướng */}
          <div className="p-6 space-y-3">
            <button
              onClick={() => {
                if (nextLessonId) {
                  window.location.href = `/lesson/${nextLessonId}`
                } else {
                  window.location.href = '/dashboard'
                }
              }}
              className="w-full text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: GOLD, color: DARK_ON_GOLD, boxShadow: `0 0 24px ${GOLD_GLOW}` }}>
              {nextLessonId ? (
                <>Sang bài tiếp theo <i className="ti ti-arrow-right" style={{ fontSize: '14px' }} /></>
              ) : (
                <>Hoàn thành khóa học <i className="ti ti-trophy" style={{ fontSize: '14px' }} /></>
              )}
            </button>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full text-sm font-medium py-3 rounded-xl flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
              <i className="ti ti-layout-dashboard" style={{ fontSize: '14px' }} />
              Về Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className={`rounded-3xl p-8 lg:p-10 transition-opacity ${isLocked ? 'opacity-50' : ''}`}
      style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={
              tick2Done ? { backgroundColor: OK_BG, color: OK } :
              isLocked ? { backgroundColor: SPACE, color: FAINT } :
              { backgroundColor: GOLD, color: DARK_ON_GOLD }
            }>
            {tick2Done ? <i className="ti ti-check" /> : isLocked ? <i className="ti ti-lock" style={{ fontSize: '12px' }} /> : '2'}
          </span>
          <div>
            <h2 className="font-semibold" style={{ color: TEXT }}>Bài tập thực hành</h2>
            <p className="text-xs font-medium mt-0.5" style={{ color: MUTED }}>Tối thiểu {MIN_ESSAY_CHARS} ký tự mỗi câu tự luận</p>
          </div>
        </div>
        {/* Draft indicator */}
        {draftSaved && (
          <span className="text-xs font-medium flex items-center gap-1 transition-opacity"
            style={{ color: OK }}>
            <i className="ti ti-check" style={{ fontSize: '11px' }} />
            Đã lưu nháp
          </span>
        )}
      </div>

      {(() => {
        const nextAttemptNumber = attemptsUsed + 1
        const attemptsExhausted = attemptsUsed >= MAX_ATTEMPTS
        const isFinalAttempt = nextAttemptNumber === MAX_ATTEMPTS

        function startResubmit() {
          setResubmitting(true)
          setText('')
          setEssayAnswers({})
          setFile(null)
        }

        if (isLocked) {
          return <p className="text-sm font-medium" style={{ color: MUTED }}>Hoàn thành bài kiểm tra để mở phần này.</p>
        }

        // ── Đã dùng hết 3 lượt — khóa vĩnh viễn, chỉ hiện trạng thái cuối cùng ──
        if (attemptsExhausted && !resubmitting) {
          const isApproved = submissionStatus === 'approved' || tick2Done
          const isRejectedFinal = submissionStatus === 'rejected' && !tick2Done
          return (
            <div className="rounded-2xl p-5 flex items-start gap-3"
              style={{
                backgroundColor: isApproved ? OK_BG : isRejectedFinal ? ERR_BG : WARN_BG,
                border: `1px solid ${isApproved ? OK_BORDER : isRejectedFinal ? ERR_BORDER : WARN_BORDER}`,
              }}>
              <i className={`ti ${isApproved ? 'ti-check' : isRejectedFinal ? 'ti-alert-circle' : 'ti-clock'}`}
                style={{ color: isApproved ? OK : isRejectedFinal ? ERR : WARN, fontSize: '20px', marginTop: '2px' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: isApproved ? OK : isRejectedFinal ? ERR : WARN }}>
                  {isApproved ? 'Đã hoàn thành bài tập' : isRejectedFinal ? 'Bài làm chưa đạt' : 'Đang chờ admin duyệt'}
                </p>
                <p className="text-xs mt-1" style={{ color: isApproved ? OK : isRejectedFinal ? ERR : WARN }}>
                  Bạn đã dùng hết 3/3 lượt nộp bài cho phần này.
                  {isRejectedFinal && ' Liên hệ admin nếu cần hỗ trợ thêm.'}
                </p>
              </div>
            </div>
          )
        }

        // ── Đã được duyệt, còn lượt → xem lại bài đã nộp, có thể nộp lại để lấy Perfect ──
        if (tick2Done && !resubmitting) {
          const isPerfect = perfectScore === true
          return (
            <div className="rounded-2xl p-4" style={{ backgroundColor: OK_BG, border: `1px solid ${OK_BORDER}` }}>
              <div className="flex items-center gap-2.5 mb-3">
                {isPerfect ? (
                  <>
                    <i className="ti ti-star-filled" style={{ color: GOLD }} />
                    <p className="text-sm font-bold" style={{ color: GOLD }}>🌟 Perfect Score! Admin đã duyệt.</p>
                  </>
                ) : (
                  <>
                    <i className="ti ti-check" style={{ color: OK }} />
                    <p className="text-sm font-semibold" style={{ color: OK }}>Admin đã duyệt — bài kế tiếp đã mở.</p>
                  </>
                )}
              </div>

              {(approvedAnswerText || approvedFileUrl) && (
                <div className="rounded-xl p-3.5 mb-3" style={{ backgroundColor: CHIP, border: `1px solid ${BORDER}` }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Bài làm bạn đã nộp:</p>
                  {approvedAnswerText && (
                    <p className="text-sm whitespace-pre-line" style={{ color: TEXT }}>{approvedAnswerText}</p>
                  )}
                  {approvedFileUrl && (
                    <a href={approvedFileUrl} target="_blank" rel="noreferrer"
                      className="text-xs font-medium underline mt-2 inline-block" style={{ color: NAVY }}>
                      📎 Xem file đính kèm
                    </a>
                  )}
                </div>
              )}

              {!isPerfect && (
                <button onClick={startResubmit}
                  className="text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
                  style={{ backgroundColor: CHIP, color: GOLD, border: `1px solid ${BORDER}` }}>
                  <i className="ti ti-refresh" style={{ fontSize: '12px', marginRight: '4px' }} />
                  Nộp lại để thử lấy Perfect (lần {nextAttemptNumber}/3)
                </button>
              )}
            </div>
          )
        }

        // ── Đang chờ duyệt, còn lượt → vẫn có thể nộp lại để cải thiện trước khi admin xem ──
        if (submitted && !resubmitting) {
          return (
            <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: OK_BG, border: `1px solid ${OK_BORDER}` }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: OK }}>
                <i className="ti ti-trophy" style={{ color: DARK_ON_GOLD, fontSize: '24px' }} />
              </div>
              <p className="text-lg font-bold mb-1" style={{ color: OK }}>Chúc mừng!</p>
              <p className="text-sm font-medium mb-4" style={{ color: OK }}>
                Bài tập đã được nộp thành công — đang chờ admin duyệt.
              </p>

              {(approvedAnswerText || approvedFileUrl) && (
                <div className="rounded-xl p-3.5 mb-4 text-left" style={{ backgroundColor: CHIP, border: `1px solid ${OK_BORDER}` }}>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: MUTED }}>Bài làm bạn đã nộp:</p>
                  {approvedAnswerText && (
                    <p className="text-sm whitespace-pre-line" style={{ color: TEXT }}>{approvedAnswerText}</p>
                  )}
                  {approvedFileUrl && (
                    <a href={approvedFileUrl} target="_blank" rel="noreferrer"
                      className="text-xs font-medium underline mt-2 inline-block" style={{ color: NAVY }}>
                      📎 Xem file đính kèm
                    </a>
                  )}
                </div>
              )}

              <button onClick={startResubmit}
                className="text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.5)', color: OK, border: `1px solid ${OK_BORDER}` }}>
                <i className="ti ti-refresh" style={{ fontSize: '12px', marginRight: '4px' }} />
                Chưa ưng ý? Nộp lại bản khác (lần {nextAttemptNumber}/3)
              </button>
            </div>
          )
        }

        // ── Form nộp bài: lần đầu, đang nộp lại, hoặc vừa bị từ chối ──
        return (
        <>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{
                backgroundColor: isFinalAttempt ? ERR_BG : CHIP,
                color: isFinalAttempt ? ERR : MUTED,
                border: `1px solid ${isFinalAttempt ? ERR_BORDER : BORDER}`,
              }}>
              Lần nộp {nextAttemptNumber}/3
            </span>
            {resubmitting && (
              <button onClick={() => setResubmitting(false)}
                className="text-xs font-medium" style={{ color: MUTED }}>
                Huỷ, quay lại
              </button>
            )}
          </div>

          {isFinalAttempt && (
            <div className="rounded-2xl p-4 mb-6 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.14) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${GOLD}` }}>
              <img src="/mascot/panda-heart.png" alt="" className="w-12 h-12 flex-shrink-0 object-contain" />
              <div>
                <p className="text-sm font-bold" style={{ color: GOLD }}>{finalMessage.title}</p>
                <p className="text-xs mt-0.5" style={{ color: TEXT }}>{finalMessage.body}</p>
              </div>
            </div>
          )}

          {submissionStatus === 'rejected' && !resubmitting && (
            <>
              {(approvedAnswerText || approvedFileUrl) && (
                <div className="rounded-2xl p-4 mb-3" style={{ backgroundColor: CHIP, border: `1px solid ${BORDER}` }}>
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: MUTED }}>
                    <i className="ti ti-history" style={{ fontSize: '13px' }} />
                    Bài cũ bạn đã nộp (chưa đạt):
                  </p>
                  {approvedAnswerText && (
                    <p className="text-sm whitespace-pre-line" style={{ color: TEXT }}>{approvedAnswerText}</p>
                  )}
                  {approvedFileUrl && (
                    <a href={approvedFileUrl} target="_blank" rel="noreferrer"
                      className="text-xs font-medium underline mt-2 inline-block" style={{ color: NAVY }}>
                      📎 Xem file đính kèm
                    </a>
                  )}
                </div>
              )}
              <div className="rounded-2xl p-4 mb-6 flex items-start gap-3"
                style={{ backgroundColor: ERR_BG, border: `1px solid ${ERR_BORDER}` }}>
                <i className="ti ti-alert-circle" style={{ color: ERR, fontSize: '20px', marginTop: '2px' }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: ERR }}>Bài làm trước đã bị từ chối</p>
                  {rejectReason && (
                    <p className="text-xs mt-1 whitespace-pre-line" style={{ color: ERR }}>Lý do: {rejectReason}</p>
                  )}
                  <p className="text-xs mt-1" style={{ color: ERR }}>Hãy chỉnh sửa và nộp lại bên dưới.</p>
                </div>
              </div>
            </>
          )}
          {essays.length > 0 && (
            <div className="space-y-6 mb-6">
              {essays.map((q: any, qi: number) => (
                <div key={q.id} className="p-5 py-4 rounded-2xl" style={{ backgroundColor: SPACE, border: `1px solid ${BORDER}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: MUTED }}>Câu hỏi tự luận {qi + 1}</p>
                  <p className="text-base font-semibold leading-6 mb-4 whitespace-pre-line" style={{ color: TEXT }}>{q.question}</p>
                  <textarea rows={6}
                    className="w-full text-sm rounded-xl px-4 py-3 focus:outline-none transition-colors resize-y"
                    style={{ border: `1px solid ${BORDER}`, backgroundColor: PANEL, color: TEXT }}
                    placeholder="Nhập câu trả lời..."
                    value={essayAnswers[q.id] || ''}
                    onChange={e => setEssayAnswers({ ...essayAnswers, [q.id]: e.target.value })} />
                  <div className="flex justify-end mt-1">
                    <span className="text-xs font-medium"
                      style={{ color: (essayAnswers[q.id] || '').length >= MIN_ESSAY_CHARS ? OK : MUTED }}>
                      {(essayAnswers[q.id] || '').length}/{MIN_ESSAY_CHARS} ký tự
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasPrompt && (
  <div
    className="rounded-2xl p-5 mb-6"
    style={{
      backgroundColor: SPACE,
      border: `1px solid ${BORDER}`,
    }}
  >
    <div className="flex items-center gap-2 mb-2">
      <i
        className="ti ti-bulb"
        style={{ color: GOLD, fontSize: '16px' }}
      />
      <p
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: TEXT }}
      >
        Yêu cầu thực hành
      </p>
    </div>

    <p
      className="text-sm leading-7 whitespace-pre-line"
      style={{ color: MUTED }}
    >
      {prompt}
    </p>
  </div>
)}
          {hasPrompt && (
          <>
          <textarea rows={12}
            className="w-full text-sm rounded-xl px-3.5 py-2.5 mb-3 focus:outline-none transition-colors resize-none"
            style={{ border: `1px solid ${BORDER}`, backgroundColor: PANEL, color: TEXT }}
            placeholder="Mô tả bài làm của bạn..."
            value={text} onChange={e => setText(e.target.value)} />

          <label
  className="block rounded-2xl p-6 mb-2 cursor-pointer transition-colors"
  style={{
    border: `2px dashed ${BORDER}`,
    backgroundColor: SPACE,
  }}
>
            <div className="flex flex-col items-center justify-center text-center gap-2">

  <i
    className="ti ti-cloud-upload"
    style={{
      fontSize: '34px',
      color: TEXT
    }}
  />

  <p
    className="font-semibold"
    style={{ color: TEXT }}
  >
    {file ? (
<>
<i className="ti ti-circle-check" />
{file.name}
</>
) : (
<>
<i className="ti ti-cloud-upload" />
Chọn ảnh hoặc PDF
</>
)}
  </p>

  <p
    className="text-xs"
    style={{ color: MUTED }}
  >
    JPG • PNG • PDF (tối đa 10MB)
  </p>

  {!file && (
    <p
      className="text-xs"
      style={{ color: FAINT }}
    >
      Nhấn để chọn tệp từ máy tính
    </p>
  )}

</div>

<input
  type="file"
  accept=".jpg,.jpeg,.png,.pdf"
  className="hidden"
  onChange={e => setFile(e.target.files?.[0] ?? null)}
/>
</label>
          </>
          )}

          <button onClick={handleSubmit}
            disabled={loading || (hasPrompt && !text) || essays.some((q: any) => (essayAnswers[q.id] || '').length < MIN_ESSAY_CHARS)}
            className="w-full text-sm font-semibold text-white px-5 py-3 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang nộp...
              </span>
            ) : 'Nộp bài tập'}
          </button>
        </>
        )
      })()}
    </div>
  )
}