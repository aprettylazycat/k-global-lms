import { supabaseAdmin } from '@/lib/supabase-server'

/**
 * Badge riêng cho MODULE 4 (khoá nghề) của từng nhánh.
 * Module 1, 2, 3, 5 dùng chung badge cho mọi nhánh nên không cần khai báo.
 * Nhánh không có trong bảng này sẽ nhận badge tự động `module-{id}`.
 */
const MODULE4_BADGE: Record<string, string> = {
  'k-embroidery': 'k-smock-expert',
  'lotus-smock': 'k-smock-expert',
  'hair': 'k-hair-expert',
}

/** Badge dùng chung theo thứ tự module trong nhánh (order_index). */
const SHARED_BADGE_BY_ORDER: Record<number, { done: string; perfect?: string }> = {
  1: { done: 'k-starter' },
  2: { done: 'k-member', perfect: 'k-member-super' },
  3: { done: 'k-sales', perfect: 'k-super-sales' },
  5: { done: 'chien-binh' },
}

export async function checkBadges(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('branch_id').eq('id', userId).single()
  if (!profile?.branch_id) return

  const branchId = profile.branch_id

  const { data: branch } = await supabaseAdmin
    .from('branches').select('slug').eq('id', branchId).single()
  const slug = branch?.slug ?? ''

  // Lấy toàn bộ module của nhánh — không hardcode ID nữa
  const { data: branchModules } = await supabaseAdmin
    .from('modules')
    .select('id, order_index, category')
    .eq('branch_id', branchId)

  if (!branchModules || branchModules.length === 0) return

  // ── Helpers ──
  async function lessonIdsOf(moduleId: number): Promise<number[]> {
    const { data } = await supabaseAdmin
      .from('lessons').select('id')
      .eq('module_id', moduleId).eq('is_published', true)
    return (data ?? []).map(l => l.id)
  }

  async function isModuleDone(moduleId: number): Promise<boolean> {
    const ids = await lessonIdsOf(moduleId)
    if (ids.length === 0) return false
    const { data: prog } = await supabaseAdmin
      .from('progress').select('lesson_id, tick1, tick2')
      .eq('user_id', userId).in('lesson_id', ids)
    return ids.every(id => {
      const p = prog?.find(x => x.lesson_id === id)
      return p?.tick1 && p?.tick2
    })
  }

  async function isModulePerfect(moduleId: number): Promise<boolean> {
    const ids = await lessonIdsOf(moduleId)
    if (ids.length === 0) return false
    const { data: prog } = await supabaseAdmin
      .from('progress').select('lesson_id, perfect_score')
      .eq('user_id', userId).in('lesson_id', ids)
    return ids.every(id => prog?.find(x => x.lesson_id === id)?.perfect_score === true)
  }

  async function award(badgeType: string) {
    await supabaseAdmin.from('badges').upsert(
      { user_id: userId, badge_type: badgeType },
      { onConflict: 'user_id,badge_type' }
    )
  }

  // Module AI là khoá chung, có bảng xếp hạng riêng → không tính vào badge nghề
  const careerModules = branchModules.filter(m => m.category !== 'ai')
  const aiModules = branchModules.filter(m => m.category === 'ai')

  const namedModuleIds = new Set<number>()

  // ── Badge dùng chung: module 1, 2, 3, 5 ──
  for (const m of careerModules) {
    const rule = SHARED_BADGE_BY_ORDER[m.order_index]
    if (!rule) continue
    namedModuleIds.add(m.id)
    if (await isModuleDone(m.id)) {
      await award(rule.done)
      if (rule.perfect && await isModulePerfect(m.id)) await award(rule.perfect)
    }
  }

  // ── Badge module 4 — khoá nghề riêng của từng nhánh ──
  const module4 = careerModules.find(m => m.order_index === 4)
  if (module4) {
    const badgeName = MODULE4_BADGE[slug]
    if (badgeName) {
      namedModuleIds.add(module4.id)
      if (await isModuleDone(module4.id)) await award(badgeName)
    }
  }

  // ── Perfect Member: perfect toàn bộ module nghề có badge tên riêng ──
  if (namedModuleIds.size > 0) {
    const allPerfect = await Promise.all(
      Array.from(namedModuleIds).map(id => isModulePerfect(id))
    )
    if (allPerfect.length > 0 && allPerfect.every(Boolean)) await award('perfect-member')
  }

  // ── Badge tự động cho module còn lại (kể cả module AI) ──
  for (const m of [...careerModules, ...aiModules]) {
    if (namedModuleIds.has(m.id)) continue
    if (await isModuleDone(m.id)) await award(`module-${m.id}`)
  }
}