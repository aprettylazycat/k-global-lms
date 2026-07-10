'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const NAVY = '#466898'
const GOLD = '#C9A84C'
const BLUE = '#0E62B1'
const CREAM = '#F5F0E8'
const BORDER = '#E2D8C8'
const MUTED = '#8AABC8'

type LeaderboardEntry = {
  userId: string
  name: string
  progressPct: number
  badgeCount: number
  perfectCount: number
  score: number
}

type BranchData = {
  branchId: string
  branchName: string
  branchSlug: string
  leaderboard: LeaderboardEntry[]
}

const RANK_STYLES = [
  { bg: '#FEF3C7', color: '#92400E', medal: '🥇' },
  { bg: '#F1F5F9', color: '#475569', medal: '🥈' },
  { bg: '#FED7AA', color: '#9A3412', medal: '🥉' },
]

export default function ScoreboardPage() {
  const router = useRouter()
  const [branches, setBranches] = useState<BranchData[]>([])
  const [activeBranch, setActiveBranch] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/scoreboard')
      const data = await res.json()
      const list: BranchData[] = data.branches || []
      setBranches(list)
      if (list.length > 0) setActiveBranch(list[0].branchId)
      setLoading(false)
    }
    load()
  }, [])

  const current = branches.find(b => b.branchId === activeBranch)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: CREAM }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: BORDER, borderTopColor: NAVY }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: CREAM }}>

      {/* Top bar */}
      <div className="px-5 py-3.5 sticky top-0 z-10" style={{ backgroundColor: NAVY, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 font-medium transition-opacity hover:opacity-70"
            style={{ color: 'white', fontSize: '14px' }}
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
          <h1 className="text-2xl lg:text-3xl font-bold mb-2" style={{ color: NAVY }}>
            Bảng Xếp Hạng Học Viên
          </h1>
          <p className="text-sm" style={{ color: '#8AABC8' }}>
            Xếp hạng dựa trên tiến độ học tập, huy hiệu đạt được và điểm số xuất sắc
          </p>
        </div>

        {/* Tabs chi nhánh */}
        {branches.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {branches.map(b => (
              <button
                key={b.branchId}
                onClick={() => setActiveBranch(b.branchId)}
                className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex-shrink-0"
                style={
                  activeBranch === b.branchId
                    ? { backgroundColor: NAVY, color: 'white' }
                    : { backgroundColor: 'white', color: NAVY, border: `1px solid ${BORDER}` }
                }
              >
                {b.branchName}
              </button>
            ))}
          </div>
        )}

        {/* Leaderboard list */}
        {!current || current.leaderboard.length === 0 ? (
          <div className="rounded-3xl p-10 text-center" style={{ backgroundColor: 'white', border: `1px solid ${BORDER}` }}>
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
                    backgroundColor: rankStyle ? rankStyle.bg : 'white',
                    border: `1px solid ${rankStyle ? 'transparent' : BORDER}`,
                  }}
                >
                  {/* Rank */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: rankStyle ? 'white' : CREAM,
                      color: rankStyle ? rankStyle.color : NAVY,
                    }}>
                    {rankStyle ? rankStyle.medal : idx + 1}
                  </div>

                  {/* Name + stats */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: rankStyle ? rankStyle.color : NAVY }}>
                      {entry.name}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : '#8AABC8' }}>
                        {entry.progressPct}% tiến độ
                      </span>
                      <span className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : '#8AABC8' }}>
                        🏅 {entry.badgeCount} badge
                      </span>
                      <span className="text-xs font-medium" style={{ color: rankStyle ? rankStyle.color : '#8AABC8' }}>
                        ⭐ {entry.perfectCount} perfect
                      </span>
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
