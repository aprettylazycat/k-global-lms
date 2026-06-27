'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

const NAVY = '#466898'
const GOLD = '#C9A84C'
const CREAM = '#F5F0E8'
const BORDER = '#E2D8C8'
const MUTED = '#8AABC8'

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
            color_bg: b.color_bg || '#EFF6FF',
            color_text: b.color_text || NAVY,
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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM, color: NAVY }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 relative" style={{ backgroundColor: NAVY, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="https://k-global.com.vn/" target="_blank" rel="noreferrer">
            <Image src="/logo-kglobal.png" alt="K-Global" width={160} height={48}
              style={{ height: '42px', width: 'auto', filter: 'brightness(0) invert(1)' }} priority />
          </a>
          <span className="text-xs font-semibold tracking-widest uppercase hidden sm:block"
            style={{ color: GOLD, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            Học viên Đào tạo K-Global
          </span>
          <div className="flex items-center gap-5">
            <a href="tel:+84855555722"
              className="text-sm hidden md:block transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.85)' }}>
              +84 85 555 5722
            </a>
            <a href="https://www.facebook.com/kglobalvn/" target="_blank" rel="noreferrer"
              className="transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.85)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94Z"/>
              </svg>
            </a>
            <Link href="/login"
              className="text-sm hidden sm:block transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.85)' }}>
              Đăng nhập
            </Link>
            <Link href="/register"
              className="text-sm font-semibold px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: GOLD, color: NAVY }}>
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
            style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.75) 100%)` }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-28 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.2] mb-6"
            style={{ color: 'white' }}>
            Làm chủ tay nghề<br />theo cách của K-Global
          </h1>
          <p className="text-sm sm:text-base leading-relaxed mb-10 max-w-lg mx-auto"
            style={{ color: 'rgba(255,255,255,0.95)' }}>
            Lộ trình đào tạo từng nhánh sản phẩm — từ kỹ thuật nền tảng đến tiêu chuẩn xuất khẩu,
            được đội ngũ sản xuất trực tiếp kiểm duyệt.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/register"
              className="text-sm font-bold px-8 py-3.5 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: GOLD, color: '#0D0D0D' }}>
              Bắt đầu học ngay
            </Link>
            <Link href="/login"
              className="text-sm font-medium px-8 py-3.5 rounded-lg transition-colors hover:bg-white/10"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.7)', color: 'white' }}>
              Tôi đã có tài khoản
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="max-w-7xl mx-auto px-6 -mt-8 relative z-10 w-full">
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="stat-box relative overflow-hidden rounded-2xl text-center py-7 px-2"
              style={{ backgroundColor: NAVY, border: `1px solid rgba(255,255,255,0.12)` }}>
              <div className="stat-shimmer" aria-hidden="true" />
              <p className="text-3xl sm:text-4xl font-bold relative" style={{ color: 'white' }}>
                {loading ? '—' : s.value}
              </p>
              <p className="text-xs tracking-wide relative font-semibold mt-1" style={{ color: GOLD }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Branch + Module ── */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 w-full">
        <p className="text-xs tracking-[0.2em] uppercase text-center mb-3 font-semibold" style={{ color: GOLD }}>
          Lộ trình theo nhánh
        </p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12" style={{ color: NAVY }}>
          Chọn nhánh đào tạo của bạn
        </h2>

        <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-10 lg:items-start">

          {/* Branch cards */}
          <div className="space-y-3 mb-8 lg:mb-0 lg:sticky lg:top-24">
            {loading ? [1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl h-28 animate-pulse" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }} />
            )) : branches.map(b => {
              const isActive = selectedBranch === b.id
              return (
                <button key={b.id} onClick={() => setSelectedBranch(b.id)}
                  className="w-full text-left rounded-2xl p-6 relative overflow-hidden transition-all"
                  style={{
                    backgroundColor: isActive ? NAVY : 'white',
                    border: isActive ? `2px solid ${NAVY}` : `1px solid ${BORDER}`,
                  }}>
                  <div className="absolute top-0 left-0 w-6 h-6 rounded-br-xl"
                    style={{ backgroundColor: isActive ? GOLD : NAVY }} />
                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <p className="text-[11px] tracking-[0.15em] uppercase mb-1.5 font-semibold"
                        style={{ color: isActive ? GOLD : NAVY }}>{b.name}</p>
                      <p className="text-2xl font-bold" style={{ color: isActive ? 'white' : NAVY }}>
                        {b.lessonCount} bài học
                      </p>
                      <p className="text-xs mt-1 font-medium" style={{ color: isActive ? MUTED : '#9A9590' }}>
                        {b.modules.length} module
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: isActive ? GOLD : CREAM }}>
                      <i className="ti ti-arrow-right text-sm" style={{ color: NAVY }} />
                    </div>
                  </div>
                  <div className="mt-4 h-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : CREAM }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: isActive ? '100%' : '35%', backgroundColor: isActive ? GOLD : NAVY, opacity: isActive ? 1 : 0.3 }} />
                  </div>
                </button>
              )
            })}
          </div>

          {/* Module detail */}
          <div>
            <div className="hidden lg:block">
              {!activeBranch ? (
                <div className="rounded-3xl p-16 text-center min-h-[420px] flex flex-col items-center justify-center"
                  style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
                  <p className="text-xl font-medium" style={{ color: MUTED }}>Chọn nhánh để xem lộ trình</p>
                </div>
              ) : (
                <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
                  <div className="px-8 py-6 flex items-center gap-4"
                    style={{ backgroundColor: NAVY, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                    <div>
                      <p className="text-xs tracking-[0.15em] uppercase mb-1 font-semibold" style={{ color: GOLD }}>
                        {activeBranch.name}
                      </p>
                      <p className="text-2xl font-bold" style={{ color: 'white' }}>
                        {activeBranch.modules.length} module · {activeBranch.lessonCount} bài học
                      </p>
                    </div>
                  </div>
                  <div className="p-8">
                    {activeBranch.modules.length === 0 ? (
                      <div className="py-12 text-center">
                        <p className="text-sm font-medium" style={{ color: MUTED }}>Chưa có module nào trong nhánh này.</p>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {activeBranch.modules.map((m, idx) => (
                          <div key={m.id} className="flex items-start gap-6">
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                                style={{ borderColor: NAVY, color: NAVY, backgroundColor: CREAM }}>
                                {m.order_index}
                              </div>
                              {idx < activeBranch.modules.length - 1 && (
                                <div className="w-0.5 flex-1 my-2"
                                  style={{ backgroundColor: BORDER, minHeight: '32px' }} />
                              )}
                            </div>
                            <div className="pt-1.5 pb-6 min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-4 mb-1">
                                <p className="text-base font-semibold" style={{ color: NAVY }}>{m.name}</p>
                                <span className="text-xs px-3 py-1 rounded-full flex-shrink-0 font-semibold"
                                  style={{ backgroundColor: CREAM, color: NAVY }}>
                                  {m.lessonCount} bài
                                </span>
                              </div>
                              {m.description && (
                                <p className="text-sm font-medium" style={{ color: MUTED }}>{m.description}</p>
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
                <div className="rounded-2xl p-5" style={{ backgroundColor: 'white', border: `2px solid ${NAVY}` }}>
                  {activeBranch.modules.length === 0 ? (
                    <p className="text-sm font-medium text-center py-2" style={{ color: MUTED }}>Chưa có module nào.</p>
                  ) : (
                    <div className="space-y-1">
                      {activeBranch.modules.map((m, idx) => (
                        <div key={m.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center flex-shrink-0">
                            <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                              style={{ borderColor: NAVY, color: NAVY }}>
                              {m.order_index}
                            </span>
                            {idx < activeBranch.modules.length - 1 && (
                              <div className="w-px mt-1" style={{ backgroundColor: BORDER, minHeight: '16px' }} />
                            )}
                          </div>
                          <div className="pt-0.5 pb-3 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: NAVY }}>{m.name}</p>
                            {m.description && (
                              <p className="text-xs mt-0.5 font-medium" style={{ color: MUTED }}>{m.description}</p>
                            )}
                            <p className="text-xs mt-0.5 font-medium" style={{ color: GOLD }}>
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
      <div className="relative overflow-hidden" style={{ backgroundColor: NAVY }}>
        <div className="absolute inset-0">
          <Image src="k-global-footer-banner.jpg" alt="" fill
            style={{ objectFit: 'cover', objectPosition: 'center 60%' }} />
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(70,104,152,0.88) 0%, rgba(70,104,152,0.92) 100%)' }} />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 py-20 text-center" style={{ zIndex: 1 }}>
          <p className="text-xs tracking-[0.2em] uppercase mb-6 font-semibold" style={{ color: GOLD }}>
            Lời nhắn từ ban lãnh đạo
          </p>
          <h3 className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-snug mb-6" style={{ color: 'white' }}>
            Bắt đầu lộ trình của bạn<br />tại K-Global ngay hôm nay.
          </h3>
          <p className="text-sm leading-relaxed max-w-xl mx-auto font-medium" style={{ color: MUTED }}>
            Bước đầu tiên không phải là làm thật nhanh — mà là hiểu thật đúng.
            Mỗi bài học trong hệ thống này được ban lãnh đạo trực tiếp biên soạn,
            đúc kết từ nhiều năm làm nghề và xuất khẩu thực chiến.
            Hãy học như thể bạn đang ngồi cùng người tạo ra nó.
          </p>
          <div className="mt-10">
            <Link href="/register"
              className="text-sm font-bold px-8 py-3.5 rounded-lg transition-opacity hover:opacity-90 inline-block"
              style={{ backgroundColor: GOLD, color: NAVY }}>
              Đăng ký ngay →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="text-center py-6" style={{ backgroundColor: '#0D0D0D', borderTop: '1px solid #222' }}>
        <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
          © {new Date().getFullYear()} K-Global — Học viên Đào tạo K-Global
        </p>
      </div>

      <style jsx>{`
        .stat-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(120deg, transparent 20%, rgba(201,168,76,0.12) 50%, transparent 80%);
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