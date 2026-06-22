/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { lessons } = await req.json()

  // Map branch_slug → branch_id
  const { data: branches } = await supabaseAdmin
    .from('branches').select('id, slug')

  const branchMap: Record<string, string> = {}
  branches?.forEach((b: { id: string; slug: string }) => {
    branchMap[b.slug] = b.id
  })

  // Map "branch_id|module_name" → module_id (tránh trùng tên module giữa các nhánh)
  const { data: modules } = await supabaseAdmin
    .from('modules').select('id, name, branch_id')

  const moduleMap: Record<string, number> = {}
  modules?.forEach((m: { id: number; name: string; branch_id: string }) => {
    moduleMap[`${m.branch_id}|${m.name.trim()}`] = m.id
  })

  const toInsert = lessons.map((l: any) => {
    const branchId = branchMap[l.branch_slug]
    const moduleKey = branchId && l.module_name ? `${branchId}|${l.module_name.trim()}` : null
    const moduleId = moduleKey ? (moduleMap[moduleKey] ?? null) : null

    return {
      title: l.title,
      branch_id: branchId,
      module_id: moduleId,
      order_index: l.order_index,
      youtube_id: l.youtube_id || null,
      intro_text: l.intro_text || null,
      practice_prompt: l.practice_prompt || null,
      questions: l.questions || [],
      is_published: false
    }
  })

  const { error } = await supabaseAdmin.from('lessons').insert(toInsert)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ count: toInsert.length })
}