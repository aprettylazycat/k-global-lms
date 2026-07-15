'use client'
import { useEffect, useRef, useState } from 'react'

const NAVY = '#466898'
const BORDER = '#E2D8C8'

const IDLE_MESSAGES = [
  { icon: '⏰', text: 'Ơ, bạn vẫn đang học đấy chứ? Đồng hồ đang chạy nè 👀' },
  { icon: '🎵', text: 'Huýt sáo chờ bạn quay lại... 🎶' },
  { icon: '🚪', text: 'Cốc cốc~ Có ai ở đó không? 😄' },
  { icon: '💪', text: 'Cố lên nào! Bạn sắp hoàn thành rồi đó!' },
  { icon: '❓', text: 'Bạn có đang gặp khó khăn ở đâu không? Đừng ngại hỏi mentor nhé!' },
]

// 3 nhóm dáng — mỗi nhóm luân phiên ngẫu nhiên
const STUDY_POSES = ['/mascot/panda-laptop.png', '/mascot/panda-reading.png']       // dùng ở trang Lesson
const IDLE_POSES = ['/mascot/panda-noodles.png', '/mascot/panda-backview.png']      // dùng ở Dashboard/Trang chủ
const TALK_POSES = ['/mascot/panda-wave-twig.png', '/mascot/panda-wave-normal.png', '/mascot/panda-heart.png'] // khi đang "nói"

const IDLE_MS = 2 * 60 * 1000        // 2 phút không có tương tác
const WANDER_MIN_MS = 10000
const WANDER_MAX_MS = 18000
const WALK_DURATION_MS = 2500
const TOP_MIN = 15                   // % chiều cao màn hình, giới hạn vùng di chuyển dọc
const TOP_MAX = 70
const POSE_CYCLE_MS = 9000           // đổi dáng nghỉ (khi không nói) mỗi 9s

function pickRandom<T>(arr: T[], exclude?: T): T {
  const options = exclude ? arr.filter(x => x !== exclude) : arr
  return options[Math.floor(Math.random() * options.length)] ?? arr[0]
}

export default function Mascot({
  welcomeMessage,
  dailyMessage,
  storageKey,
  variant = 'idle', // 'idle' = Dashboard/Trang chủ, 'study' = trang Lesson
}: {
  welcomeMessage?: string
  dailyMessage?: string
  storageKey?: string
  variant?: 'idle' | 'study'
}) {
  const restPoses = variant === 'study' ? STUDY_POSES : IDLE_POSES
  const [bubble, setBubble] = useState<{ icon?: string; text: string } | null>(null)
  const [pose, setPose] = useState(restPoses[0])
  const [topPct, setTopPct] = useState(40)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wanderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showBubble(msg: { icon?: string; text: string }, durationMs = 8000) {
    setPose(prev => pickRandom(TALK_POSES, prev))
    setBubble(msg)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setBubble(null)
      setPose(prev => pickRandom(restPoses, prev))
    }, durationMs)
  }

  // Welcome (lần đầu) / Daily (mỗi ngày)
  useEffect(() => {
    if (!storageKey) return
    const welcomeKey = `mascot_welcome_${storageKey}`
    const todayStr = new Date().toISOString().slice(0, 10)
    const dailyKey = `mascot_daily_${storageKey}_${todayStr}`

    const timer = setTimeout(() => {
      if (welcomeMessage && !localStorage.getItem(welcomeKey)) {
        showBubble({ icon: '👋', text: welcomeMessage }, 10000)
        localStorage.setItem(welcomeKey, '1')
      } else if (dailyMessage && !localStorage.getItem(dailyKey)) {
        showBubble({ icon: '📈', text: dailyMessage }, 10000)
        localStorage.setItem(dailyKey, '1')
      }
    }, 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Idle detection — bật bong bóng random sau 2 phút không tương tác
  useEffect(() => {
    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        const msg = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)]
        showBubble(msg, 8000)
        resetIdleTimer()
      }, IDLE_MS)
    }
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetIdleTimer))
    resetIdleTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đổi dáng nghỉ định kỳ khi không nói (tạo cảm giác sống động)

  useEffect(() => {
    const interval = setInterval(() => {
      setBubble(current => {
        if (!current) {
          setPose(prev => pickRandom(restPoses, prev))
        }
        return current
      })
    }, POSE_CYCLE_MS)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant])

  // Loanh quanh — đổi vị trí ngẫu nhiên theo chiều dọc, giữ cố định cạnh phải
  useEffect(() => {
    function scheduleNextWander() {
      const delay = WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS)
      wanderTimerRef.current = setTimeout(() => {
        setTopPct(TOP_MIN + Math.random() * (TOP_MAX - TOP_MIN))
        scheduleNextWander()
      }, delay)
    }
    scheduleNextWander()
    return () => { if (wanderTimerRef.current) clearTimeout(wanderTimerRef.current) }
  }, [])

  return (
    <div
      className="fixed z-40 flex flex-col items-center gap-2 transition-[top] ease-in-out"
      style={{ right: '32px', top: `${topPct}%`, transitionDuration: `${WALK_DURATION_MS}ms` }}
    >
      {bubble && (
        <div className="relative max-w-[240px] rounded-2xl px-4 py-3 shadow-xl"
          style={{ backgroundColor: 'white', border: `2px solid ${BORDER}` }}>
          <p className="text-sm leading-snug" style={{ color: NAVY }}>
            {bubble.icon && <span className="mr-1">{bubble.icon}</span>}
            {bubble.text}
          </p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
            style={{ backgroundColor: 'white', borderRight: `2px solid ${BORDER}`, borderBottom: `2px solid ${BORDER}` }} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pose}
        alt="K-Global mascot"
        onClick={() => setBubble(null)}
        className="w-28 h-28 object-contain cursor-pointer transition-transform hover:scale-110 active:scale-95"
        style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.25))' }}
        title="Trợ lý K-Global"
      />
    </div>
  )
}