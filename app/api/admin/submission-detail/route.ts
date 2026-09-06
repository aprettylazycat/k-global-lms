/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifyAdmin, canReviewSubmission } from '@/lib/auth-server'
import { getMcqResults } from '@/lib/get-mcq-results'

// Trả về đầy đủ thông tin 1 bài nộp (kèm học viên, bài học, người chấm, nhánh)
// để trang /admin/print-submission/[id] render ra bản in / xuất PDF.
export async function GET(req: Request) {
  const check = await verifyAdmin(req)
  if (!check.ok) return check.error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Thiếu submissionId' }, { status: 400 })
  }

  const { data: sub, error } = await supabaseAdmin
    .from('submissions')
    .select(`
      id, user_id, lesson_id, answer_text, file_url, submitted_at, status,
      reviewed_at, reviewed_by, reject_reason, attempt_number,
      user:profiles(name, email, branch_id, position),
      lesson:lessons(title, practice_prompt, branch_id, module_id)
    `)
    .eq('id', id)
    .single()

  if (error || !sub) {
    return NextResponse.json({ error: 'Không tìm thấy bài nộp' }, { status: 404 })
  }

  // Bài thuộc nhánh Leader — chỉ super_admin mới được xem/xuất (đồng bộ quyền với duyệt/từ chối)
  const allowed = await canReviewSubmission(check.user.id, String(sub.lesson_id))
  if (!allowed) {
    return NextResponse.json({ error: 'Bài học nhánh Leader chỉ super admin mới được xem' }, { status: 403 })
  }

  const userRow: any = Array.isArray(sub.user) ? sub.user[0] : sub.user
  const lessonRow: any = Array.isArray(sub.lesson) ? sub.lesson[0] : sub.lesson

  const [{ data: branch }, { data: reviewer }, { data: progress }, { data: moduleRow }, mcqResults] = await Promise.all([
    userRow?.branch_id
      ? supabaseAdmin.from('branches').select('name, slug').eq('id', userRow.branch_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sub.reviewed_by
      ? supabaseAdmin.from('profiles').select('name, email').eq('id', sub.reviewed_by).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from('progress').select('perfect_score, completed_at')
      .eq('user_id', sub.user_id).eq('lesson_id', sub.lesson_id).maybeSingle(),
    lessonRow?.module_id
      ? supabaseAdmin.from('modules').select('name').eq('id', lessonRow.module_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getMcqResults(sub.user_id, sub.lesson_id),
  ])

  return NextResponse.json({
    submission: {
      id: sub.id,
      status: sub.status,
      attemptNumber: sub.attempt_number,
      answerText: sub.answer_text,
      fileUrl: sub.file_url,
      submittedAt: sub.submitted_at,
      reviewedAt: sub.reviewed_at,
      rejectReason: sub.reject_reason,
      perfectScore: !!progress?.perfect_score,
      learner: {
        name: userRow?.name ?? null,
        email: userRow?.email ?? null,
        position: userRow?.position ?? null,
        branchName: branch?.name ?? null,
      },
      lesson: {
        title: lessonRow?.title ?? null,
        practicePrompt: lessonRow?.practice_prompt ?? null,
        moduleName: moduleRow?.name ?? null,
      },
      reviewer: reviewer ? { name: reviewer.name, email: reviewer.email } : null,
      mcqResults,
    },
  })
}