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
  const { submissionId, reason } = await req.json()

  if (!submissionId) {
    return NextResponse.json({ error: 'Thiếu submissionId' }, { status: 400 })
  }

  const { data: submissionRow } = await supabaseAdmin
    .from('submissions')
    .select('file_url')
    .eq('id', submissionId)
    .single()

  const { error } = await supabaseAdmin
    .from('submissions')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reject_reason: reason || null })
    .eq('id', submissionId)

  if (submissionRow?.file_url) {
    const path = extractStoragePath(submissionRow.file_url, 'submissions')
    if (path) {
      await supabaseAdmin.storage.from('submissions').remove([path])
      await supabaseAdmin.from('submissions').update({ file_url: '' }).eq('id', submissionId)
    }
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}