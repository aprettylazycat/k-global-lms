import { NextResponse } from 'next/server'
import { verifyUser } from '@/lib/auth-server'
import { resolvePingRecipients } from '@/lib/ping-recipients'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Địa chỉ gửi đi — phải thuộc domain đã verify trong Resend (k-global.org).
const FROM = 'K-Global LMS <noreply@k-global.org>'

export async function POST(req: Request) {
  const check = await verifyUser(req)
  if (!check.ok) return check.error

  const { emails, learnerName, error } = await resolvePingRecipients(check.user.id)
  if (error) return NextResponse.json({ error }, { status: 404 })
  if (emails.length === 0) {
    return NextResponse.json({ error: 'Chưa có email người chấm được cấu hình cho nhánh của bạn. Liên hệ admin để bổ sung nhé.' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const done = Number.isFinite(body?.done) ? body.done : 0
  const total = Number.isFinite(body?.total) ? body.total : 0
  const name = learnerName || 'học viên'

  const subject = `[K-Global LMS] Nhắc chấm bài cho ${name}`
  const text = `Học viên ${name} đã hoàn thiện ${done}/${total} bài và chưa được chấm — hãy chấm cho bạn học viên nhé.`

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
    })
    if (sendError) {
      return NextResponse.json({ error: sendError.message || 'Gửi mail thất bại' }, { status: 502 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Gửi mail thất bại' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, sentTo: emails })
}