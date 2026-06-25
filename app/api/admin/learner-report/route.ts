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
    .select('id, name, email, branch_id, position, onboarding_date, goal_after_onboarding, expectation, branch:branches(name, slug, color_bg, color_text)')
    .eq('role', 'learner')
    .order('created_at', { ascending: false })

  if (!learners || learners.length === 0) {
    return NextResponse.json({ learners: [], stats: { total: 0, avgPct: 0, badgeCount: 0, completing: 0 } })
  }

  const learnerIds = learners.map(l => l.id)

  const [
    { data: allLessons },
    { data: allProgress },
    { data: allBadges },
    { data: allModules },
    { data: allTimestamps },
    { data: allAttempts },
  ] = await Promise.all([
    supabaseAdmin.from('lessons').select('id, title, branch_id, order_index, module_id').eq('is_published', true).order('order_index'),
    supabaseAdmin.from('progress').select('user_id, lesson_id, tick1, tick2, completed_at').in('user_id', learnerIds),
    supabaseAdmin.from('badges').select('user_id, badge_type').in('user_id', learnerIds),
    supabaseAdmin.from('modules').select('id, name, order_index'),
    supabaseAdmin.from('lesson_timestamps').select('user_id, lesson_id, started_at, quiz_started_at, quiz_completed_at, practice_started_at, practice_submitted_at').in('user_id', learnerIds),
    supabaseAdmin.from('quiz_attempts').select('user_id, lesson_id, question_id, is_correct, is_first_attempt').in('user_id', learnerIds),
  ])

  const moduleMap: Record<number, { name: string; order: number }> = {}
  allModules?.forEach(m => { moduleMap[m.id] = { name: m.name, order: m.order_index } })

  const result = learners.map(learner => {
    const branchLessons = (allLessons || []).filter(l => l.branch_id === learner.branch_id)
    const total = branchLessons.length || 1

    const progList = (allProgress || []).filter(p => p.user_id === learner.id)
    const progMap: Record<number, { tick1: boolean; tick2: boolean; completed_at: string | null }> = {}
    progList.forEach(p => { progMap[p.lesson_id] = { tick1: p.tick1, tick2: p.tick2, completed_at: p.completed_at } })

    // Timestamps map theo lesson
    const tsMap: Record<number, any> = {}
    ;(allTimestamps || []).filter(t => t.user_id === learner.id).forEach(t => { tsMap[t.lesson_id] = t })

    // Quiz attempts map theo lesson
    const attMap: Record<number, { total: number; firstCorrect: number }> = {}
    ;(allAttempts || []).filter(a => a.user_id === learner.id).forEach(a => {
      if (!attMap[a.lesson_id]) attMap[a.lesson_id] = { total: 0, firstCorrect: 0 }
      if (a.is_first_attempt) {
        attMap[a.lesson_id].total += 1
        if (a.is_correct) attMap[a.lesson_id].firstCorrect += 1
      }
    })

    const tick1Count = progList.filter(p => p.tick1).length
    const tick2Count = progList.filter(p => p.tick2).length
    const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)
    const badges = (allBadges || []).filter(b => b.user_id === learner.id).map(b => b.badge_type)

    // Tính tỷ lệ đúng lần đầu toàn bộ
    const totalFirstAttempts = Object.values(attMap).reduce((s, v) => s + v.total, 0)
    const totalFirstCorrect = Object.values(attMap).reduce((s, v) => s + v.firstCorrect, 0)
    const firstAttemptRate = totalFirstAttempts > 0
      ? Math.round((totalFirstCorrect / totalFirstAttempts) * 100) : null

    function minutesBetween(a: string | null, b: string | null): number | null {
      if (!a || !b) return null
      const diff = new Date(b).getTime() - new Date(a).getTime()
      return diff > 0 ? Math.round(diff / 60000) : null
    }

    const lessonProgress = branchLessons.map(l => {
      const ts = tsMap[l.id]
      const att = attMap[l.id]
      const quizMins = ts ? minutesBetween(ts.quiz_started_at, ts.quiz_completed_at) : null
      const practiceMins = ts ? minutesBetween(ts.practice_started_at, ts.practice_submitted_at) : null
      const totalMins = ts ? minutesBetween(ts.started_at, ts.practice_submitted_at) : null

      return {
        lessonId: l.id,
        title: l.title,
        orderIndex: l.order_index,
        moduleId: l.module_id ?? null,
        moduleName: l.module_id ? (moduleMap[l.module_id]?.name || 'Không có module') : 'Không có module',
        moduleOrder: l.module_id ? (moduleMap[l.module_id]?.order ?? 999) : 999,
        tick1: progMap[l.id]?.tick1 ?? false,
        tick2: progMap[l.id]?.tick2 ?? false,
        completedAt: progMap[l.id]?.completed_at ?? null,
        quizMinutes: quizMins,
        practiceMinutes: practiceMins,
        totalMinutes: totalMins,
        firstAttemptRate: att && att.total > 0
          ? Math.round((att.firstCorrect / att.total) * 100) : null,
      }
    }).sort((a, b) => a.moduleOrder - b.moduleOrder || a.orderIndex - b.orderIndex)

    return {
      id: learner.id,
      name: learner.name,
      email: learner.email,
      branch: learner.branch,
      position: learner.position,
      onboardingDate: learner.onboarding_date,
      goal: learner.goal_after_onboarding,
      expectation: learner.expectation,
      pct,
      badges,
      firstAttemptRate,
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