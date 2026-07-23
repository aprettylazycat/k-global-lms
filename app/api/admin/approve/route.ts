/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth-server'
import { checkBadges } from '@/lib/badges'

function extractStoragePath(fileUrl: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = fileUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(fileUrl.slice(idx + marker.length))
}

export async function POST(req: Request) {
  const check = await verifyAdmin(req)
  if (check.error) return check.error

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