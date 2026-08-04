/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifyAdmin, canReviewSubmission } from '@/lib/auth-server'

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(fileUrl.slice(idx + marker.length))
}

export async function POST(req: Request) {
  const check = await verifyAdmin(req)
  if (!check.ok) return check.error

  const { submissionId, reason } = await req.json()

  if (!submissionId) {
    return NextResponse.json({ error: 'Thiếu submissionId' }, { status: 400 })
  }

  const { data: submissionRow } = await supabaseAdmin
    .from('submissions')
    .select('file_url, user_id, lesson_id')
    .eq('id', submissionId)
    .single()

  if (submissionRow?.lesson_id) {
    const allowed = await canReviewSubmission(check.user.id, submissionRow.lesson_id)
    if (!allowed) {
      return NextResponse.json({ error: 'Bài học nhánh Leader chỉ super admin mới được chấm' }, { status: 403 })
    }
  }

  const { error } = await supabaseAdmin
    .from('submissions')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reject_reason: reason || null, reviewed_by: check.user.id })
    .eq('id', submissionId)

  // Từ chối xong -> tự cấp lại 3 lượt nộp mới cho học viên (không xoá lịch sử cũ, chỉ đặt mốc "tính lại từ đây")
  if (submissionRow?.user_id && submissionRow?.lesson_id) {
    await supabaseAdmin
      .from('progress')
      .upsert(
        { user_id: submissionRow.user_id, lesson_id: submissionRow.lesson_id, attempt_reset_at: new Date().toISOString() },
        { onConflict: 'user_id,lesson_id' }
      )
  }

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
