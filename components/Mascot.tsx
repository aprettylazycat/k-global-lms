'use client'
import { useEffect, useRef, useState } from 'react'

const NAVY = '#466898'
const GOLD = '#C9A84C'
const CREAM = '#F5F0E8'
const BORDER = '#E2D8C8'

const MASCOT_EMOJI = '🐼' // panda — capybara chưa có emoji chính thức trong Unicode nên không dùng được

const IDLE_MESSAGES = [
  { icon: '⏰', text: 'Ơ, bạn vẫn đang học đấy chứ? Đồng hồ đang chạy nè 👀' },
  { icon: '🎵', text: 'Huýt sáo chờ bạn quay lại... 🎶' },
  { icon: '🚪', text: 'Cốc cốc~ Có ai ở đó không? 😄' },
  { icon: '💪', text: 'Cố lên nào! Bạn sắp hoàn thành rồi đó!' },
  { icon: '❓', text: 'Bạn có đang gặp khó khăn ở đâu không? Đừng ngại hỏi mentor nhé!' },
]

const IDLE_MS = 2 * 60 * 1000 // 2 phút không có tương tác

export default function Mascot({
  welcomeMessage,
  dailyMessage,
  storageKey,
}: {
  welcomeMessage?: string   // hiện 1 lần duy nhất (lần đầu login) — chỉ truyền ở trang cần
  dailyMessage?: string     // hiện 1 lần mỗi ngày — chỉ truyền ở trang cần
  storageKey?: string       // thường là user id, dùng để tách riêng theo từng học viên
}) {
  const [bubble, setBubble] = useState<{ icon?: string; text: string } | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showBubble(msg: { icon?: string; text: string }, durationMs = 5500) {
    setBubble(msg)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setBubble(null), durationMs)
  }

  // Welcome (lần đầu) / Daily (mỗi ngày) — chỉ chạy khi có storageKey + message tương ứng
  useEffect(() => {
    if (!storageKey) return
    const welcomeKey = `mascot_welcome_${storageKey}`
    const todayStr = new Date().toISOString().slice(0, 10)
    const dailyKey = `mascot_daily_${storageKey}_${todayStr}`

    const timer = setTimeout(() => {
      if (welcomeMessage && !localStorage.getItem(welcomeKey)) {
        showBubble({ icon: '👋', text: welcomeMessage }, 7000)
        localStorage.setItem(welcomeKey, '1')
      } else if (dailyMessage && !localStorage.getItem(dailyKey)) {
        showBubble({ icon: '📈', text: dailyMessage }, 7000)
        localStorage.setItem(dailyKey, '1')
      }
    }, 1200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Idle detection — áp dụng ở mọi trang có gắn Mascot
  useEffect(() => {
    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        const msg = IDLE_MESSAGES[Math.floor(Math.random() * IDLE_MESSAGES.length)]
        showBubble(msg, 5500)
        resetIdleTimer() // lặp lại cho chu kỳ idle tiếp theo
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
  }, [])

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
      {bubble && (
        <div className="relative max-w-[240px] rounded-2xl px-4 py-3 shadow-xl"
          style={{ backgroundColor: 'white', border: `2px solid ${BORDER}` }}>
          <p className="text-sm leading-snug" style={{ color: NAVY }}>
            {bubble.icon && <span className="mr-1">{bubble.icon}</span>}
            {bubble.text}
          </p>
          {/* Đuôi bong bóng trỏ xuống nhân vật */}
          <div className="absolute -bottom-2 right-6 w-4 h-4 rotate-45"
            style={{ backgroundColor: 'white', borderRight: `2px solid ${BORDER}`, borderBottom: `2px solid ${BORDER}` }} />
        </div>
      )}
      <button
        onClick={() => setBubble(null)}
        className="w-24 h-24 rounded-full flex items-center justify-center text-6xl shadow-xl transition-transform hover:scale-110 active:scale-95"
        style={{ backgroundColor: CREAM, border: `3px solid ${GOLD}` }}
        title="Trợ lý K-Global"
      >
        <span className="inline-block animate-bounce" style={{ animationDuration: '2.2s' }}>
          {MASCOT_EMOJI}
        </span>
      </button>
    </div>
  )
}
