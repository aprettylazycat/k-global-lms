/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(fileUrl.slice(idx + marker.length))
}

export async function POST(req: Request) {
  const { submissionId, userId, lessonId, perfectScore } = await req.json()

  const { data: submissionRow } = await supabaseAdmin
    .from('submissions')
    .select('file_url')
    .eq('id', submissionId)
    .single()

  await supabaseAdmin
    .from('submissions')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', submissionId)

  // Xóa ảnh khỏi Storage để tiết kiệm dung lượng — bài đã duyệt không cần giữ file gốc
  if (submissionRow?.file_url) {
    const path = extractStoragePath(submissionRow.file_url, 'submissions')
    if (path) {
      await supabaseAdmin.storage.from('submissions').remove([path])
      await supabaseAdmin.from('submissions').update({ file_url: '' }).eq('id', submissionId)
    }
  }

  await supabaseAdmin
    .from('progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      tick2: true,
      completed_at: new Date().toISOString(),
      ...(perfectScore ? { perfect_score: true } : {}),
    }, { onConflict: 'user_id,lesson_id' })

  await checkBadges(userId)

  return NextResponse.json({ success: true })
}

async function checkBadges(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('branch_id').eq('id', userId).single()
  if (!profile?.branch_id) return

  const branchId = profile.branch_id

  // Lấy branch slug để xác định mapping module
  const { data: branch } = await supabaseAdmin
    .from('branches').select('slug').eq('id', branchId).single()
  const slug = branch?.slug

  // Mapping module_id theo branch
  const moduleMap: Record<string, Record<string, number>> = {
    'k-embroidery': { intro: 3, mindset: 6, sales: 9, smock: 10, warrior: 13 },
    'lotus-smock':  { intro: 4, mindset: 7, sales: 11, smock: 12, warrior: 14 },
  }
  const modules = moduleMap[slug ?? '']
  if (!modules) return // hair/office tính sau

  // Helper: kiểm tra user đã hoàn thành tick1+tick2 hết tất cả bài trong module chưa
  async function isModuleDone(moduleId: number): Promise<boolean> {
    const { data: lessons } = await supabaseAdmin
      .from('lessons').select('id')
      .eq('module_id', moduleId).eq('is_published', true)
    if (!lessons || lessons.length === 0) return false
    const ids = lessons.map(l => l.id)
    const { data: prog } = await supabaseAdmin
      .from('progress').select('lesson_id, tick1, tick2')
      .eq('user_id', userId).in('lesson_id', ids)
    return ids.every(id => {
      const p = prog?.find(p => p.lesson_id === id)
      return p?.tick1 && p?.tick2
    })
  }

  // Helper: kiểm tra perfect score hết bài trong module
  async function isModulePerfect(moduleId: number): Promise<boolean> {
    const { data: lessons } = await supabaseAdmin
      .from('lessons').select('id')
      .eq('module_id', moduleId).eq('is_published', true)
    if (!lessons || lessons.length === 0) return false
    const ids = lessons.map(l => l.id)
    const { data: prog } = await supabaseAdmin
      .from('progress').select('lesson_id, perfect_score')
      .eq('user_id', userId).in('lesson_id', ids)
    return ids.every(id => {
      const p = prog?.find(p => p.lesson_id === id)
      return p?.perfect_score === true
    })
  }

  async function award(badgeType: string) {
    await supabaseAdmin.from('badges').upsert(
      { user_id: userId, badge_type: badgeType },
      { onConflict: 'user_id,badge_type' }
    )
  }

  // Check từng badge
  if (await isModuleDone(modules.intro)) await award('k-starter')
  if (await isModuleDone(modules.mindset)) {
    await award('k-member')
    if (await isModulePerfect(modules.mindset)) await award('k-member-super')
  }
  if (await isModuleDone(modules.sales)) {
    await award('k-sales')
    if (await isModulePerfect(modules.sales)) await award('k-super-sales')
  }
  if (await isModuleDone(modules.smock)) await award('k-smock-expert')
  if (await isModuleDone(modules.warrior)) await award('chien-binh')

  // Perfect Member — tất cả module đều perfect
  const allPerfect = await Promise.all(
    Object.values(modules).map(id => isModulePerfect(id))
  )
  if (allPerfect.every(Boolean)) await award('perfect-member')

  // Badge tự động cho MỌI module khác không nằm trong moduleMap cố định ở trên —
  // để không phải sửa code mỗi lần thêm module mới (vd "Khóa học AI K-Global")
  const knownModuleIds = new Set(Object.values(modules))
  const { data: allBranchModules } = await supabaseAdmin
    .from('modules').select('id').eq('branch_id', branchId)
  for (const m of allBranchModules ?? []) {
    if (knownModuleIds.has(m.id)) continue // đã xử lý ở trên rồi, khỏi trùng
    if (await isModuleDone(m.id)) await award(`module-${m.id}`)
  }
}