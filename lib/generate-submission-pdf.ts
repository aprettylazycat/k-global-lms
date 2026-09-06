import PDFDocument from 'pdfkit'
import { parseAnswerText } from './parse-answer-text'

// Cache font trong bộ nhớ instance serverless (warm invocation dùng lại, khỏi fetch lại mỗi lần)
let fontCache: { regular: Buffer; bold: Buffer } | null = null

async function getFonts(origin: string) {
  if (fontCache) return fontCache
  const [regRes, boldRes] = await Promise.all([
    fetch(`${origin}/fonts/DejaVuSans.ttf`),
    fetch(`${origin}/fonts/DejaVuSans-Bold.ttf`),
  ])
  if (!regRes.ok || !boldRes.ok) throw new Error('Không tải được font để tạo PDF')
  const regular = Buffer.from(await regRes.arrayBuffer())
  const bold = Buffer.from(await boldRes.arrayBuffer())
  fontCache = { regular, bold }
  return fontCache
}

const STATUS_LABEL: Record<string, string> = {
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  pending: 'Chờ duyệt',
}
const STATUS_COLOR: Record<string, string> = {
  approved: '#059669',
  rejected: '#DC2626',
  pending: '#D97706',
}

export type SubmissionPdfData = {
  learnerName: string
  learnerPosition?: string | null
  branchName?: string | null
  lessonTitle: string
  practicePrompt?: string | null
  answerText: string | null
  fileUrl?: string | null
  status: string
  submittedAt?: string | null
  attemptNumber?: number | null
  mcqResults?: import('./get-mcq-results').QuizResult[]
}

// Render 1 bài làm ra PDF (buffer), dùng font DejaVu Sans để hiển thị đúng tiếng Việt có dấu.
export async function generateSubmissionPdf(data: SubmissionPdfData, origin: string): Promise<Buffer> {
  const { regular, bold } = await getFonts(origin)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.registerFont('Body', regular)
    doc.registerFont('Heading', bold)

    // Letterhead
    doc.font('Heading').fontSize(18).fillColor('#1E3A8A').text('K-GLOBAL')
    doc.font('Body').fontSize(9).fillColor('#64748B').text('Hệ thống đào tạo nội bộ — Kết quả bài làm')
    doc.moveDown(1)
    doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor('#1E3A8A').lineWidth(2).stroke()
    doc.moveDown(1)

    // Học viên
    doc.font('Heading').fontSize(8).fillColor('#94A3B8').text('HỌC VIÊN')
    doc.font('Heading').fontSize(13).fillColor('#111').text(data.learnerName)
    const learnerLine = [data.branchName, data.learnerPosition].filter(Boolean).join(' · ')
    if (learnerLine) doc.font('Body').fontSize(10).fillColor('#475569').text(learnerLine)
    doc.moveDown(0.8)

    // Bài học
    doc.font('Heading').fontSize(8).fillColor('#94A3B8').text('BÀI HỌC')
    doc.font('Heading').fontSize(13).fillColor('#111').text(data.lessonTitle)
    const metaLine = `Lần nộp ${data.attemptNumber ?? 1}/3` +
      (data.submittedAt ? ` · Nộp lúc ${new Date(data.submittedAt).toLocaleString('vi-VN')}` : '')
    doc.font('Body').fontSize(10).fillColor('#475569').text(metaLine)
    doc.moveDown(0.8)

    // Trạng thái
    doc.font('Heading').fontSize(11).fillColor(STATUS_COLOR[data.status] ?? '#111')
      .text(STATUS_LABEL[data.status] ?? data.status)
    doc.moveDown(1)

    // Trắc nghiệm + Đúng/Sai — đáp án đúng vs lựa chọn LẦN ĐẦU của học viên
    if (data.mcqResults && data.mcqResults.length > 0) {
      doc.font('Heading').fontSize(11).fillColor('#1E293B').text('CÂU HỎI TRẮC NGHIỆM & ĐÚNG/SAI')
      doc.moveDown(0.4)

      data.mcqResults.forEach(item => {
        if (item.kind === 'mcq') {
          doc.font('Heading').fontSize(10).fillColor('#111').text(`Câu ${item.order}: ${item.question}`)
          doc.font('Body').fontSize(9).fillColor('#059669').text(`Đáp án đúng: ${item.correctText ?? '—'}`)
          if (item.selectedIndex == null) {
            doc.font('Body').fontSize(9).fillColor('#94A3B8').text('Lựa chọn lần đầu: học viên chưa làm câu này')
          } else {
            doc.font('Body').fontSize(9).fillColor(item.isCorrect ? '#059669' : '#DC2626')
              .text(`Lựa chọn lần đầu: ${item.selectedText ?? '—'} ${item.isCorrect ? '(Đúng)' : '(Sai)'}`)
            doc.font('Body').fontSize(9).fillColor('#475569').text(
              item.attemptsUntilCorrect == null
                ? `Chưa làm đúng (đã thử ${item.totalAttempts} lần)`
                : item.attemptsUntilCorrect === 1
                  ? 'Làm đúng ngay lần đầu'
                  : `Làm đúng ở lần thử thứ ${item.attemptsUntilCorrect} (tổng ${item.totalAttempts} lần thử)`
            )
          }
        } else {
          doc.font('Heading').fontSize(10).fillColor('#111').text(`Câu ${item.order} (Đúng/Sai): ${item.groupQuestion}`)
          item.items.forEach(it => {
            const answered = it.selected != null
            const isRight = answered && it.selected === it.correct
            doc.font('Body').fontSize(9).fillColor(!answered ? '#94A3B8' : isRight ? '#059669' : '#DC2626')
              .text(`- ${it.statement} — Đáp án đúng: ${it.correct ? 'Đúng' : 'Sai'} · Học viên chọn: ${!answered ? 'chưa làm' : it.selected ? 'Đúng' : 'Sai'}`)
          })
          if (item.totalAttempts === 0) {
            doc.font('Body').fontSize(9).fillColor('#94A3B8').text('Học viên chưa làm nhóm câu này')
          } else {
            doc.font('Body').fontSize(9).fillColor('#475569').text(
              `Lần đầu đúng ${item.firstCorrectCount}/${item.firstTotalCount} câu con · ` +
              (item.attemptsUntilAllCorrect == null
                ? `chưa lần nào đúng hết cả nhóm (đã thử ${item.totalAttempts} lần)`
                : item.attemptsUntilAllCorrect === 1
                  ? 'đúng hết cả nhóm ngay lần đầu'
                  : `đúng hết cả nhóm ở lần thử thứ ${item.attemptsUntilAllCorrect} (tổng ${item.totalAttempts} lần thử)`)
            )
          }
        }
        doc.moveDown(0.5)
      })
      doc.moveDown(0.5)
    }

    // Nội dung bài làm
    doc.font('Heading').fontSize(11).fillColor('#1E293B').text('NỘI DUNG BÀI LÀM')
    doc.moveDown(0.4)

    const { qas, freeText } = parseAnswerText(data.answerText || '')

    if (qas.length === 0 && !freeText.trim()) {
      doc.font('Body').fontSize(10).fillColor('#94A3B8').text('Không có nội dung câu trả lời dạng văn bản.')
    }

    qas.forEach((qa, i) => {
      doc.font('Heading').fontSize(8).fillColor('#2563EB').text(`CÂU HỎI ${i + 1}`)
      doc.font('Heading').fontSize(10).fillColor('#111').text(qa.question)
      doc.moveDown(0.15)
      doc.font('Heading').fontSize(8).fillColor('#2563EB').text('TRẢ LỜI')
      doc.font('Body').fontSize(10).fillColor('#111').text(qa.answer)
      doc.moveDown(0.6)
    })

    if (freeText.trim()) {
      doc.font('Heading').fontSize(8).fillColor('#2563EB').text('BÀI THỰC HÀNH')
      if (data.practicePrompt) {
        doc.font('Heading').fontSize(10).fillColor('#111').text(data.practicePrompt)
        doc.moveDown(0.15)
      }
      doc.font('Heading').fontSize(8).fillColor('#2563EB').text('TRẢ LỜI')
      doc.font('Body').fontSize(10).fillColor('#111').text(freeText)
      doc.moveDown(0.6)
    }

    if (data.fileUrl) {
      doc.font('Body').fontSize(9).fillColor('#2563EB').text(`File đính kèm: ${data.fileUrl}`)
    }

    doc.moveDown(1.5)
    doc.font('Body').fontSize(8).fillColor('#94A3B8')
      .text('Tài liệu xuất tự động từ K-Global LMS.')

    doc.end()
  })
}

// Rút gọn tiêu đề bài học thành tên file an toàn (bỏ dấu, ký tự đặc biệt)
export function slugifyFilename(title: string): string {
  return title
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'bai-lam'
}