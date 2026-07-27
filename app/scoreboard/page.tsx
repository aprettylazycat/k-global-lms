'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SPACE, PANEL, CHIP, TEXT, MUTED, FAINT, GOLD, GOLD_SOFT, NAVY, BLUE, BORDER, BORDER_STRONG, CREAM, OK, OK_BG, WARN, WARN_BG, WARN_BORDER } from '@/lib/theme'

const DARK_ON_GOLD = '#0A0E1A'

type LeaderboardEntry = {
  userId: string
  name: string
  progressPct: number
  badgeCount: number
  perfectCount: number
  score: number
  daysToComplete: number | null
  daysSinceActive: number | null
}

type BranchData = {
  branchId: string
  branchName: string
  branchSlug: string
  leaderboard: LeaderboardEntry[]
}

type AiEntry = {
  userId: string
  name: string
  branchName: string
  lessonsDone: number
  totalLessons: number
  progressPct: number
  perfectCount: number
  aiBadgeCount: number
  score: number
  daysToComplete: number | null
  daysSinceActive: number | null
}

type AiData = {
  moduleName: string
  totalLessons: number
  leaderboard: AiEntry[]
}

const AI_TAB = '__ai__'
function formatDaysAgo(days: number | null): string | null {
  if (days === null) return null
  if (days === 0) return 'Hôm nay'
  if (days === 1) return 'Hôm qua'
  return `${days} ngày trước`
}

const RANK_STYLES = [
  { bg: WARN_BG, color: WARN, medal: '🥇' },
  { bg: CHIP, color: MUTED, medal: '🥈' },
  { bg: WARN_BORDER, color: WARN, medal: '🥉' },
]

export default function ScoreboardPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<BranchData[]>([])
  const [ai, setAi] = useState<AiData | null>(null)
  const [activeBranch, setActiveBranch] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/scoreboard')
      const data = await res.json()
      const list: BranchData[] = data.branches || []
      setBranches(list)
      setAi(data.ai ?? null)
      // Mặc định mở tab AI vì đây là khóa chung mọi nhân sự
      if (data.ai && data.ai.leaderboard?.length > 0) setActiveBranch(AI_TAB)
      else if (list.length > 0) setActiveBranch(list[0].branchId)
      setLoading(false)
    }
    load()
  }, [])

  const current = branches.find(b => b.branchId === activeBranch)
  const showAi = activeBranch === AI_TAB

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: SPACE, color: TEXT }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BORDER, borderTopColor: GOLD }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: SPACE, color: TEXT }}>

      {/* Top bar */}
      <div className="px-5 py-3.5 sticky top-0 z-10" style={{ backgroundColor: 'rgba(7,11,21,0.88)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 font-medium transition-opacity hover:opacity-70"
            style={{ color: TEXT, fontSize: '14px' }}
          >
            <i className="ti ti-arrow-left" style={{ fontSize: '14px' }} />
            Trang chủ
          </button>
          <p className="text-sm font-semibold" style={{ color: GOLD }}>🏆 Bảng Xếp Hạng</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold mb-2" style={{ color: TEXT }}>
            Bảng Xếp Hạng Học Viên
          </h1>
          <p className="text-sm" style={{ color: MUTED }}>
            Xếp hạng dựa trên tiến độ học tập, huy hiệu đạt được và điểm số xuất sắc
          </p>
        </div>

        {/* Tabs: AI (chung) + từng nhánh */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {ai && (
            <button
              onClick={() => setActiveBranch(AI_TAB)}
              className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5"
              style={
                showAi
                  ? { backgroundColor: GOLD, color: DARK_ON_GOLD }
                  : { backgroundColor: PANEL, color: MUTED, border: `1px solid ${BORDER}` }
              }
            >
              <i className="ti ti-sparkles" style={{ fontSize: '14px' }} />
              Kiến thức chung
            </button>
          )}
          {branches.map(b => (
            <button
              key={b.branchId}
              onClick={() => setActiveBranch(b.branchId)}
              className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0"
              style={
                activeBranch === b.branchId
                  ? { backgroundColor: GOLD, color: DARK_ON_GOLD }
                  : { backgroundColor: PANEL, color: MUTED, border: `1px solid ${BORDER}` }
              }
            >
              {b.branchName}
            </button>
          ))}
        </div>

        {/* ══ Bảng xếp hạng MODULE AI ══ */}
        {showAi ? (
          !ai || ai.leaderboard.length === 0 ? (
            <div className="rounded-3xl p-10 text-center" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
              <p className="text-sm" style={{ color: MUTED }}>Chưa có dữ liệu xếp hạng cho khóa Kiến thức chung.</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl px-5 py-4 mb-4 flex items-center justify-between gap-4 flex-wrap"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,201,77,0.10) 0%, rgba(70,104,152,0.22) 100%)',
                  border: `1px solid ${BORDER_STRONG}`,
                }}>
                <div>
                  <p className="text-xs tracking-[0.15em] uppercase font-semibold mb-0.5" style={{ color: GOLD }}>
                    Khóa chung cho mọi nhân sự
                  </p>
                  <p className="text-lg font-bold" style={{ color: TEXT }}>{ai.moduleName}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ color: TEXT }}>{ai.totalLessons}</p>
                    <p className="text-xs font-medium" style={{ color: MUTED }}>bài học</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ color: GOLD }}>
                      {ai.leaderboard.filter(e => e.progressPct === 100).length}
                    </p>
                    <p className="text-xs font-medium" style={{ color: MUTED }}>đã hoàn thành</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {ai.leaderboard.map((entry, idx) => {
                  const rankStyle = entry.score > 0 ? RANK_STYLES[idx] : undefined
                  return (
                    <div key={entry.userId}
                      className="rounded-2xl p-4 flex items-center gap-4"
                      style={{
                        backgroundColor: rankStyle ? rankStyle.bg : PANEL,
                        border: `1px solid ${rankStyle ? WARN_BORDER : BORDER}`,
                        opacity: entry.lessonsDone === 0 ? 0.55 : 1,
                      }}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{
                          backgroundColor: CHIP,
                          color: rankStyle ? rankStyle.color : MUTED,
                          border: `1px solid ${BORDER}`,
                        }}>
                        {rankStyle ? rankStyle.medal : idx + 1}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate" style={{ color: TEXT }}>{entry.name}</p>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: CHIP, color: MUTED, border: `1px solid ${BORDER}` }}>
                            {entry.branchName}
                          </span>
                          <span className="text-xs font-medium" style={{ color: MUTED }}>
                            {entry.lessonsDone}/{entry.totalLessons} bài
                          </span>
                          {entry.perfectCount > 0 && (
                            <span className="text-xs font-medium" style={{ color: GOLD }}>
                              ⭐ {entry.perfectCount} perfect
                            </span>
                          )}
                          {entry.aiBadgeCount > 0 && (
                            <span className="text-xs font-medium" style={{ color: GOLD }}>
                              🏅 badge AI
                            </span>
                          )}
                          {entry.daysToComplete !== null && (
                            <span className="text-xs font-medium" style={{ color: OK }}>
                              ⚡ Hoàn thành trong {entry.daysToComplete} ngày
                            </span>
                          )}
                          {entry.daysSinceActive !== null && entry.progressPct < 100 && (
                            <span className="text-xs font-medium" style={{ color: MUTED }}>
                              🕒 Học lần cuối: {formatDaysAgo(entry.daysSinceActive)}
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden mt-2" style={{ backgroundColor: CHIP }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${entry.progressPct}%`, backgroundColor: entry.progressPct === 100 ? OK : GOLD }} />
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold" style={{ color: rankStyle ? rankStyle.color : GOLD }}>
                          {entry.score}
                        </p>
                        <p className="text-xs font-medium" style={{ color: MUTED }}>điểm</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )
        ) : /* ══ Bảng xếp hạng theo nhánh (như cũ) ══ */
        !current || current.leaderboard.length === 0 ? (
          <div className="rounded-3xl p-10 text-center" style={{ backgroundColor: PANEL, border: `1px solid ${BORDER}` }}>
            <p className="text-sm" style={{ color: MUTED }}>Chưa có dữ liệu xếp hạng cho chi nhánh này.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {current.leaderboard.map((entry, idx) => {
              const rankStyle = RANK_STYLES[idx]
              return (
                <div key={entry.userId}
                  className="rounded-2xl p-4 flex items-center gap-4"
                  style={{
                    backgroundColor: rankStyle ? rankStyle.bg : PANEL,
                    border: `1px solid ${rankStyle ? WARN_BORDER : BORDER}`,
                  }}
                >
                  {/* Rank */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: CHIP,
                      color: rankStyle ? rankStyle.color : MUTED,
                    }}>
                    {rankStyle ? rankStyle.medal : idx + 1}
                  </div>

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: TEXT }}>
                      {entry.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : MUTED }}>
                        {entry.progressPct}% tiến độ
                      </span>
                      <span className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : MUTED }}>
                        🏅 {entry.badgeCount} badge
                      </span>
                      <span className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : MUTED }}>
                        ⭐ {entry.perfectCount} perfect
                      </span>
                      {entry.daysToComplete !== null && (
                        <span className="text-xs font-medium" style={{ color: OK }}>
                          ⚡ Hoàn thành trong {entry.daysToComplete} ngày
                        </span>
                      )}
                      {entry.daysSinceActive !== null && entry.progressPct < 100 && (
                        <span className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : MUTED, opacity: 0.75 }}>
                          🕒 {formatDaysAgo(entry.daysSinceActive)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold" style={{ color: rankStyle ? rankStyle.color : BLUE }}>
                      {entry.score}
                    </p>
                    <p className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : MUTED, opacity: 0.7 }}>
                      điểm
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
