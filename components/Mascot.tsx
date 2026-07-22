'use client'
import { useEffect, useRef, useState } from 'react'
import { RAISED, TEXT, GOLD, NAVY, BORDER_STRONG as BORDER } from '@/lib/theme'



const IDLE_MESSAGES = [
  { icon: '⏰', text: 'Ơ, bạn vẫn đang học đấy chứ? Đồng hồ đang chạy nè 👀' },
  { icon: '🎵', text: 'Huýt sáo chờ bạn quay lại... 🎶' },
  { icon: '🚪', text: 'Cốc cốc~ Có ai ở đó không? 😄' },
  { icon: '💪', text: 'Cố lên nào! Bạn sắp hoàn thành rồi đó!' },
  { icon: '❓', text: 'Bạn có đang gặp khó khăn ở đâu không? Đừng ngại hỏi mentor nhé!' },
]

// 3 nhóm dáng — mỗi nhóm luân phiên ngẫu nhiên. Thêm ảnh mới chỉ cần thêm path vào đúng mảng.
const STUDY_POSES = ['/mascot/panda-laptop.png', '/mascot/panda-reading.png', '/mascot/panda-new-4.png']       // dùng ở trang Lesson
const IDLE_POSES = ['/mascot/panda-noodles.png', '/mascot/panda-backview.png', '/mascot/panda-new-2.png', '/mascot/panda-new-3.png']      // dùng ở Dashboard/Trang chủ
const TALK_POSES = ['/mascot/panda-wave-twig.png', '/mascot/panda-wave-normal.png', '/mascot/panda-heart.png', '/mascot/panda-new-1.png', '/mascot/panda-new-5-hug-bamboo.png'] // khi đang "nói"

const IDLE_MS = 2 * 60 * 1000        // 2 phút không có tương tác
const WANDER_MIN_MS = 10000
const WANDER_MAX_MS = 18000
const WALK_DURATION_MS = 2500
const TOP_MIN = 15                   // % chiều cao màn hình, giới hạn vùng tự di chuyển dọc
const TOP_MAX = 70
const POSE_CYCLE_MS = 9000           // đổi dáng nghỉ (khi không nói) mỗi 9s
const MASCOT_SIZE_DESKTOP = 112      // px
const MASCOT_SIZE_MOBILE = 64        // px — tương đương Tailwind size-12, dùng khi màn hình < 640px
const MOBILE_BREAKPOINT = 640        // px — khớp breakpoint 'sm' của Tailwind
const DRAG_CLICK_THRESHOLD = 6       // px — di chuột dưới ngưỡng này khi thả tay = coi là "click", không phải "kéo"

function pickRandom<T>(arr: T[], exclude?: T): T {
  const options = exclude ? arr.filter(x => x !== exclude) : arr
  return options[Math.floor(Math.random() * options.length)] ?? arr[0]
}

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
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
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null) // null = chưa mount xong, dùng vị trí mặc định tạm
  const [size, setSize] = useState(MASCOT_SIZE_DESKTOP)
  const [dragging, setDragging] = useState(false)
  const draggedRef = useRef(false)         // đã từng bị kéo tay chưa — nếu có thì tắt auto-wander
  const dragStartRef = useRef({ px: 0, py: 0, x: 0, y: 0, moved: false })
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

  // Đặt kích thước + vị trí ban đầu sau khi mount (cần window để tính toán)
  // Cũng tự cập nhật lại khi xoay màn hình / đổi kích thước cửa sổ
  useEffect(() => {
    function applySize() {
      const s = window.innerWidth < MOBILE_BREAKPOINT ? MASCOT_SIZE_MOBILE : MASCOT_SIZE_DESKTOP
      setSize(s)
      setPos(prev => {
        if (!prev) return { x: window.innerWidth - s - (s === MASCOT_SIZE_MOBILE ? 16 : 32), y: window.innerHeight * 0.4 }
        return { x: clamp(prev.x, 0, window.innerWidth - s), y: clamp(prev.y, 0, window.innerHeight - s) }
      })
    }
    applySize()
    window.addEventListener('resize', applySize)
    return () => window.removeEventListener('resize', applySize)
  }, [])

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

  // Loanh quanh tự động (chiều dọc) — CHỈ khi người dùng chưa từng tự kéo panda đi chỗ khác
  useEffect(() => {
    function scheduleNextWander() {
      const delay = WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS)
      wanderTimerRef.current = setTimeout(() => {
        if (!draggedRef.current) {
          setPos(prev => {
            const x = prev?.x ?? (window.innerWidth - size - 32)
            const y = TOP_MIN / 100 * window.innerHeight + Math.random() * ((TOP_MAX - TOP_MIN) / 100 * window.innerHeight)
            return { x, y }
          })
        }
        scheduleNextWander()
      }, delay)
    }
    scheduleNextWander()
    return () => { if (wanderTimerRef.current) clearTimeout(wanderTimerRef.current) }
  }, [size])

  // Kéo thả — pointer events, gắn listener lên window trong lúc đang kéo để không bị mất theo dõi khi tay ra khỏi ảnh
  function handlePointerDown(e: React.PointerEvent) {
    if (!pos) return
    dragStartRef.current = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, moved: false }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return

    function handleMove(e: PointerEvent) {
      const start = dragStartRef.current
      const dx = e.clientX - start.px
      const dy = e.clientY - start.py
      if (Math.abs(dx) > DRAG_CLICK_THRESHOLD || Math.abs(dy) > DRAG_CLICK_THRESHOLD) {
        dragStartRef.current.moved = true
      }
      const newX = clamp(start.x + dx, 0, window.innerWidth - size)
      const newY = clamp(start.y + dy, 0, window.innerHeight - size)
      setPos({ x: newX, y: newY })
    }

    function handleUp() {
      setDragging(false)
      if (dragStartRef.current.moved) {
        draggedRef.current = true // đã kéo thật sự → tắt auto-wander vĩnh viễn cho phiên này
      } else {
        // Không di chuyển đáng kể → coi là click: đổi dáng + tắt bong bóng đang hiện (nếu có)
        setBubble(null)
        setPose(prev => pickRandom(restPoses, prev))
      }
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, size])

  if (!pos) return null // chờ tính vị trí ban đầu xong mới render, tránh nhảy vị trí lúc đầu

  return (
    <div
      className={`fixed z-40 flex flex-col items-center gap-2 select-none ${dragging ? '' : 'transition-[left,top] ease-in-out'}`}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        transitionDuration: dragging ? '0ms' : `${WALK_DURATION_MS}ms`,
        touchAction: 'none',
      }}
    >
      {bubble && (
        <div className="relative max-w-[180px] sm:max-w-[240px] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 shadow-xl"
          style={{ backgroundColor: RAISED, border: `2px solid ${BORDER}` }}>
          <p className="text-xs sm:text-sm leading-snug" style={{ color: TEXT }}>
            {bubble.icon && <span className="mr-1">{bubble.icon}</span>}
            {bubble.text}
          </p>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45"
            style={{ backgroundColor: RAISED, borderRight: `2px solid ${BORDER}`, borderBottom: `2px solid ${BORDER}` }} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={pose}
        alt="K-Global mascot"
        onPointerDown={handlePointerDown}
        draggable={false}
        className={`object-contain transition-transform hover:scale-110 ${dragging ? 'cursor-grabbing scale-110' : 'cursor-grab active:scale-95'}`}
        style={{ width: size, height: size, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.25))' }}
        title="Kéo để di chuyển — bấm để đổi dáng"
      />
    </div>
  )
}