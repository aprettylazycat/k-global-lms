'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Profile, Progress } from '@/types'

type ModuleItem = {
  id: number
  name: string
  description: string | null
  order_index: number
}

type LessonListItem = {
  id: number
  title: string
  order_index: number
  module_id: number
}

const badgeDefs = [
  { type: 'bronze', label: 'Apprentice', min: 25, bg: '#FBF7EE', color: '#C9A84C',
    desc: 'Bạn đã hoàn thành 25% lộ trình — bước đầu của một hành trình dài.' },
  { type: 'silver', label: 'Artisan', min: 50, bg: '#F0F4F8', color: '#4A6FA5',
    desc: 'Nửa chặng đường — bạn đang xây dựng tay nghề thật sự.' },
  { type: 'gold', label: 'Craftsman', min: 75, bg: '#FBF7EE', color: '#B8860B',
    desc: '75% hoàn thành — kỹ năng của bạn đang được tôi luyện.' },
  { type: 'diamond', label: 'Master', min: 100, bg: '#EFF6FF', color: '#0E62B1',
    desc: 'Xuất sắc! Bạn đã làm chủ toàn bộ lộ trình đào tạo.' },
]

const NAVY = '#466898'
const GOLD = '#C9A84C'
const BLUE = '#0E62B1'
const CREAM = '#F5F0E8'
const BORDER = '#E2D8C8'
const MUTED = '#8AABC8'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [lessons, setLessons] = useState<LessonListItem[]>([])
  const [modules, setModules] = useState<ModuleItem[]>([])
  const [progressMap, setProgressMap] = useState<Record<number, Progress>>({})
  const [badges, setBadges] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [openModules, setOpenModules] = useState<Set<number>>(new Set())
  const [badgePopup, setBadgePopup] = useState<typeof badgeDefs[0] | null>(null)

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

      const [lessonsRes, modulesRes, badgesRes] = await Promise.all([
        supabase.from('lessons')
          .select('id, title, order_index, module_id')
          .eq('branch_id', prof.branch_id)
          .eq('is_published', true)
          .order('order_index'),
        supabase.from('modules')
          .select('id, name, description, order_index')
          .eq('branch_id', prof.branch_id)
          .order('order_index'),
        supabase.from('badges')
          .select('badge_type')
          .eq('user_id', session.user.id),
      ])

      const lessonList = lessonsRes.data ?? []
      setLessons(lessonList as LessonListItem[])
      setModules((modulesRes.data ?? []) as ModuleItem[])
      setBadges(badgesRes.data?.map((b: any) => b.badge_type) ?? [])

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
      }

      setLoading(false)
    }
    load()
  }, [router])

  const tick1Count = lessons.filter(l => progressMap[l.id]?.tick1).length
  const tick2Count = lessons.filter(l => progressMap[l.id]?.tick2).length
  const done = lessons.filter(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2).length
  const pending = lessons.filter(l => progressMap[l.id]?.tick1 && !progressMap[l.id]?.tick2).length
  const perfectCount = lessons.filter(l => progressMap[l.id]?.perfect_score).length
  const pct = lessons.length
    ? Math.round(((tick1Count / lessons.length) + (tick2Count / lessons.length)) / 2 * 100)
    : 0

  const lessonsByModule = modules.map(mod => ({
    module: mod,
    lessons: lessons.filter(l => l.module_id === mod.id).sort((a, b) => a.order_index - b.order_index)
  })).filter(g => g.lessons.length > 0)

  const orderedLessons = lessonsByModule.flatMap(g => g.lessons)

  function isLessonUnlocked(lessonId: number) {
    const idx = orderedLessons.findIndex(l => l.id === lessonId)
    if (idx <= 0) return true
    const prevLesson = orderedLessons[idx - 1]
    return !!progressMap[prevLesson.id]?.tick1
  }

  const currentModuleGroup = lessonsByModule.find(g =>
    !g.lessons.every(l => progressMap[l.id]?.tick1 && progressMap[l.id]?.tick2)
  ) ?? lessonsByModule[lessonsByModule.length - 1]

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: CREAM }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BORDER, borderTopColor: NAVY }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>

      {/* Top bar — navy */}
      <div className="px-5 py-3.5 sticky top-0 z-10" style={{ backgroundColor: NAVY, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
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
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
              style={{ backgroundColor: GOLD, color: NAVY }}>
              {profile?.name?.split(' ').slice(-2).map((w: string) => w[0]).join('').toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'white' }}>{profile?.name}</p>
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
          <div className="rounded-3xl p-6" style={{ backgroundColor: NAVY }}>
            <p className="text-xs mb-1 tracking-widest uppercase font-semibold" style={{ color: GOLD }}>Tiến độ học tập</p>
            <p className="text-5xl font-bold mb-4" style={{ color: 'white' }}>{pct}%</p>
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: GOLD }} />
            </div>
            <p className="text-xs font-medium" style={{ color: MUTED }}>{done}/{lessons.length} bài hoàn thành</p>
          </div>

          {/* Module hiện tại — white card */}
          {currentModuleGroup && (
            <div className="rounded-3xl p-5" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
              <p className="text-xs mb-1 tracking-widest uppercase font-semibold" style={{ color: GOLD }}>Đang học</p>
              <p className="text-base font-semibold mb-3" style={{ color: NAVY }}>
                {currentModuleGroup.module.name}
              </p>
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: CREAM }}>
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
                  <div key={i} className="rounded-xl p-2.5 text-center" style={{ backgroundColor: CREAM }}>
                    <p className="text-sm font-bold" style={{ color: NAVY }}>{s.value}</p>
                    <p className="text-xs mt-0.5 font-medium" style={{ color: MUTED }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats 2x2 */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: done, label: 'Đạt lý thuyết', color: '#27500A' },
              { value: pending, label: 'Chờ duyệt', color: GOLD },
              { value: lessons.length - done - pending, label: 'Chưa học', color: MUTED },
              { value: perfectCount, label: '⭐ Perfect', color: '#B8860B' },
            ].map((s, i) => (
              <div key={i} className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: MUTED }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Badges */}
          <div className="rounded-3xl p-5" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
            <p className="text-base font-semibold mb-4" style={{ color: NAVY }}>Achievement</p>
            <div className="space-y-2.5">
              {badgeDefs.map(b => {
                const earned = badges.includes(b.type)
                return (
                  <div key={b.type}
                    className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${earned ? 'opacity-100' : 'opacity-35'}`}
                    style={{ backgroundColor: earned ? b.bg : '#F9F9F9', border: `1px solid ${earned ? BORDER : 'transparent'}` }}>
                    <img src={`/badges/${b.type}.png`} alt={b.label}
                      className="w-10 h-10 object-contain flex-shrink-0"
                      style={{ filter: earned ? 'none' : 'grayscale(1)' }} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: earned ? b.color : '#78716C' }}>
                        {b.label}
                      </p>
                      <p className="text-xs font-medium" style={{ color: earned ? b.color : '#A8A29E', opacity: earned ? 0.85 : 1 }}>
                        {earned ? `Đạt được tại ${b.min}%` : `Hoàn thành ${b.min}% để mở khóa`}
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
          {lessonsByModule.length === 0 && (
            <div className="rounded-3xl p-10 text-center" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
              <p className="text-sm" style={{ color: MUTED }}>Chưa có bài học nào được xuất bản.</p>
            </div>
          )}

          <div className="space-y-3">
            {lessonsByModule.map(({ module, lessons: moduleLessons }) => {
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
                  style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
                  <button
                    onClick={() => {
                      const next = new Set(openModules)
                      isOpen ? next.delete(module.id) : next.add(module.id)
                      setOpenModules(next)
                    }}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left transition-colors"
                    style={{ backgroundColor: isOpen ? NAVY : 'white' }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={moduleDone
                        ? { backgroundColor: '#EAF3DE', color: '#27500A' }
                        : !moduleUnlocked
                        ? { backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.3)' }
                        : isOpen
                        ? { backgroundColor: GOLD, color: NAVY }
                        : { backgroundColor: CREAM, color: NAVY }}>
                      {moduleDone ? <i className="ti ti-check" />
                        : !moduleUnlocked ? <i className="ti ti-lock" style={{ fontSize: '12px' }} />
                        : module.order_index}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate"
                          style={{ color: isOpen ? 'white' : NAVY }}>
                          {module.name}
                        </p>
                        <span className="text-xs font-bold flex-shrink-0"
                          style={{ color: isOpen ? GOLD : moduleDone ? '#27500A' : MUTED }}>
                          {modulePct}%
                        </span>
                      </div>
                      <div className="h-1 rounded-full mt-1.5 overflow-hidden"
                        style={{ backgroundColor: isOpen ? 'rgba(255,255,255,0.15)' : CREAM }}>
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
                        const isInProgress = !!(prog?.tick1 && !prog?.tick2)

                        return (
                          <div key={lesson.id}
                            onClick={() => { if (!isLocked && !isDone) router.push(`/lesson/${lesson.id}`) }}
                            className={`rounded-xl p-3.5 flex items-center gap-3 transition-all ${!isLocked && !isDone ? 'cursor-pointer' : ''}`}
                            style={{
                              backgroundColor: isDone ? '#EAF3DE' : isInProgress ? '#FFFBEB' : isLocked ? '#F9FAFB' : 'white',
                              border: `1px solid ${isDone ? '#C0DD97' : isInProgress ? '#FDE68A' : BORDER}`,
                              opacity: isLocked ? 0.5 : 1,
                            }}
                          >
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={isDone ? { backgroundColor: '#27500A', color: 'white' }
                                : isInProgress ? { backgroundColor: GOLD, color: NAVY }
                                : isLocked ? { backgroundColor: '#E5E7EB', color: '#9CA3AF' }
                                : { backgroundColor: BLUE, color: 'white' }}>
                              {isDone ? <i className="ti ti-check" style={{ fontSize: '12px' }} />
                                : isLocked ? <i className="ti ti-lock" style={{ fontSize: '12px' }} />
                                : lesson.order_index}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>{lesson.title}</p>
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
                              </div>
                            </div>

                            {!isLocked && !isDone && (
                              <span className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0 text-white"
                                style={{ backgroundColor: BLUE }}>
                                {isInProgress ? 'Xem' : 'Học'}
                              </span>
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
            style={{ backgroundColor: 'white' }}
            onClick={e => e.stopPropagation()}>
            <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: badgePopup.bg }}>
              <img src={`/badges/${badgePopup.type}.png`} alt={badgePopup.label}
                className="w-16 h-16 object-contain" />
            </div>
            <p className="text-xs tracking-[0.2em] uppercase mb-2 font-semibold"
              style={{ color: GOLD }}>Achievement Unlocked</p>
            <p className="text-2xl font-bold mb-2" style={{ color: NAVY }}>{badgePopup.label}</p>
            <p className="text-sm mb-6" style={{ color: MUTED }}>{badgePopup.desc}</p>
            <button onClick={() => setBadgePopup(null)}
              className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: NAVY }}>
              Tiếp tục học →
            </button>
          </div>
        </div>
      )}
      <div className="h-10 lg:h-0" />
    </div>
  )
}