'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile, Progress } from '@/types'
import FireworksCanvas from '@/components/FireworksCanvas'
import FeedbackModal, { FeedbackQuestion } from '@/components/FeedbackModal'
import Mascot from '@/components/Mascot'
import { SPACE, PANEL, CHIP, RAISED, TEXT, MUTED, FAINT, GOLD, GOLD_GLOW, GOLD_SOFT, NAVY, BLUE, BORDER, BORDER_STRONG, CREAM, OK, OK_BG, OK_BORDER, WARN, WARN_BG, WARN_BORDER, ERR, ERR_BG, ERR_BORDER, SHADOW } from '@/lib/theme'

type ModuleItem = {
  id: number
  name: string
  description: string | null
  order_index: number
  category: string
  unlock_mode: string
}

type LessonListItem = {
  id: number
  title: string
  order_index: number
  module_id: number
}

const SUPABASE_URL = 'https://rptmjqmdlcfnldyffgmc.supabase.co'
const badgeImg = (name: string) => `${SUPABASE_URL}/storage/v1/object/public/badge-icons/${name}.png`

const badgeDefs = [
  { type: 'k-starter', label: 'K-Starter', imageUrl: badgeImg('k-starter'), bg: 'rgba(255,201,77,0.12)', color: '#FFC94D',
    desc: 'Bước chân đầu tiên trên hành trình K-Global — bạn đã chính thức khởi động!' },
  { type: 'k-member', label: 'K-Member', imageUrl: badgeImg('k-member'), bg: 'rgba(74,222,128,0.12)', color: '#4ADE80',
    desc: 'Tư duy làm việc chuyên nghiệp đã thấm vào bạn — một K-Member thực thụ!' },
  { type: 'k-member-super', label: 'K-Member Super', imageUrl: badgeImg('k-member-super'), bg: 'rgba(52,211,153,0.14)', color: '#34D399',
    desc: 'Perfect Score toàn bộ phần Tư duy — đẳng cấp vượt trội, không một sai sót!' },
  { type: 'k-sales', label: 'K-Sales', imageUrl: badgeImg('k-sales'), bg: 'rgba(96,165,250,0.12)', color: '#60A5FA',
    desc: 'Bạn đã nắm trong tay tư duy bán hàng đỉnh cao — sẵn sàng chinh phục mọi khách hàng!' },
  { type: 'k-super-sales', label: 'K-Super Sales', imageUrl: badgeImg('k-super-sales'), bg: 'rgba(129,180,255,0.14)', color: '#81B4FF',
    desc: 'Perfect Score Sales B2B — bạn thuộc top xuất sắc nhất về nghệ thuật bán hàng!' },
  { type: 'k-smock-expert', label: 'K-Smock Expert', imageUrl: badgeImg('k-smock-expert'), bg: 'rgba(244,114,182,0.12)', color: '#F472B6',
    desc: 'Từ sợi chỉ đến sản phẩm hoàn thiện — bạn giờ là chuyên gia thực thụ về Smock!',
    branches: ['k-embroidery', 'lotus-smock'] },
  { type: 'k-hair-expert', label: 'K-Hair Expert', imageUrl: badgeImg('k-hair-expert'), bg: 'rgba(167,139,250,0.14)', color: '#A78BFA',
    desc: 'Am hiểu tường tận ngành tóc — từ chất tóc đến thị trường, bạn là chuyên gia Hair!',
    branches: ['hair'] },
  { type: 'chien-binh', label: 'Chiến Binh', imageUrl: badgeImg('chien-binh'), bg: 'rgba(251,191,36,0.12)', color: '#FBBF24',
    desc: 'Bản lĩnh và ý chí Chiến Binh — bạn đã chinh phục thử thách khó nhằn nhất!' },
  { type: 'perfect-member', label: 'Perfect Member', imageUrl: badgeImg('perfect-member'), bg: 'rgba(129,140,248,0.14)', color: '#818CF8',
    desc: '🏆 Toàn bộ Perfect Score — bạn là thành viên xuất sắc nhất K-Global, không ai sánh bằng!' },
]

const DARK_ON_GOLD = '#0A0E1A'   // chữ tối đặt trên nền gold neon

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [lessons, setLessons] = useState<LessonListItem[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [progressMap, setProgressMap] = useState<Record<number, Progress>>({})
  const [badges, setBadges] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [openModules, setOpenModules] = useState<Set<number>>(new Set())
  const [activeTrack, setActiveTrack] = useState<'main' | 'ai'>('main')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [badgePopup, setBadgePopup] = useState<typeof badgeDefs[0] | null>(null)
const [submissionStatusMap, setSubmissionStatusMap] = useState<Record<number, { status: string; reason: string | null; attempt: number }>>({})
const [attemptCountMap, setAttemptCountMap] = useState<Record<number, number>>({})
const [rejectPopup, setRejectPopup] = useState<{
  lessonId: number; title: string; reason: string | null
} | null>(null)
const [feedbackSeenModules, setFeedbackSeenModules] = useState<number[]>([])
const [fireworksModuleId, setFireworksModuleId] = useState<number | null>(null)
const [pendingFeedback, setPendingFeedback] = useState<{ moduleId: number; moduleName: string } | null>(null)
const [feedbackQuestions, setFeedbackQuestions] = useState<FeedbackQuestion[]>([])
const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
const [pinging, setPinging] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*, branch:branches(*)')
        .eq('id', session.user.id)
        .single()
      setProfile(prof)

      if (!prof?.branch_id) { setLoading(false); return }

      // Module AI dùng chung cho mọi nhánh (category = 'ai'), không lọc theo branch_id
      const { data: aiModulesData } = await supabase
        .from('modules').select('id').eq('category', 'ai')
      const aiModuleIds = (aiModulesData ?? []).map((m: any) => m.id)
      const aiLessonFilter = aiModuleIds.length > 0 ? `,module_id.in.(${aiModuleIds.join(',')})` : ''

      const [lessonsRes, modulesRes, badgesRes, feedbackSeenRes] = await Promise.all([
        supabase.from('lessons')
          .select('id, title, order_index, module_id, practice_prompt, questions')
          .or(`branch_id.eq.${prof.branch_id}${aiLessonFilter}`)
          .eq('is_published', true)
          .order('order_index'),
        supabase.from('modules')
          .select('id, name, description, order_index, category, unlock_mode')
          .or(`branch_id.eq.${prof.branch_id},category.eq.ai`)
          .order('order_index'),
        supabase.from('badges')
          .select('badge_type')
          .eq('user_id', session.user.id),
        supabase.from('module_feedback_seen')
          .select('module_id')
          .eq('user_id', session.user.id),
      ])

      const lessonList = lessonsRes.data ?? []
      setLessons(lessonList as LessonListItem[])
      setModules((modulesRes.data ?? []) as ModuleItem[])
      setBadges(badgesRes.data?.map((b: any) => b.badge_type) ?? [])
      setFeedbackSeenModules((feedbackSeenRes.data ?? []).map((r: any) => r.module_id))

      const ids = lessonList.map((l: { id: number }) => l.id)
      if (ids.length > 0) {
        const { data: progList } = await supabase
          .from('progress')
          .select('lesson_id, tick1, tick2, completed_at, perfect_score')
          .eq('user_id', session.user.id)
          .in('lesson_id', ids)

        const map: Record<number, Progress> = {}
        progList?.forEach((p: any) => { map[p.lesson_id] = p })
        setProgressMap(map)

        

        const { data: submissions } = await supabase
  .from('submissions')
  .select('lesson_id, status, submitted_at, reject_reason, attempt_number')
  .eq('user_id', session.user.id)
  .order('submitted_at', { ascending: false })
const latestStatusMap: Record<number, { status: string; reason: string | null; attempt: number }> = {}
const attemptCountMap: Record<number, number> = {}
;(submissions || []).forEach((s: any) => {
  attemptCountMap[s.lesson_id] = Math.max(attemptCountMap[s.lesson_id] ?? 0, s.attempt_number ?? 1)
  if (!(s.lesson_id in latestStatusMap)) {
    latestStatusMap[s.lesson_id] = { status: s.status, reason: s.reject_reason ?? null, attempt: s.attempt_number ?? 1 }
  }
})
setSubmissionStatusMap(latestStatusMap)
setAttemptCountMap(attemptCountMap)
      }

      setLoading(false)
    }
    load()
  }, [router])

  // ── Tách 2 lộ trình: Nghề (bài của nhánh) và Kiến thức chung (module AI) ──
  const aiModuleIdSet = new Set(modules.filter(m => m.category === 'ai').map(m => m.id))
  const aiLessonList = lessons.filter(l => aiModuleIdSet.has(l.module_id))
  const mainLessonList = lessons.filter(l => !aiModuleIdSet.has(l.module_id))

  function statsOf(list: LessonListItem[]) {
    const t1 = list.filter(l => progressMap[l.id]?.tick1).length
    const t2 = list.filter(l => progressMap[l.id]?.tick2).length
    const dn = list.filter(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2).length
    return {
      total: list.length,
      done: dn,
      pending: list.filter(l => progressMap[l.id]?.tick1 && !progressMap[l.id]?.tick2).length,
      pct: list.length ? Math.round(((t1 / list.length) + (t2 / list.length)) / 2 * 100) : 0,
    }
  }

  const mainStats = statsOf(mainLessonList)
  const aiStats = statsOf(aiLessonList)

  // Tổng chung — dùng cho ô thống kê đếm số bài
  const done = lessons.filter(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2).length
  const pending = lessons.filter(l => progressMap[l.id]?.tick1 && !progressMap[l.id]?.tick2).length
  const perfectCount = lessons.filter(l => progressMap[l.id]?.perfect_score).length
  const pct = mainStats.pct
    const TARGET_LESSONS_PER_DAY = 0.5
  const dayNumber = profile?.onboarding_date
    ? Math.max(1, Math.floor((Date.now() - new Date(profile.onboarding_date).getTime()) / 86400000) + 1)
    : null
  const expectedDone = dayNumber ? dayNumber * TARGET_LESSONS_PER_DAY : null
  const paceLabel = expectedDone == null ? ''
    : done >= expectedDone * 1.15 ? 'nhanh hơn'
    : done <= expectedDone * 0.85 ? 'chậm hơn'
    : 'đúng nhịp so với'
  const mascotWelcome = 'Chào mừng bạn tham gia khoá học tại K-Global, chúc bạn nhanh chóng lên trình nhé! 🚀'

  const lessonsByModule = modules.map(mod => ({
    module: mod,
    lessons: lessons.filter(l => l.module_id === mod.id).sort((a, b) => a.order_index - b.order_index)
  })).filter(g => g.lessons.length > 0)

  // Tách track: AI đứng riêng, auto mở, không tham gia chuỗi khoá tuần tự của track chính
  const mainLessonsByModule = lessonsByModule.filter(g => g.module.category !== 'ai')
  const aiLessonsByModule = lessonsByModule.filter(g => g.module.category === 'ai')
  const visibleGroups = activeTrack === 'ai' ? aiLessonsByModule : mainLessonsByModule

  // Nhánh chưa có nội dung nghề (vd TWC, Hành chính) → mở thẳng khoá AI
  useEffect(() => {
    if (loading) return
    if (mainLessonsByModule.length === 0 && aiLessonsByModule.length > 0) setActiveTrack('ai')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, mainLessonsByModule.length, aiLessonsByModule.length])

  // Bài cần nộp bài = có practice_prompt hoặc có câu tự luận
  const lessonsNeedingSubmission = new Set(
    lessons
      .filter((l: any) => {
        const hasPrompt = ((l.practice_prompt ?? '') as string).trim().length > 0
        const hasEssay = ((l.questions ?? []) as any[])
          .some((q: any) => q?.type === 'essay' && (q.question ?? '').trim())
        return hasPrompt || hasEssay
      })
      .map(l => l.id)
  )

  const orderedLessons = mainLessonsByModule.flatMap(g => g.lessons)
  const aiOrderedLessons = aiLessonsByModule.flatMap(g => g.lessons)
  const nextLessonTitle = orderedLessons.find(l => !(progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2))?.title
  const mascotDaily = dayNumber
    ? `Hôm nay là ngày thứ ${dayNumber} của bạn tại K-Global! ${nextLessonTitle ? `Bạn đang ở bài "${nextLessonTitle}"` : 'Bạn đã hoàn thành hết bài rồi'} — tiến độ ${paceLabel} nhịp trung bình đó, tiếp tục cố gắng nhé! 💪`
    : undefined

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile?.id) return
    if (file.size > 3 * 1024 * 1024) {
      alert('Ảnh tối đa 3MB, chọn ảnh nhỏ hơn nhé.')
      return
    }
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/avatar_${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) {
      alert(`Lỗi upload: ${uploadError.message}`)
      setUploadingAvatar(false)
      return
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profile.id)
    setProfile((prev: any) => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev)
    setUploadingAvatar(false)
  }

  // "Ping" người chấm — thay vì nhảy thẳng vào app mail máy (dễ bị "chết" nếu học viên
  // "Ping" người chấm — gửi thẳng email qua Resend (server-side), không cần
  // học viên mở app mail hay thao tác gì thêm.
  async function handlePing() {
    if (pinging) return
    setPinging(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setPinging(false); return }
      const res = await fetch('/api/send-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ done, total: lessons.length }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Gửi mail thất bại, thử lại sau.')
        return
      }
      alert('Đã gửi thông báo tới người chấm!')
    } finally {
      setPinging(false)
    }
  }

  function isLessonUnlocked(lessonId: number) {
  const lessonMeta = lessons.find(l => l.id === lessonId)
  const mod = modules.find(m => m.id === lessonMeta?.module_id)
  const isAi = mod?.category === 'ai'

  // Module "mở tự do" (VD khóa dành riêng cho Ads): mở TOÀN BỘ bài ngay từ đầu,
  // không phụ thuộc module nào khác, không cần làm tuần tự.
  if (mod?.unlock_mode === 'free') return true

  // Module "mở full" (VD Khóa học Hair/Smock): chỉ cần Module 1 xong hết là mở TOÀN BỘ bài
  // trong module này cùng lúc, không cần làm tuần tự từng bài như bình thường.
  if (mod?.unlock_mode === 'full') {
    const chainGroups = isAi ? aiLessonsByModule : mainLessonsByModule
    const firstModule = chainGroups[0]
    if (!firstModule) return false
    // Nếu chính module này là module đầu tiên của track -> luôn mở sẵn từ đầu
    if (firstModule.module.id === mod.id) return true
    return firstModule.lessons.every(l => isLessonPassed(l.id))
  }

  // AI có chuỗi khoá tuần tự RIÊNG, độc lập với track chính (không auto mở nữa)
  const chain = isAi ? aiOrderedLessons : orderedLessons
  const chainGroups = isAi ? aiLessonsByModule : mainLessonsByModule

  const lesson = chain.find(l => l.id === lessonId)
  if (!lesson) return false

  const idx = chain.findIndex(l => l.id === lessonId)
  if (idx <= 0) return true

  const prevLesson = chain[idx - 1]

  // Nếu bài này là bài đầu tiên của module khác module 1 (trong cùng track)
  if (lesson.module_id !== prevLesson.module_id) {
    // Module "open": mở song song ngay từ đầu, không cần chờ Module 1 xong
    if (mod?.unlock_mode === 'open') return true
    // Kiểm tra module 1 của track này đã hoàn thành hết tick1 chưa
    const firstModule = chainGroups[0]
    if (!firstModule) return false
    const module1AllDone = firstModule.lessons.every(l => isLessonPassed(l.id))
    return module1AllDone
  }

  // Trong cùng module → tuần tự
  return isLessonPassed(prevLesson.id)
}

  // Bài trước coi là "đã làm xong" khi:
  //  - đã được duyệt (tick2), HOẶC
  //  - đã nộp bài thực hành (đang chờ duyệt), HOẶC
  //  - đã qua quiz và bài đó không có phần thực hành nào để nộp
  // Mục đích: bài chỉ có tự luận thì tick1 được set tự động khi mở bài,
  // không thể coi đó là đã hoàn thành để mở bài kế tiếp.
  function isLessonPassed(lessonId: number) {
    const prog = progressMap[lessonId]
    if (!prog?.tick1) return false
    if (prog.tick2) return true
    const sub = submissionStatusMap[lessonId]
    if (sub && (sub.status === 'pending' || sub.status === 'approved')) return true
    // Không có bài nộp nào → chỉ chấp nhận nếu bài này vốn không cần nộp
    return !lessonNeedsSubmission(lessonId)
  }

  // Bài có yêu cầu nộp bài (practice_prompt hoặc câu tự luận) hay không
  function lessonNeedsSubmission(lessonId: number) {
    return lessonsNeedingSubmission.has(lessonId)
  }

  const currentModuleGroup = mainLessonsByModule.find(g =>
    !g.lessons.every(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2)
  ) ?? mainLessonsByModule[mainLessonsByModule.length - 1]

  const currentModuleDone = currentModuleGroup
    ? currentModuleGroup.lessons.filter(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2).length
    : 0

  useEffect(() => {
    if (!loading && currentModuleGroup && openModules.size === 0) {
      setOpenModules(new Set([currentModuleGroup.module.id]))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    if (loading || badges.length === 0) return
    const seenKey = 'seen_badges'
    const seen: string[] = JSON.parse(localStorage.getItem(seenKey) || '[]')
    const newBadge = badgeDefs.slice().reverse().find(b => badges.includes(b.type) && !seen.includes(b.type))
    if (newBadge) {
      setBadgePopup(newBadge)
      localStorage.setItem(seenKey, JSON.stringify([...seen, newBadge.type]))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, badges])

  useEffect(() => {
    if (loading || lessonsByModule.length === 0) return
    const completedModule = lessonsByModule.find(g =>
      g.lessons.every(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2) &&
      !feedbackSeenModules.includes(g.module.id)
    )
    if (completedModule && !fireworksModuleId && !pendingFeedback) {
      setFireworksModuleId(completedModule.module.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, progressMap, feedbackSeenModules])

  async function handleFireworksDone() {
    const moduleId = fireworksModuleId
    setFireworksModuleId(null)
    if (!moduleId) return
    const mod = lessonsByModule.find(g => g.module.id === moduleId)?.module
    const res = await fetch(`/api/feedback/questions?module_id=${moduleId}`)
    const data = await res.json()
    const questions: FeedbackQuestion[] = data.questions ?? []

    if (questions.length === 0) {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetch('/api/feedback/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ moduleId, responses: [], skipped: true })
        })
      }
      setFeedbackSeenModules(prev => [...prev, moduleId])
      return
    }
    setFeedbackQuestions(questions)
    setPendingFeedback({ moduleId, moduleName: mod?.name ?? '' })
  }

  async function submitFeedback(responses: { question_id: string; rating_value?: number; text_value?: string }[]) {
    if (!pendingFeedback) return
    setFeedbackSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ moduleId: pendingFeedback.moduleId, responses, skipped: false })
      })
    }
    setFeedbackSeenModules(prev => [...prev, pendingFeedback.moduleId])
    setFeedbackSubmitting(false)
    setPendingFeedback(null)
  }

  async function skipFeedback() {
    if (!pendingFeedback) return
    setFeedbackSubmitting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ moduleId: pendingFeedback.moduleId, responses: [], skipped: true })
      })
    }
    setFeedbackSeenModules(prev => [...prev, pendingFeedback.moduleId])
    setFeedbackSubmitting(false)
    setPendingFeedback(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: SPACE, color: TEXT }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BORDER, borderTopColor: GOLD }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: SPACE, color: TEXT }}>

      {/* Top bar — navy */}
      <div className="px-5 py-3.5 sticky top-0 z-10" style={{ backgroundColor: 'rgba(7,11,21,0.88)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
              title="Về trang chủ"
            >
              <i className="ti ti-home" style={{ fontSize: '16px' }} />
            </button>
            <div className="w-px h-5 flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
            <label className="relative w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 cursor-pointer group overflow-hidden"
              style={{ backgroundColor: GOLD, color: DARK_ON_GOLD }}
              title="Bấm để đổi ảnh đại diện">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                {uploadingAvatar ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <i className="ti ti-camera" style={{ fontSize: '14px', color: 'white' }} />
                )}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" style={{ color: TEXT }}>{profile?.name}</p>
              <p className="text-xs" style={{ color: MUTED }}>{profile?.branch?.name}</p>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => router.push('/login'))}
            className="text-xs flex-shrink-0 ml-3 flex items-center gap-1.5 transition-opacity hover:opacity-70"
            style={{ color: MUTED }}
          >
            <i className="ti ti-logout" style={{ fontSize: '14px' }} />
            Đăng xuất
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-6 lg:grid lg:grid-cols-[340px_1fr] lg:gap-8 lg:items-start">

        {/* ===== SIDEBAR ===== */}
        <div className="space-y-4 mb-6 lg:mb-0 lg:sticky lg:top-20">

          {/* Hero tiến độ — navy */}
          <div className="rounded-3xl p-6" style={{ background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.20) 100%)', border: `1px solid ${BORDER_STRONG}` }}>
            {mainStats.total > 0 ? (
              <>
                <p className="text-xs mb-1 tracking-widest uppercase font-semibold" style={{ color: GOLD }}>Lộ trình nghề</p>
                <p className="text-5xl font-bold mb-4" style={{ color: GOLD }}>{mainStats.pct}%</p>
                <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${mainStats.pct}%`, backgroundColor: GOLD }} />
                </div>
                <p className="text-xs font-medium" style={{ color: MUTED }}>
                  {mainStats.done}/{mainStats.total} bài hoàn thành
                </p>
              </>
            ) : (
              <div className="pb-1">
                <p className="text-xs mb-1 tracking-widest uppercase font-semibold" style={{ color: GOLD }}>Lộ trình nghề</p>
                <p className="text-sm font-medium" style={{ color: MUTED }}>
                  Nội dung nhánh của bạn đang được biên soạn — hãy bắt đầu với khoá Kiến thức chung bên dưới.
                </p>
              </div>
            )}

            {/* Kiến thức chung (AI) — lộ trình riêng, không cộng vào % nghề */}
            {aiStats.total > 0 && (
              <div className={mainStats.total > 0 ? 'mt-5 pt-4' : 'mt-4 pt-4'} style={{ borderTop: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs tracking-widest uppercase font-semibold flex items-center gap-1.5" style={{ color: BLUE }}>
                    <i className="ti ti-sparkles" style={{ fontSize: '13px' }} />
                    Kiến thức chung
                  </p>
                  <p className="text-lg font-bold leading-none" style={{ color: BLUE }}>{aiStats.pct}%</p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${aiStats.pct}%`, backgroundColor: BLUE }} />
                </div>
                <p className="text-xs font-medium" style={{ color: MUTED }}>
                  {aiStats.done}/{aiStats.total} bài hoàn thành
                </p>
              </div>
            )}
          </div>

          {/* Module hiện tại — white card */}
          {currentModuleGroup && (
            <div className="rounded-3xl p-5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
              <p className="text-xs mb-1 tracking-widest uppercase font-semibold" style={{ color: GOLD }}>Đang học</p>
              <p className="text-base font-semibold mb-3" style={{ color: TEXT }}>
                {currentModuleGroup.module.name}
              </p>
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: CHIP }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${currentModuleGroup.lessons.length > 0
                      ? Math.round((currentModuleDone / currentModuleGroup.lessons.length) * 100) : 0}%`,
                    backgroundColor: BLUE
                  }} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: `${currentModuleGroup.lessons.filter(l => progressMap[l.id]?.tick1).length}/${currentModuleGroup.lessons.length}`, label: 'Đã nộp' },
                  { value: `${currentModuleGroup.lessons.filter(l => progressMap[l.id]?.tick2).length}/${currentModuleGroup.lessons.length}`, label: 'Đạt LT' },
                  { value: `${currentModuleGroup.lessons.length > 0 ? Math.round((currentModuleDone / currentModuleGroup.lessons.length) * 100) : 0}%`, label: 'Xong' },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-2.5 text-center" style={{ backgroundColor: CHIP }}>
                    <p className="text-sm font-bold" style={{ color: TEXT }}>{s.value}</p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: MUTED }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats 2x2 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: done, label: 'Đạt lý thuyết', color: OK },
              { value: pending, label: 'Chờ duyệt', color: GOLD },
              { value: lessons.length - done - pending, label: 'Chưa học', color: MUTED },
              { value: perfectCount, label: '⭐ Perfect', color: WARN },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-3 text-center" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: MUTED }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Ping người chấm — chỉ hiện khi có bài đang chờ duyệt */}
          {pending > 0 && (
            <div className="rounded-3xl p-4 flex items-center justify-between gap-3"
              style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: TEXT }}>
                  Bạn có {pending} bài đang chờ chấm
                </p>
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                  Ping để nhắc người chấm xem bài giúp bạn nhé.
                </p>
              </div>
              <button
                onClick={handlePing}
                disabled={pinging}
                className="flex-shrink-0 flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: GOLD, color: DARK_ON_GOLD }}>
                <i className="ti ti-bell-ringing" style={{ fontSize: '15px' }} />
                {pinging ? 'Đang gửi...' : 'Ping người chấm'}
              </button>
            </div>
          )}

          {/* Badges */}
          <div className="rounded-3xl p-5" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
            <p className="text-base font-semibold mb-4" style={{ color: TEXT }}>Achievement</p>
            <div className="space-y-2.5">
              {badgeDefs
                .filter(b => !(b as any).branches || (b as any).branches.includes(profile?.branch?.slug))
                .map(b => {
                const earned = badges.includes(b.type)
                return (
                  <div key={b.type}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${earned ? 'opacity-100' : 'opacity-35'}`}
                    style={{ backgroundColor: earned ? b.bg : 'rgba(255,255,255,0.03)', border: `1px solid ${earned ? BORDER : 'transparent'}` }}>
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
  style={{
    backgroundColor: earned ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
    border: `2px solid ${earned ? b.color : 'rgba(155,196,232,0.2)'}`,
    boxShadow: earned ? `0 0 14px ${b.bg}` : 'none',
  }}>
  <img src={b.imageUrl} alt={b.label}
    className="w-full h-full object-cover scale-110"
    style={{ opacity: earned ? 1 : 0.35, filter: earned ? 'none' : 'grayscale(100%)' }} />
</div>
<div className="min-w-0">
  <p className="text-sm font-semibold" style={{ color: earned ? b.color : '#8FA9C6' }}>
    {b.label}
  </p>
  <p className="text-xs font-medium" style={{ color: earned ? b.color : '#5F7796', opacity: earned ? 0.85 : 1 }}>
    {earned ? '✓ Đã đạt được' : b.desc}
  </p>
</div>
                    {earned && (
                      <div className="ml-auto flex-shrink-0">
                        <i className="ti ti-check" style={{ color: b.color, fontSize: '16px' }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ===== CỘT PHẢI: Accordion ===== */}
        <div>
          {aiLessonsByModule.length > 0 && mainLessonsByModule.length > 0 && (
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTrack('main')}
                className="flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                style={activeTrack === 'main'
                  ? { backgroundColor: GOLD, color: DARK_ON_GOLD }
                  : { backgroundColor: PANEL, color: MUTED, border: `1px solid ${BORDER}` }}>
                Nhánh nghề
              </button>
              <button
                onClick={() => setActiveTrack('ai')}
                className="flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors"
                style={activeTrack === 'ai'
                  ? { backgroundColor: GOLD, color: DARK_ON_GOLD }
                  : { backgroundColor: PANEL, color: MUTED, border: `1px solid ${BORDER}` }}>
                AI Education
              </button>
            </div>
          )}

          {visibleGroups.length === 0 && (
            <div className="rounded-3xl p-10 text-center" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
              <p className="text-sm" style={{ color: MUTED }}>Chưa có bài học nào được xuất bản.</p>
            </div>
          )}

          <div className="space-y-3">
            {visibleGroups.map(({ module, lessons: moduleLessons }) => {
              const moduleDone = moduleLessons.every(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2)
              const moduleUnlocked = isLessonUnlocked(moduleLessons[0].id)
              const isOpen = openModules.has(module.id)
              const moduleTick1 = moduleLessons.filter(l => progressMap[l.id]?.tick1).length
              const moduleTick2 = moduleLessons.filter(l => progressMap[l.id]?.tick2).length
              const moduleTotal = moduleLessons.length
              const modulePct = moduleTotal > 0
                ? Math.round(((moduleTick1 / moduleTotal) + (moduleTick2 / moduleTotal)) / 2 * 100) : 0

              return (
                <div key={module.id} className="rounded-2xl overflow-hidden"
                  style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
                  <button
                    onClick={() => {
                      const next = new Set(openModules)
                      isOpen ? next.delete(module.id) : next.add(module.id)
                      setOpenModules(next)
                    }}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left transition-colors"
                    style={{ background: isOpen ? 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.18) 100%)' : PANEL }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={moduleDone
                        ? { backgroundColor: OK_BG, color: OK, border: `1px solid ${OK_BORDER}` }
                        : !moduleUnlocked
                        ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.3)' }
                        : isOpen
                        ? { backgroundColor: GOLD, color: DARK_ON_GOLD }
                        : { backgroundColor: CHIP, color: MUTED }}>
                      {moduleDone ? <i className="ti ti-check" />
                        : !moduleUnlocked ? <i className="ti ti-lock" style={{ fontSize: '12px' }} />
                        : module.order_index}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate"
                          style={{ color: isOpen ? GOLD : TEXT }}>
                          {module.name}
                        </p>
                        <span className="text-xs font-bold flex-shrink-0"
                          style={{ color: isOpen ? GOLD : moduleDone ? '#27500A' : MUTED }}>
                          {modulePct}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full mt-1.5 overflow-hidden"
                        style={{ backgroundColor: isOpen ? 'rgba(255,201,77,0.18)' : CHIP }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${modulePct}%`, backgroundColor: isOpen ? GOLD : moduleDone ? '#27500A' : BLUE }} />
                      </div>
                      <p className="text-xs font-medium mt-1"
                        style={{ color: isOpen ? MUTED : '#A8A29E' }}>
                        {moduleTick1}/{moduleTotal} đã nộp · {moduleTick2}/{moduleTotal} đạt LT
                      </p>
                    </div>

                    <i className={`ti ti-chevron-down flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      style={{ fontSize: '16px', color: isOpen ? GOLD : MUTED }} />
                  </button>

                  {isOpen && (
                    <div className="px-4 py-3 space-y-2" style={{ borderTop: `1px solid rgba(255,255,255,0.08)` }}>
                      {moduleLessons.map(lesson => {                       
const prog = progressMap[lesson.id]
const isLocked = !isLessonUnlocked(lesson.id)
const isDone = !!(prog?.tick1 && prog?.tick2)
const isSubmitted = !!(prog?.tick1 && !prog?.tick2 && submissionStatusMap[lesson.id]?.status === 'pending')
const isRejected = !!(prog?.tick1 && !prog?.tick2 && submissionStatusMap[lesson.id]?.status === 'rejected')
const isInProgress = !!(prog?.tick1 && !prog?.tick2 && !submissionStatusMap[lesson.id])

                        return (
                          <div key={lesson.id}
                            onClick={() => { if (!isLocked) router.push(`/lesson/${lesson.id}`) }}
                            className={`rounded-xl p-3.5 flex items-center gap-3 transition-all ${!isLocked ? 'cursor-pointer' : ''}`}
                            style={{
                              backgroundColor: isDone ? OK_BG : isInProgress ? GOLD_SOFT : isLocked ? 'rgba(255,255,255,0.02)' : PANEL,
                              border: `1px solid ${isDone ? OK_BORDER : isInProgress ? WARN_BORDER : BORDER}`,
                              opacity: isLocked ? 0.5 : 1,
                            }}
                          >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={isDone ? { backgroundColor: OK_BG, color: OK, border: `1px solid ${OK_BORDER}` }
                                : isInProgress ? { backgroundColor: GOLD, color: DARK_ON_GOLD }
                                : isLocked ? { backgroundColor: 'rgba(255,255,255,0.05)', color: FAINT }
                                : { backgroundColor: CHIP, color: MUTED, border: `1px solid ${BORDER}` }}>
                              {isDone ? <i className="ti ti-check" style={{ fontSize: '12px' }} />
                                : isLocked ? <i className="ti ti-lock" style={{ fontSize: '12px' }} />
                                : lesson.order_index}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: TEXT }}>{lesson.title}</p>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                <span className="text-xs font-medium flex items-center gap-1"
                                  style={{ color: prog?.tick1 ? '#27500A' : '#A8A29E' }}>
                                  <span className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: prog?.tick1 ? '#27500A' : '#A8A29E' }} />
                                  Đã nộp
                                </span>
                                <span className="text-xs font-medium flex items-center gap-1"
                                  style={{ color: prog?.tick2 ? '#27500A' : '#A8A29E' }}>
                                  <span className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: prog?.tick2 ? '#27500A' : '#A8A29E' }} />
                                  Đạt lý thuyết
                                </span>
                                {prog?.perfect_score && (
                                  <span className="text-xs font-medium" style={{ color: '#B8860B' }}>
                                    ⭐ Perfect
                                  </span>
                                )}
                                {attemptCountMap[lesson.id] > 0 && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: attemptCountMap[lesson.id] >= 3 ? ERR_BG : CHIP,
                                      color: attemptCountMap[lesson.id] >= 3 ? ERR : MUTED,
                                      border: `1px solid ${attemptCountMap[lesson.id] >= 3 ? ERR_BORDER : BORDER}`,
                                    }}>
                                    Lần {attemptCountMap[lesson.id]}/3
                                  </span>
                                )}
                              </div>
                            </div>

                            {!isLocked && !isDone && !isSubmitted && !isRejected && (
  <span className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 text-white"
    style={{ backgroundColor: BLUE }}>
    {isInProgress ? 'Xem' : 'Học'}
  </span>
)}
{isSubmitted && (
  <span className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
    style={{ backgroundColor: WARN_BG, color: WARN, border: `1px solid ${WARN_BORDER}` }}>
    Chờ duyệt
  </span>
)}
{isRejected && (
  <button
    onClick={(e) => {
      e.stopPropagation()
      setRejectPopup({
        lessonId: lesson.id,
        title: lesson.title,
        reason: submissionStatusMap[lesson.id]?.reason ?? null
      })
    }}
    className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 transition-opacity hover:opacity-80"
    style={{ backgroundColor: ERR_BG, color: ERR, border: `1px solid ${ERR_BORDER}` }}>
    Bị từ chối
  </button>
)}
{isDone && (
  <span className="text-xs font-semibold flex-shrink-0" style={{ color: '#27500A' }}>Xong ✓</span>
)}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Badge popup */}
      {badgePopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setBadgePopup(null)}>
          <div className="rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
            onClick={e => e.stopPropagation()}>
            <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center overflow-hidden"
  style={{
    backgroundColor: '#FFFFFF',
    border: `3px solid ${GOLD}`,
    boxShadow: `0 0 34px ${GOLD_GLOW}`,
  }}>
  <img src={badgePopup.imageUrl} alt={badgePopup.label} className="w-full h-full object-cover scale-110" />
</div>
            <p className="text-xs tracking-[0.2em] uppercase mb-2 font-semibold"
              style={{ color: GOLD }}>Achievement Unlocked</p>
            <p className="text-2xl font-bold mb-2" style={{ color: TEXT }}>{badgePopup.label}</p>
            <p className="text-sm mb-6" style={{ color: MUTED }}>{badgePopup.desc}</p>
            <button onClick={() => setBadgePopup(null)}
              className="w-full py-3 rounded-2xl text-sm font-semibold transition-colors"
              style={{ backgroundColor: GOLD, color: DARK_ON_GOLD }}>
              Tiếp tục học →
            </button>
          </div>
        </div>
      )}
      {/* Reject popup */}
      {rejectPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setRejectPopup(null)}>
          <div className="rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}
            onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: ERR_BG, border: `1px solid ${ERR_BORDER}` }}>
              <i className="ti ti-alert-circle" style={{ fontSize: '28px', color: ERR }} />
            </div>
            <p className="text-xs tracking-[0.2em] uppercase mb-2 font-semibold" style={{ color: ERR }}>
              Bài tập bị từ chối
            </p>
            <p className="text-lg font-bold mb-3" style={{ color: TEXT }}>{rejectPopup.title}</p>
            <div className="rounded-2xl p-4 mb-6 text-left" style={{ backgroundColor: ERR_BG, border: `1px solid ${ERR_BORDER}` }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: ERR }}>Lý do</p>
              <p className="text-sm" style={{ color: '#991B1B' }}>
                {rejectPopup.reason || 'Admin chưa ghi lý do cụ thể — hãy xem lại bài làm và nộp lại.'}
              </p>
            </div>
            <button
              onClick={() => router.push(`/lesson/${rejectPopup.lessonId}`)}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-colors mb-2"
              style={{ backgroundColor: ERR, color: '#0A0E1A' }}>
              Làm lại ngay →
            </button>
            <button
              onClick={() => setRejectPopup(null)}
              className="w-full py-3 rounded-2xl text-sm font-medium transition-colors"
              style={{ border: `1px solid ${BORDER}`, color: MUTED }}>
              Đóng
            </button>
          </div>
        </div>
      )}

{/* Fireworks khi hoàn thành module */}
      {fireworksModuleId && <FireworksCanvas onDone={handleFireworksDone} />}

      {/* Feedback modal — chỉ hiện SAU KHI badge popup (nếu có) đã đóng, để không chồng 2 modal */}
      {pendingFeedback && !badgePopup && feedbackQuestions.length > 0 && (
        <FeedbackModal
          moduleName={pendingFeedback.moduleName}
          questions={feedbackQuestions}
          submitting={feedbackSubmitting}
          onSubmit={submitFeedback}
          onSkip={skipFeedback}
        />
      )}
      <Mascot welcomeMessage={mascotWelcome} dailyMessage={mascotDaily} storageKey={profile?.id} />
      <div className="h-10 lg:h-0" />
    </div>
  )
}