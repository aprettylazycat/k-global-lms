/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

async function verifyAdmin(req: Request) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'Thiếu token' }, { status: 401 }) }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: 'Token không hợp lệ' }, { status: 401 }) }
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Không có quyền admin' }, { status: 403 }) }
  return { user }
}

export async function GET(req: Request) {
  const check = await verifyAdmin(req)
  if (check.error) return check.error

  const { data: learners } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, branch_id, position, onboarding_date, mentor_name, goal_after_onboarding, expectation, branch:branches(name, slug, color_bg, color_text)')
    .eq('role', 'learner')
    .order('created_at', { ascending: false })

  if (!learners || learners.length === 0) {
    return NextResponse.json({ learners: [], stats: { total: 0, avgPct: 0, badgeCount: 0, completing: 0 } })
  }

  const learnerIds = learners.map(l => l.id)

  const { data: allLessons } = await supabaseAdmin
    .from('lessons')
    .select('id, title, branch_id, order_index, module_id')
    .eq('is_published', true)
    .order('order_index')

  const { data: allProgress } = await supabaseAdmin
    .from('progress')
    .select('user_id, lesson_id, tick1, tick2, completed_at')
    .in('user_id', learnerIds)

  const { data: allBadges } = await supabaseAdmin
    .from('badges')
    .select('user_id, badge_type')
    .in('user_id', learnerIds)

  const { data: allModules } = await supabaseAdmin
    .from('modules')
    .select('id, name, order_index')

  const moduleMap: Record<number, string> = {}
  allModules?.forEach(m => { moduleMap[m.id] = m.name })

  const result = learners.map(learner => {
    const branchLessons = (allLessons || []).filter(l => l.branch_id === learner.branch_id)
    const total = branchLessons.length || 1

    const progList = (allProgress || []).filter(p => p.user_id === learner.id)
    const progMap: Record<number, { tick1: boolean; tick2: boolean; completed_at: string | null }> = {}
    progList.forEach(p => { progMap[p.lesson_id] = { tick1: p.tick1, tick2: p.tick2, completed_at: p.completed_at } })

    const tick1Count = progList.filter(p => p.tick1).length
    const tick2Count = progList.filter(p => p.tick2).length
    const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)

    const badges = (allBadges || []).filter(b => b.user_id === learner.id).map(b => b.badge_type)

    const lessonProgress = branchLessons.map(l => ({
      lessonId: l.id,
      title: l.title,
      orderIndex: l.order_index,
      moduleName: l.module_id ? (moduleMap[l.module_id] || 'Không có module') : 'Không có module',
      tick1: progMap[l.id]?.tick1 ?? false,
      tick2: progMap[l.id]?.tick2 ?? false,
      completedAt: progMap[l.id]?.completed_at ?? null,
    }))

    return {
      id: learner.id,
      name: learner.name,
      email: learner.email,
      branch: learner.branch,
      position: learner.position,
      onboardingDate: learner.onboarding_date,
      mentorName: learner.mentor_name,
      goal: learner.goal_after_onboarding,
      expectation: learner.expectation,
      pct,
      badges,
      lessonProgress,
    }
  })

  const stats = {
    total: result.length,
    avgPct: result.length ? Math.round(result.reduce((s, l) => s + l.pct, 0) / result.length) : 0,
    badgeCount: (allBadges || []).length,
    completing: result.filter(l => l.pct === 100).length,
  }

  return NextResponse.json({ learners: result, stats })
}