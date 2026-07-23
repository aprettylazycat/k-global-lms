/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { verifyUser } from '@/lib/auth-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (!check.ok) return check.error
  const userId = check.user.id

  const { moduleId, responses, skipped } = await req.json()

  if (!skipped && responses?.length > 0) {
    const rows = responses.map((r: any) => ({
      user_id: userId,
      module_id: moduleId,
      question_id: r.question_id,
      rating_value: r.rating_value ?? null,
      text_value: r.text_value ?? null,
    }))
    const { error } = await supabaseAdmin.from('module_feedback_responses').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { error: seenError } = await supabaseAdmin
    .from('module_feedback_seen')
    .upsert({ user_id: userId, module_id: moduleId }, { onConflict: 'user_id,module_id' })

  if (seenError) return NextResponse.json({ error: seenError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}