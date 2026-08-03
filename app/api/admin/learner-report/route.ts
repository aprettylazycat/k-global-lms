/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth-server'

export async function GET(req: Request) {
  const check = await verifyAdmin(req)
  if (!check.ok) return check.error

  const { data: learners } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, branch_id, position, onboarding_date, goal_after_onboarding, expectation, branch:branches(name, slug, color_bg, color_text)')
    .neq('role', 'super_admin')
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
    supabaseAdmin.from('progress').select('user_id, lesson_id, tick1, tick2, completed_at, perfect_score').in('user_id', learnerIds),
    supabaseAdmin.from('badges').select('user_id, badge_type').in('user_id', learnerIds),
    supabaseAdmin.from('modules').select('id, name, order_index, category'),
    supabaseAdmin.from('lesson_timestamps').select('user_id, lesson_id, started_at, quiz_started_at, quiz_completed_at, practice_started_at, practice_submitted_at').in('user_id', learnerIds),
    supabaseAdmin.from('quiz_attempts').select('user_id, lesson_id, question_id, is_correct, is_first_attempt, selected_option, extra_data').in('user_id', learnerIds),
  ])

  const moduleMap: Record<number, { name: string; order: number; category: string | null }> = {}
  allModules?.forEach(m => { moduleMap[m.id] = { name: m.name, order: m.order_index, category: (m as any).category ?? null } })

  // Bài thuộc khoá AI (Kiến thức chung) — dùng chung mọi nhánh, branch_id của bài
  // không phản ánh nhánh nào truy cập được nó nên phải xác định riêng qua module.category
  const aiLessonIds = new Set(
    (allLessons || [])
      .filter(l => l.module_id && moduleMap[l.module_id]?.category === 'ai')
      .map(l => l.id)
  )

  function minutesBetween(a: string | null, b: string | null): number | null {
    if (!a || !b) return null
    const diff = new Date(b).getTime() - new Date(a).getTime()
    return diff > 0 ? Math.round(diff / 60000) : null
  }

  const result = learners.map(learner => {
    // Bài của nhánh = bài thuộc branch_id của học viên + bài AI dùng chung (mọi nhánh đều học được).
    // Nhánh chưa có nội dung riêng (TWC, Hành chính, AI Video...) vẫn tính % đúng nhờ phần AI này.
    const branchLessons = (allLessons || []).filter(
      l => l.branch_id === learner.branch_id || aiLessonIds.has(l.id)
    )
    const total = branchLessons.length || 1
    const branchLessonIds = new Set(branchLessons.map(l => l.id))

    // Chỉ tính tiến độ của bài THUỘC NHÁNH HIỆN TẠI — tránh dính tiến độ cũ
    // để lại từ trước khi học viên đổi nhánh (hoặc dữ liệu test/nhánh đã xoá)
    const progList = (allProgress || []).filter(
      p => p.user_id === learner.id && branchLessonIds.has(p.lesson_id)
    )
    const progMap: Record<number, { tick1: boolean; tick2: boolean; completed_at: string | null; perfect_score: boolean }> = {}
    progList.forEach(p => { progMap[p.lesson_id] = { tick1: p.tick1, tick2: p.tick2, completed_at: p.completed_at, perfect_score: p.perfect_score ?? false } })

    // Timestamps map theo lesson
    const tsMap: Record<number, any> = {}
    ;(allTimestamps || []).filter(t => t.user_id === learner.id).forEach(t => { tsMap[t.lesson_id] = t })

    // MCQ attempts map theo lesson (bỏ TF)
    const attMap: Record<number, { total: number; firstCorrect: number }> = {}
    ;(allAttempts || [])
      .filter(a => a.user_id === learner.id && branchLessonIds.has(a.lesson_id) && !String(a.question_id).startsWith('tf_group_'))
      .forEach(a => {
        if (!attMap[a.lesson_id]) attMap[a.lesson_id] = { total: 0, firstCorrect: 0 }
        if (a.is_first_attempt) {
          attMap[a.lesson_id].total += 1
          if (a.is_correct) attMap[a.lesson_id].firstCorrect += 1
        }
      })

    // TF attempts map theo lesson
    const tfMap: Record<number, { correct: number; total: number }> = {}
    ;(allAttempts || [])
      .filter(a => a.user_id === learner.id && branchLessonIds.has(a.lesson_id) && String(a.question_id).startsWith('tf_group_'))
      .forEach(a => {
        if (!tfMap[a.lesson_id]) tfMap[a.lesson_id] = { correct: 0, total: 0 }
        if (a.extra_data) {
          try {
            const d = JSON.parse(a.extra_data)
            tfMap[a.lesson_id].correct += d.correct || 0
            tfMap[a.lesson_id].total += d.total || 0
          } catch {}
        }
      })

    const tick1Count = progList.filter(p => p.tick1).length
    const tick2Count = progList.filter(p => p.tick2).length
    const pct = Math.round(((tick1Count / total) + (tick2Count / total)) / 2 * 100)
    const badges = (allBadges || []).filter(b => b.user_id === learner.id).map(b => b.badge_type)

    // Tỷ lệ đúng lần đầu toàn bộ (chỉ MCQ)
    const totalFirstAttempts = Object.values(attMap).reduce((s, v) => s + v.total, 0)
    const totalFirstCorrect = Object.values(attMap).reduce((s, v) => s + v.firstCorrect, 0)
    const firstAttemptRate = totalFirstAttempts > 0
      ? Math.round((totalFirstCorrect / totalFirstAttempts) * 100) : null

    const lessonProgress = branchLessons.map(l => {
      const ts = tsMap[l.id]
      const att = attMap[l.id]
      const tf = tfMap[l.id]
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
        perfectScore: progMap[l.id]?.perfect_score ?? false,
        startedAt: ts?.started_at ?? null,
        completedAt: progMap[l.id]?.completed_at ?? null,
        quizMinutes: quizMins,
        practiceMinutes: practiceMins,
        totalMinutes: totalMins,
        firstAttemptRate: att && att.total > 0
          ? Math.round((att.firstCorrect / att.total) * 100) : null,
        tfSummary: tf && tf.total > 0 ? `${tf.correct}/${tf.total} đúng` : null,
      }
    }).sort((a, b) => a.moduleOrder - b.moduleOrder || a.orderIndex - b.orderIndex)

    const totalMinutesAll = Object.values(tsMap).reduce((s, ts) => {
      const m = minutesBetween(ts.started_at, ts.practice_submitted_at)
      return s + (m ?? 0)
    }, 0)
    const perfectScoreCount = lessonProgress.filter(l => l.perfectScore).length

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
      totalMinutesAll,
      perfectScoreCount,
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
