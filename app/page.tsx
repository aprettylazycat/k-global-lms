'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import Mascot from '@/components/Mascot'

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

type TrackKey = 'chung' | 'nghe' | 'leader'

// ===== CẤU HÌNH CÁC KHỐI NGHỀ =====
// Thêm nhánh/khối mới chỉ cần thêm 1 dòng ở đây:
// - slugs: gộp 1 hay nhiều branch (theo slug trong bảng branches) thành 1 khối hiển thị
// - locked: true = hiện tab nhưng khoá (sắp ra mắt)
// Nhánh nào có trong bảng branches mà KHÔNG nằm trong config này sẽ tự xuất hiện
// thành 1 tab riêng (tự động, không cần sửa code).
const NGHE_GROUPS: { key: string; label: string; slugs: string[]; locked?: boolean }[] = [
  { key: 'toc', label: 'Tóc', slugs: ['hair'] },
  { key: 'theu', label: 'Thêu', slugs: ['k-embroidery', 'lotus-smock'] },
  { key: 'hanhchinh', label: 'Khối Hành chính', slugs: [], locked: true },
  { key: 'twc', label: 'Khối TWC', slugs: [], locked: true },
]

export default function Home() {
  const [aiModules, setAiModules] = useState<ModuleItem[]>([])
  const [aiLessons, setAiLessons] = useState<{ id: number; title: string; order_index: number }[]>([])
  const [ngheGroups, setNgheGroups] = useState<{ key: string; label: string; locked: boolean; modules: ModuleItem[] }[]>([])
  const [learnerCount, setLearnerCount] = useState(0)
  const [totalLessons, setTotalLessons] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTrack, setActiveTrack] = useState<TrackKey>('nghe')
  const [activeNghe, setActiveNghe] = useState<string>('toc')
  const [ngheMenuOpen, setNgheMenuOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [branchRes, moduleRes, learnersRes, lessonCountRes] = await Promise.all([
        supabase.from('branches').select('id, name, slug'),
        supabase.from('modules').select('id, name, description, order_index, branch_id, category').order('order_index'),
        fetch('/api/public/learner-count').then(r => r.json()).catch(() => ({ count: 0 })),
        supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('is_published', true),
      ])

      setLearnerCount(learnersRes.count ?? 0)
      setTotalLessons(lessonCountRes.count ?? 0)

      const branches = branchRes.data ?? []
      const modules = moduleRes.data ?? []


      // Đếm số bài mỗi module
      const withCount = async (list: any[]): Promise<ModuleItem[]> => Promise.all(
        list.map(async m => {
          const { count } = await supabase
            .from('lessons')
            .select('*', { count: 'exact', head: true })
            .eq('module_id', m.id)
            .eq('is_published', true)
          return { id: m.id, name: m.name, description: m.description, order_index: m.order_index, lessonCount: count ?? 0 }
        })
      )

      // Kiến thức chung = module category 'ai' (dùng chung mọi nhánh)
      const ai = modules.filter((m: any) => m.category === 'ai')

      // ===== Build các khối Nghề từ config + tự phát hiện nhánh mới =====
      const coveredSlugs = new Set(NGHE_GROUPS.flatMap(g => g.slugs))
      const autoGroups = branches
        .filter(b => !coveredSlugs.has(b.slug))
        .map(b => ({ key: b.slug, label: b.name, slugs: [b.slug], locked: false }))
      const allGroupDefs = [...NGHE_GROUPS, ...autoGroups]

      const builtGroups = await Promise.all(allGroupDefs.map(async g => {
        if (g.locked || g.slugs.length === 0) {
          return { key: g.key, label: g.label, locked: !!g.locked, modules: [] as ModuleItem[] }
        }
        const ids = branches.filter(b => g.slugs.includes(b.slug)).map(b => b.id)
        const raw = modules.filter((m: any) => ids.includes(m.branch_id) && m.category !== 'ai')
        // Khử trùng theo tên khi khối gộp nhiều nhánh học song song cùng lộ trình
        const seen = new Set<string>()
        const deduped = raw.filter((m: any) => {
          const key = m.name.trim().toLowerCase()
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        const withC = await withCount(deduped)
        return { key: g.key, label: g.label, locked: false, modules: withC.sort((a, b) => a.order_index - b.order_index) }
      }))

      const aiC = await withCount(ai)

      // Lấy danh sách bài học AI để hiển thị chi tiết (track chỉ có 1 module nên show hết bài bên trong)
      if (ai.length > 0) {
        const { data: aiLessonList } = await supabase
          .from('lessons')
          .select('id, title, order_index')
          .in('module_id', ai.map((m: any) => m.id))
          .eq('is_published', true)
          .order('order_index')
        setAiLessons(aiLessonList ?? [])
      }

      setAiModules(aiC.sort((a, b) => a.order_index - b.order_index))
      setNgheGroups(builtGroups)
      const firstOpen = builtGroups.find(g => !g.locked && g.modules.length > 0)
      if (firstOpen) setActiveNghe(firstOpen.key)
      setLoading(false)
    }
    load()
  }, [])

  const openNgheGroups = ngheGroups.filter(g => !g.locked)
  const ngheModuleCount = openNgheGroups.reduce((s, g) => s + g.modules.length, 0)
  const ngheActiveCount = openNgheGroups.filter(g => g.modules.length > 0).length
  const ngheSub = `${ngheActiveCount} nhánh nghề · ${ngheModuleCount} module`
  const activeNgheGroup = ngheGroups.find(g => g.key === activeNghe)
  const stats = [
    { value: totalLessons, label: 'bài học' },
    { value: ngheModuleCount + aiModules.length, label: 'module đào tạo' },
    { value: learnerCount, label: 'học viên' },
  ]

  const tracks: { key: TrackKey; icon: string; title: string; sub: string; ready: boolean }[] = [
    { key: 'chung', icon: 'ti-sparkles', title: 'Kiến thức chung', sub: loading ? '—' : `AI Education · ${aiModules.length} module`, ready: aiModules.length > 0 },
    { key: 'nghe', icon: 'ti-briefcase', title: 'Nghề', sub: loading ? '—' : ngheSub, ready: true },
    { key: 'leader', icon: 'ti-crown', title: 'Leader', sub: 'Sắp ra mắt', ready: false },
  ]

  const detailModules: ModuleItem[] =
    activeTrack === 'chung' ? aiModules
    : activeTrack === 'nghe' ? (activeNgheGroup?.modules ?? [])
    : []

  const detailTitle =
    activeTrack === 'chung' ? 'AI Education — Khóa học chung cho mọi nhân sự'
    : activeTrack === 'nghe' ? `Lộ trình ${activeNgheGroup?.label ?? 'Nghề'}`
    : 'Leader'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM, color: NAVY }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 relative" style={{ backgroundColor: NAVY, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <a href="https://k-global.com.vn/" target="_blank" rel="noreferrer">
              <Image src="/logo-kglobal.png" alt="K-Global" width={160} height={48}
                style={{ height: '42px', width: 'auto', filter: 'brightness(0) invert(1)' }} priority />
            </a>
            <div className="w-px h-5 hidden md:block" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <a href="tel:+84855555722"
              className="text-sm hidden md:block transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.85)' }}>
              +84 85 555 5722
            </a>
            <a href="https://www.facebook.com/kglobalvn/" target="_blank" rel="noreferrer"
              className="hidden md:block transition-opacity hover:opacity-70"
              style={{ color: 'rgba(255,255,255,0.85)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.91h-2.33V22c4.78-.79 8.44-4.94 8.44-9.94Z"/>
              </svg>
            </a>
          </div>
          <span className="text-xs font-semibold tracking-widest uppercase hidden lg:block"
            style={{ color: GOLD, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            Học viện Đào tạo K-Global
          </span>
          <div className="flex items-center gap-5">
            <Link href="/scoreboard"
              className="text-sm flex items-center gap-1.5 font-medium transition-opacity hover:opacity-70"
              style={{ color: GOLD }}>
              <i className="ti ti-trophy" style={{ fontSize: '14px' }} />
              <span className="hidden sm:inline">Xếp hạng</span>
            </Link>
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

      {/* ── 3 Track cards ── */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 w-full">
        <p className="text-xs tracking-[0.2em] uppercase text-center mb-3 font-semibold" style={{ color: GOLD }}>
          Lộ trình đào tạo
        </p>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12" style={{ color: NAVY }}>
          Ba trụ cột phát triển tại K-Global
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {tracks.map((t) => {
            const isActive = activeTrack === t.key
            const isLeader = t.key === 'leader'
            return (
              <button key={t.key}
                onClick={() => { if (t.ready) setActiveTrack(t.key) }}
                disabled={!t.ready}
                className={`track-card relative text-left rounded-3xl p-7 overflow-hidden transition-all duration-300 ${t.ready ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                style={{
                  backgroundColor: isActive ? NAVY : 'white',
                  border: isActive ? `2px solid ${GOLD}` : isLeader ? `1px dashed ${BORDER}` : `1px solid ${BORDER}`,
                  boxShadow: isActive ? '0 16px 40px rgba(70,104,152,0.35)' : 'none',
                  opacity: !t.ready && !isLeader ? 0.5 : isLeader ? 0.75 : 1,
                  transform: isActive ? 'translateY(-4px)' : 'none',
                }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 relative"
                  style={{ backgroundColor: isActive ? GOLD : CREAM }}>
                  <i className={`ti ${t.icon}`} style={{ fontSize: '24px', color: isActive ? NAVY : GOLD }} />
                </div>
                <p className="text-lg font-bold relative" style={{ color: isActive ? 'white' : NAVY }}>{t.title}</p>
                <p className="text-xs mt-1.5 font-medium relative" style={{ color: isActive ? 'rgba(255,255,255,0.75)' : MUTED }}>
                  {t.sub}
                </p>

                {isLeader && (
                  <span className="absolute top-4 right-4">
                    <i className="ti ti-lock" style={{ fontSize: '15px', color: MUTED }} />
                  </span>
                )}
                {isActive && (
                  <div className="mt-4 h-1 rounded-full overflow-hidden relative" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                    <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: GOLD }} />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Detail panel ── */}
        <div className="rounded-3xl overflow-hidden" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
          <div className="px-8 py-6 flex items-center justify-between gap-4 flex-wrap"
            style={{ backgroundColor: NAVY, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
            <div>
              <p className="text-xs tracking-[0.15em] uppercase mb-1 font-semibold" style={{ color: GOLD }}>
                {activeTrack === 'chung' ? 'Kiến thức chung' : activeTrack === 'nghe' ? 'Nghề' : 'Leader'}
              </p>
              <p className="text-xl sm:text-2xl font-bold" style={{ color: 'white' }}>{detailTitle}</p>
            </div>

            {activeTrack === 'nghe' && (
              <div className="relative">
                <button
                  onClick={() => setNgheMenuOpen(v => !v)}
                  className="text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2.5 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: GOLD, color: NAVY }}>
                  <span>{activeNgheGroup?.label ?? 'Chọn nhánh'}</span>
                  <i className={`ti ti-chevron-down transition-transform ${ngheMenuOpen ? 'rotate-180' : ''}`}
                    style={{ fontSize: '15px' }} />
                </button>

                {ngheMenuOpen && (
                  <>
                    {/* backdrop bấm ra ngoài để đóng */}
                    <div className="fixed inset-0 z-30" onClick={() => setNgheMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl overflow-hidden z-40 py-1.5"
                      style={{ backgroundColor: 'white', border: `1px solid ${BORDER}`, boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
                      {ngheGroups.map(g => (
                        <button key={g.key}
                          onClick={() => { if (!g.locked) { setActiveNghe(g.key); setNgheMenuOpen(false) } }}
                          disabled={g.locked}
                          className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between gap-3 transition-colors ${g.locked ? 'cursor-not-allowed' : 'hover:bg-black/5'}`}
                          style={{ color: g.locked ? '#B8B2A8' : NAVY, backgroundColor: activeNghe === g.key && !g.locked ? CREAM : 'transparent' }}>
                          <span className="flex items-center gap-2">
                            {g.locked && <i className="ti ti-lock" style={{ fontSize: '12px' }} />}
                            {g.label}
                          </span>
                          {!g.locked && g.modules.length > 0 && (
                            <span className="text-xs font-medium" style={{ color: MUTED }}>{g.modules.length} module</span>
                          )}
                          {g.locked && (
                            <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: '#B8B2A8' }}>Sắp ra mắt</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="p-8">
            {loading ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium" style={{ color: MUTED }}>Đang tải lộ trình…</p>
              </div>
            ) : activeTrack === 'chung' && aiLessons.length > 0 ? (
              <div>
                {aiModules[0]?.description && (
                  <p className="text-sm leading-relaxed font-medium mb-8 max-w-3xl" style={{ color: '#4A5568' }}>
                    {aiModules[0].description}
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiLessons.map((l, idx) => (
                    <div key={l.id} className="flex items-center gap-4 rounded-2xl p-4"
                      style={{ backgroundColor: CREAM, border: `1px solid ${BORDER}` }}>
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: NAVY, color: 'white' }}>
                        {idx + 1}
                      </div>
                      <p className="text-sm font-semibold min-w-0" style={{ color: NAVY }}>
                        {l.title.replace(/^BÀI\s*\d+:\s*/i, '')}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-medium mt-6 text-center" style={{ color: MUTED }}>
                  {aiLessons.length} bài học · Dành cho mọi nhân sự thuộc mọi nhánh
                </p>
              </div>
            ) : detailModules.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium" style={{ color: MUTED }}>
                  {activeTrack === 'leader' ? 'Nội dung dành cho Leader đang được biên soạn — sắp ra mắt.' : 'Chưa có module nào.'}
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {detailModules.map((m, idx) => (
                  <div key={m.id} className="flex items-start gap-6">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold"
                        style={{ borderColor: NAVY, color: NAVY, backgroundColor: CREAM }}>
                        {idx + 1}
                      </div>
                      {idx < detailModules.length - 1 && (
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
      </div>

      {/* ── Closing note ── */}
      <div className="relative overflow-hidden" style={{ backgroundColor: NAVY }}>
        <div className="absolute inset-0">
          <Image src="/k-global-footer-banner.jpg" alt="" fill
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
        .track-card:hover:not(:disabled) {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(70,104,152,0.2);
        }
        @media (prefers-reduced-motion: reduce) {
          .stat-shimmer { animation: none; }
          .track-card, .track-card:hover:not(:disabled) { transform: none; transition: none; }
        }
      `}</style>
      <Mascot />
    </div>
  )
}
