'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

type ModuleItem = {
  id: number
  name: string
  description: string | null
  order_index: number
  lessonCount: number
}

type BranchStat = {
  id: string
  name: string
  slug: string
  color_bg: string
  color_text: string
  lessonCount: number
  modules: ModuleItem[]
}

export default function Home() {
  const [branches, setBranches] = useState<BranchStat[]>([])
  const [learnerCount, setLearnerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: branchData } = await supabase
        .from('branches')
        .select('id, name, slug, color_bg, color_text')

      const { count: learners } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'learner')

      setLearnerCount(learners ?? 0)
      if (!branchData) { setLoading(false); return }

      const withData = await Promise.all(
        branchData.map(async (b) => {
          const { count: lessonCount } = await supabase
            .from('lessons')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', b.id)
            .eq('is_published', true)

          const { data: moduleList } = await supabase
            .from('modules')
            .select('id, name, description, order_index')
            .eq('branch_id', b.id)
            .order('order_index')

          const modulesWithCount = await Promise.all(
            (moduleList ?? []).map(async (m) => {
              const { count: mc } = await supabase
                .from('lessons')
                .select('*', { count: 'exact', head: true })
                .eq('module_id', m.id)
                .eq('is_published', true)
              return { ...m, lessonCount: mc ?? 0 }
            })
          )

          return {
            ...b,
            color_bg: b.color_bg || '#F4F4F5',
            color_text: b.color_text || '#374151',
            lessonCount: lessonCount ?? 0,
            modules: modulesWithCount,
          }
        })
      )

      setBranches(withData)
      if (withData.length > 0) setSelectedBranch(withData[0].id)
      setLoading(false)
    }
    load()
  }, [])

  const totalLessons = branches.reduce((sum, b) => sum + b.lessonCount, 0)
  const activeBranch = branches.find(b => b.id === selectedBranch) ?? null

  const stats = [
    { value: totalLessons, label: 'bài học' },
    { value: branches.length, label: 'nhánh đào tạo' },
    { value: learnerCount, label: 'học viên' },
  ]

  return (
    <div style={{ backgroundColor: '#FAF8F4' }} className="min-h-screen flex flex-col text-[#1C1917]">

      {/* ── Header ── */}
      <div className="border-b sticky top-0 z-20"
        style={{ backgroundColor: 'rgba(250,248,244,0.95)', borderColor: '#E8E2D6', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="https://k-global.com.vn/" target="_blank" rel="noreferrer">
            <Image src="/logo-kglobal.png" alt="K-Global" width={120} height={36}
              style={{ height: '32px', width: 'auto' }} priority />
          </a>
          <div className="flex items-center gap-5">
            <a href="tel:+84855555722"
              className="text-sm text-[#6B6760] hover:text-[#1C1917] transition-colors hidden md:block">
              +84 85 555 5722
            </a>
            <a href="https://www.facebook.com/kglobalvn/" target="_blank" rel="noreferrer"
              className="text-[#6B6760] hover:text-[#1C1917] transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94Z"/>
              </svg>
            </a>
            <Link href="/login"
              className="text-sm text-[#6B6760] hover:text-[#1C1917] transition-colors hidden sm:block">
              Đăng nhập
            </Link>
            <Link href="/register"
              className="text-sm bg-[#1C1917] text-[#FAF8F4] px-5 py-2.5 rounded hover:bg-[#2A2520] transition-colors font-semibold">
              Bắt đầu học
            </Link>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image src="/banner-kglobal.png" alt="Đội ngũ K-Global" fill
            style={{ objectFit: 'cover', objectPosition: 'center 25%' }} priority />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg,rgba(28,25,23,.5) 0%,rgba(28,25,23,.72) 55%,rgba(28,25,23,.92) 100%)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center">
          <p className="text-xs tracking-[0.22em] uppercase text-[#E8C9A0] mb-5 font-medium">
            Đào tạo nội bộ — K-Global
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.2] mb-6"
            style={{ color: '#FAF8F4' }}>
            Làm chủ tay nghề<br />theo cách của K-Global
          </h1>
          <p className="text-sm sm:text-base leading-relaxed mb-10 max-w-lg mx-auto"
            style={{ color: '#E8E2D6' }}>
            Lộ trình đào tạo từng nhánh sản phẩm — từ kỹ thuật nền tảng đến tiêu chuẩn xuất khẩu,
            được đội ngũ sản xuất trực tiếp kiểm duyệt.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/register"
              className="bg-[#FAF8F4] text-[#1C1917] px-8 py-3.5 rounded text-sm font-semibold hover:bg-white transition-colors">
              Bắt đầu học ngay
            </Link>
            <Link href="/login"
              className="border text-sm px-8 py-3.5 rounded hover:bg-white/10 transition-colors font-medium"
              style={{ borderColor: 'rgba(250,248,244,0.4)', color: '#FAF8F4' }}>
              Tôi đã có tài khoản
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="max-w-7xl mx-auto px-6 -mt-8 relative z-10 w-full">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="stat-box relative overflow-hidden rounded-xl text-center py-7 px-2"
              style={{ background: '#1C1917', border: '1px solid #2A2520' }}>
              <div className="stat-shimmer" aria-hidden="true" />
              <p className="text-3xl sm:text-4xl font-bold relative" style={{ color: '#FAF8F4' }}>
                {loading ? '—' : s.value}
              </p>
              <p className="text-xs tracking-wide relative font-medium" style={{ color: '#C9A87C' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Branch + Module 2-col ── */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 w-full">
        <p className="text-xs tracking-[0.2em] uppercase text-[#9A5B3F] text-center mb-3 font-semibold">
          Lộ trình theo nhánh
        </p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12"
          style={{ color: '#1C1917' }}>
          Chọn nhánh đào tạo của bạn
        </h2>

        <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-10 lg:items-start">

          {/* Cột trái: branch cards */}
          <div className="space-y-3 mb-8 lg:mb-0 lg:sticky lg:top-24">
            {loading ? [1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border h-28 animate-pulse" style={{ borderColor: '#E8E2D6' }} />
            )) : branches.map(b => {
              const isActive = selectedBranch === b.id
              return (
                <button key={b.id} onClick={() => setSelectedBranch(b.id)}
                  className="w-full text-left bg-white rounded-2xl p-6 relative overflow-hidden transition-all hover:shadow-md"
                  style={{ border: isActive ? `2px solid ${b.color_text}` : '1px solid #E8E2D6' }}>
                  <div className="absolute top-0 left-0 w-6 h-6 rounded-br-xl"
                    style={{ backgroundColor: b.color_text }} />
                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <p className="text-[11px] tracking-[0.15em] uppercase mb-1.5 font-semibold"
                        style={{ color: b.color_text }}>{b.name}</p>
                      <p className="text-2xl font-bold" style={{ color: '#1C1917' }}>
                        {b.lessonCount} bài học
                      </p>
                      <p className="text-xs text-[#9A9590] mt-1 font-medium">{b.modules.length} module</p>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isActive ? b.color_text : b.color_bg }}>
                      <i className="ti ti-arrow-right text-sm"
                        style={{ color: isActive ? '#FAF8F4' : b.color_text }} />
                    </div>
                  </div>
                  <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ backgroundColor: b.color_bg }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: isActive ? '100%' : '35%', backgroundColor: b.color_text, opacity: 0.6 }} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Cột phải: Module detail panel (PC) */}
          <div>
            <div className="hidden lg:block">
              {!activeBranch ? (
                <div className="bg-white rounded-3xl border p-16 text-center min-h-[420px] flex flex-col items-center justify-center"
                  style={{ borderColor: '#E8E2D6' }}>
                  <p className="text-xl font-medium" style={{ color: '#9A9590' }}>Chọn nhánh để xem lộ trình</p>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border overflow-hidden" style={{ borderColor: '#E8E2D6' }}>
                  <div className="px-8 py-6 border-b flex items-center gap-4"
                    style={{ borderColor: '#F0EBE3', backgroundColor: activeBranch.color_bg }}>
                    <div>
                      <p className="text-xs tracking-[0.15em] uppercase mb-1 font-semibold"
                        style={{ color: activeBranch.color_text, opacity: 0.8 }}>{activeBranch.name}</p>
                      <p className="text-2xl font-bold"
                        style={{ color: activeBranch.color_text }}>
                        {activeBranch.modules.length} module · {activeBranch.lessonCount} bài học
                      </p>
                    </div>
                  </div>
                  <div className="p-8">
                    {activeBranch.modules.length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="text-sm font-medium" style={{ color: '#9A9590' }}>Chưa có module nào trong nhánh này.</p>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {activeBranch.modules.map((m, idx) => (
                          <div key={m.id} className="flex items-start gap-6">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                                style={{ borderColor: activeBranch.color_text, color: activeBranch.color_text, backgroundColor: activeBranch.color_bg }}>
                                {m.order_index}
                              </div>
                              {idx < activeBranch.modules.length - 1 && (
                                <div className="w-0.5 flex-1 my-2"
                                  style={{ backgroundColor: activeBranch.color_bg, minHeight: '32px' }} />
                              )}
                            </div>
                            <div className="pt-1.5 pb-6 min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-4 mb-1">
                                <p className="text-base font-semibold" style={{ color: '#1C1917' }}>{m.name}</p>
                                <span className="text-xs px-3 py-1 rounded-full flex-shrink-0 font-semibold"
                                  style={{ backgroundColor: activeBranch.color_bg, color: activeBranch.color_text }}>
                                  {m.lessonCount} bài
                                </span>
                              </div>
                              {m.description && (
                                <p className="text-sm font-medium" style={{ color: '#6B6760' }}>{m.description}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile */}
            <div className="lg:hidden">
              {!loading && activeBranch && (
                <div className="bg-white rounded-2xl border p-5"
                  style={{ borderColor: activeBranch.color_text }}>
                  {activeBranch.modules.length === 0 ? (
                    <p className="text-sm font-medium text-center py-2" style={{ color: '#9A9590' }}>Chưa có module nào.</p>
                  ) : (
                    <div className="space-y-1">
                      {activeBranch.modules.map((m, idx) => (
                        <div key={m.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                              style={{ borderColor: activeBranch.color_text, color: activeBranch.color_text }}>
                              {m.order_index}
                            </span>
                            {idx < activeBranch.modules.length - 1 && (
                              <div className="w-px mt-1"
                                style={{ backgroundColor: activeBranch.color_bg, minHeight: '16px' }} />
                            )}
                          </div>
                          <div className="pt-0.5 pb-3 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: '#1C1917' }}>{m.name}</p>
                            {m.description && (
                              <p className="text-xs mt-0.5 font-medium" style={{ color: '#6B6760' }}>{m.description}</p>
                            )}
                            <p className="text-xs mt-0.5 font-medium" style={{ color: activeBranch.color_text }}>
                              {m.lessonCount} bài học
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Closing note ── */}
      <div style={{ backgroundColor: '#1C1917' }}>
        <div className="max-w-7xl mx-auto px-6 py-20 text-center">
          <p className="text-xs tracking-[0.2em] uppercase mb-6 font-semibold" style={{ color: '#C9A87C' }}>
            Lời nhắn từ ban lãnh đạo
          </p>
          <h3 className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-snug mb-6"
            style={{ color: '#FAF8F4' }}>
            Bắt đầu lộ trình của bạn<br />tại K-Global ngay hôm nay.
          </h3>
          <p className="text-sm leading-relaxed max-w-xl mx-auto font-medium" style={{ color: '#9A9590' }}>
            Bước đầu tiên không phải là làm thật nhanh — mà là hiểu thật đúng.
            Mỗi bài học trong hệ thống này được ban lãnh đạo trực tiếp biên soạn,
            đúc kết từ nhiều năm làm nghề và xuất khẩu thực chiến.
            Hãy học như thể bạn đang ngồi cùng người tạo ra nó.
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="text-center py-6" style={{ backgroundColor: '#1C1917', borderTop: '1px solid #2A2520' }}>
        <p className="text-xs font-medium" style={{ color: '#4A4540' }}>
          © {new Date().getFullYear()} K-Global — Hệ thống đào tạo nội bộ
        </p>
      </div>

      <style jsx>{`
        .stat-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(120deg, transparent 20%, rgba(201,168,124,0.18) 50%, transparent 80%);
          background-size: 200% 100%;
          animation: shimmer 6s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (prefers-reduced-motion: reduce) { .stat-shimmer { animation: none; } }
      `}</style>
    </div>
  )
}