/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { submissionId, reason } = await req.json()

  if (!submissionId) {
    return NextResponse.json({ error: 'Thiếu submissionId' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('submissions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reject_reason: reason || null,
    })
    .eq('id', submissionId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}