import { supabaseAdmin } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { verifySuperAdmin } from '@/lib/auth-server'
import { getMcqResults } from '@/lib/get-mcq-results'

// Chỉ super_admin mới gọi được — trả về danh sách toàn bộ bài đã chấm kèm đúng
// admin nào đã duyệt/từ chối (dựa vào cột submissions.reviewed_by).
export async function GET(req: Request) {
  const check = await verifySuperAdmin(req)
  if (!check.ok) return check.error

  const { data: submissions, error } = await supabaseAdmin
    .from('submissions')
    .select('id, status, attempt_number, reviewed_at, reject_reason, user_id, lesson_id, reviewed_by, answer_text, file_url, submitted_at')
    .in('status', ['approved', 'rejected'])
    .order('reviewed_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = submissions || []
  const learnerIds = [...new Set(rows.map(r => r.user_id))]
  const graderIds = [...new Set(rows.map(r => r.reviewed_by).filter(Boolean))]
  const lessonIds = [...new Set(rows.map(r => r.lesson_id))]

  const [{ data: learners }, { data: graders }, { data: lessons }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, name, email').in('id', learnerIds.length ? learnerIds : ['-']),
    supabaseAdmin.from('profiles').select('id, name, email').in('id', graderIds.length ? graderIds : ['-']),
    supabaseAdmin.from('lessons').select('id, title').in('id', lessonIds.length ? lessonIds : [-1]),
  ])

  const learnerMap = Object.fromEntries((learners || []).map(l => [l.id, l]))
  const graderMap = Object.fromEntries((graders || []).map(g => [g.id, g]))
  const lessonMap = Object.fromEntries((lessons || []).map(l => [l.id, l]))

  // Dedupe theo (user_id, lesson_id) — nhiều dòng submissions có thể trùng cặp này
  // (VD bị từ chối rồi nộp lại được duyệt), MCQ kết quả là như nhau nên chỉ cần lấy 1 lần.
  const uniquePairs = [...new Map(rows.map(r => [`${r.user_id}::${r.lesson_id}`, { userId: r.user_id, lessonId: r.lesson_id }])).values()]
  const mcqEntries = await Promise.all(
    uniquePairs.map(async p => [`${p.userId}::${p.lessonId}`, await getMcqResults(p.userId, p.lessonId)] as const)
  )
  const mcqMap = Object.fromEntries(mcqEntries)

  const result = rows.map(r => ({
    submissionId: r.id,
    status: r.status,
    attemptNumber: r.attempt_number,
    reviewedAt: r.reviewed_at,
    submittedAt: r.submitted_at,
    rejectReason: r.reject_reason,
    answerText: r.answer_text,
    fileUrl: r.file_url,
    learnerName: learnerMap[r.user_id]?.name ?? '—',
    learnerEmail: learnerMap[r.user_id]?.email ?? '—',
    lessonTitle: lessonMap[r.lesson_id]?.title ?? '—',
    graderName: r.reviewed_by ? (graderMap[r.reviewed_by]?.name ?? '(admin đã xoá tài khoản)') : 'Chưa rõ (chấm trước khi có tính năng này)',
    graderEmail: r.reviewed_by ? (graderMap[r.reviewed_by]?.email ?? '—') : '—',
    mcqResults: mcqMap[`${r.user_id}::${r.lesson_id}`] ?? [],
  }))

  return NextResponse.json({ submissions: result })
}