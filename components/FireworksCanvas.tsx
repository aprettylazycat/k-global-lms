'use client'
import { useEffect, useRef } from 'react'

const COLORS = ['#E63946', '#F4A261', '#2A9D8F', '#E9C46A', '#264653', '#A8DADC', '#F7B731', '#6C5CE7', '#00B894', '#FD79A8', '#FDCB6E', '#0984E3']

type Particle = {
  x: number; y: number; vx: number; vy: number
  size: number; color: string; alpha: number; gravity: number
}

export default function FireworksCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const doneRef = useRef(false)

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let particles: Particle[] = []

    function explode(x: number, y: number) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const count = 40 + Math.floor(Math.random() * 20)
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count
        const speed = 2 + Math.random() * 4
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2 + Math.random() * 2.5,
          color,
          alpha: 1,
          gravity: 0.04,
        })
      }
    }

    let tick = 0
    const launches = [0, 25, 50, 80, 110, 140]
    let rafId: number

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      if (launches.includes(tick)) {
        const x = canvas!.width * (0.2 + Math.random() * 0.6)
        const y = canvas!.height * (0.2 + Math.random() * 0.3)
        explode(x, y)
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.vy += p.gravity
        p.x += p.vx
        p.y += p.vy
        p.alpha -= 0.012
        if (p.alpha <= 0) { particles.splice(i, 1); continue }
        ctx!.save()
        ctx!.globalAlpha = Math.max(0, p.alpha)
        ctx!.fillStyle = p.color
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx!.fill()
        ctx!.restore()
      }

      tick++
      if (tick < 220 || particles.length > 0) {
        rafId = requestAnimationFrame(animate)
      } else {
        finish()
      }
    }
    animate()

    const timeout = setTimeout(finish, 4000) // an toàn: tự tắt tối đa 4s dù particles chưa hết

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timeout)
      window.removeEventListener('resize', resize)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed inset-0 z-[100] cursor-pointer"
      onClick={finish}
      style={{ pointerEvents: 'auto' }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs font-medium text-white/70">
        Nhấn để bỏ qua
      </p>
    </div>
  )
}