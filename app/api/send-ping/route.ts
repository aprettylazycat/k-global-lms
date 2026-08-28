import { NextResponse } from 'next/server'
import { verifyUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { resolvePingRecipients } from '@/lib/ping-recipients'
import { generateSubmissionPdf, slugifyFilename } from '@/lib/generate-submission-pdf'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Địa chỉ gửi đi — phải thuộc domain đã verify trong Resend (k-global.org).
const FROM = 'K-Global LMS <noreply@k-global.org>'

export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (!check.ok) return check.error

  const { emails, learnerName, learnerPosition, branchName, error } = await resolvePingRecipients(check.user.id)
  if (error) return NextResponse.json({ error }, { status: 404 })
  if (emails.length === 0) {
    return NextResponse.json({ error: 'Chưa có email người chấm được cấu hình cho nhánh của bạn. Liên hệ admin để bổ sung nhé.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const done = Number.isFinite(body?.done) ? body.done : 0
  const total = Number.isFinite(body?.total) ? body.total : 0
  const name = learnerName || 'học viên'
  const position = (learnerPosition || '').trim()

  const subject = `K-Global LMS - Chấm bài ${name}${position ? ` ${position}` : ''}`

  // Lấy các bài đang chờ duyệt (mỗi bài lấy đúng lần nộp mới nhất) để đính kèm PDF
  const { data: pendingSubs } = await supabaseAdmin
    .from('submissions')
    .select('lesson_id, answer_text, file_url, submitted_at, status, attempt_number, lesson:lessons(title, practice_prompt)')
    .eq('user_id', check.user.id)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })

  const latestPerLesson = new Map<number, any>()
  ;(pendingSubs || []).forEach((s: any) => {
    if (!latestPerLesson.has(s.lesson_id)) latestPerLesson.set(s.lesson_id, s)
  })
  const submissionsToAttach = Array.from(latestPerLesson.values())

  const origin = new URL(req.url).origin
  let attachments: { filename: string; content: string }[] = []
  try {
    attachments = await Promise.all(
      submissionsToAttach.map(async (s: any) => {
        const lessonRow = Array.isArray(s.lesson) ? s.lesson[0] : s.lesson
        const pdfBuffer = await generateSubmissionPdf({
          learnerName: name,
          learnerPosition: position || null,
          branchName,
          lessonTitle: lessonRow?.title || 'Bài học',
          practicePrompt: lessonRow?.practice_prompt ?? null,
          answerText: s.answer_text,
          fileUrl: s.file_url,
          status: s.status,
          submittedAt: s.submitted_at,
          attemptNumber: s.attempt_number,
        }, origin)
        return { filename: `${slugifyFilename(lessonRow?.title || 'bai-lam')}.pdf`, content: pdfBuffer.toString('base64') }
      })
    )
  } catch (e: any) {
    // Không chặn việc gửi mail nếu tạo PDF lỗi — vẫn gửi thông báo, chỉ thiếu đính kèm.
    attachments = []
  }

  const attachNote = attachments.length > 0
    ? `Đính kèm ${attachments.length} bài làm dạng PDF để tiện xem trực tiếp.`
    : ''
  const text = `Học viên ${name}${position ? ` (vị trí: ${position})` : ''} đã hoàn thiện ${done}/${total} bài và chưa được chấm — hãy chấm cho bạn học viên nhé. ${attachNote}`

  try {
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: emails,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6">
          <p>${text}</p>
          <p style="color:#94A3B8;font-size:12px;margin-top:24px">Email gửi tự động từ K-Global LMS — không cần trả lời email này.</p>
        </div>
      `,
      attachments: attachments.length > 0 ? attachments : undefined,
    })
    if (sendError) {
      return NextResponse.json({ error: sendError.message || 'Gửi mail thất bại' }, { status: 502 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gửi mail thất bại' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, sentTo: emails, attachedCount: attachments.length })
}