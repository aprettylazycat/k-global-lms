/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { parseAnswerText } from '@/lib/parse-answer-text'

const STATUS_LABEL: Record<string, string> = {
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  pending: 'Chờ duyệt',
}

export default function PrintSubmissionPage() {
  const params = useParams()
  const submissionId = params.id as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Bạn cần đăng nhập với tài khoản admin.'); setLoading(false); return }
      const res = await fetch(`/api/admin/submission-detail?id=${submissionId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Không tải được dữ liệu.'); setLoading(false); return }
      setData(json.submission)
      setLoading(false)
    }
    if (submissionId) load()
  }, [submissionId])

  if (loading) {
    return <p style={{ padding: 40, fontFamily: 'sans-serif', color: '#333' }}>Đang tải...</p>
  }
  if (error || !data) {
    return <p style={{ padding: 40, fontFamily: 'sans-serif', color: '#B91C1C' }}>{error || 'Có lỗi xảy ra.'}</p>
  }

  const { qas, freeText } = parseAnswerText(data.answerText || '')
  const now = new Date()

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .print-page { box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
        }
        @page { size: A4; margin: 16mm; }
      `}</style>

      <div style={{ background: '#E5E9F0', minHeight: '100vh', padding: '24px 0' }}>
        <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 16px', display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ background: '#2563EB', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            🖨️ Xuất PDF / In
          </button>
          <button
            onClick={() => window.close()}
            style={{ background: '#fff', color: '#334155', border: '1px solid #CBD5E1', borderRadius: 8, padding: '10px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            Đóng
          </button>
        </div>

        <div className="print-page" style={{
          maxWidth: 800, margin: '0 auto', background: '#fff', borderRadius: 12,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)', padding: '40px 48px', fontFamily: 'Arial, "Helvetica Neue", sans-serif', color: '#111'
        }}>
          {/* Letterhead */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1E3A8A', paddingBottom: 14, marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#1E3A8A', margin: 0 }}>K-GLOBAL</p>
              <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Hệ thống đào tạo nội bộ — Kết quả bài làm</p>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#64748B' }}>
              <p style={{ margin: 0 }}>Mã bài nộp: #{data.id}</p>
              <p style={{ margin: '2px 0 0' }}>Xuất lúc: {now.toLocaleString('vi-VN')}</p>
            </div>
          </div>

          {/* Learner + lesson info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>Học viên</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{data.learner?.name ?? '—'}</p>
              <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0' }}>{data.learner?.email ?? '—'}</p>
              <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0' }}>
                {data.learner?.branchName ?? '—'}{data.learner?.position ? ` · ${data.learner.position}` : ''}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>Bài học</p>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{data.lesson?.title ?? '—'}</p>
              {data.lesson?.moduleName && (
                <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0' }}>Module: {data.lesson.moduleName}</p>
              )}
              <p style={{ fontSize: 13, color: '#475569', margin: '2px 0 0' }}>
                Lần nộp {data.attemptNumber ?? 1}/3 · Nộp lúc {data.submittedAt ? new Date(data.submittedAt).toLocaleString('vi-VN') : '—'}
              </p>
            </div>
          </div>

          {/* Status */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10, marginBottom: 24,
            background: data.status === 'approved' ? '#ECFDF5' : data.status === 'rejected' ? '#FEF2F2' : '#FFFBEB',
            border: `1px solid ${data.status === 'approved' ? '#A7F3D0' : data.status === 'rejected' ? '#FECACA' : '#FDE68A'}`
          }}>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: data.status === 'approved' ? '#059669' : data.status === 'rejected' ? '#DC2626' : '#D97706'
            }}>
              {STATUS_LABEL[data.status] ?? data.status}
              {data.perfectScore ? ' · ⭐ Perfect Score' : ''}
            </span>
            {data.reviewer && (
              <span style={{ fontSize: 12, color: '#64748B' }}>
                — bởi {data.reviewer.name} ({data.reviewer.email})
                {data.reviewedAt ? `, lúc ${new Date(data.reviewedAt).toLocaleString('vi-VN')}` : ''}
              </span>
            )}
          </div>

          {data.status === 'rejected' && data.rejectReason && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', margin: '0 0 4px' }}>Lý do từ chối</p>
              <p style={{ fontSize: 13, color: '#7F1D1D', margin: 0, whiteSpace: 'pre-line' }}>{data.rejectReason}</p>
            </div>
          )}

          {/* MCQ + Đúng/Sai — đáp án đúng vs lựa chọn lần đầu của học viên */}
          {data.mcqResults && data.mcqResults.length > 0 && (
            <>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Câu hỏi trắc nghiệm &amp; Đúng/Sai
              </p>
              {data.mcqResults.map((item: any) => (
                <div key={item.order} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', marginBottom: 10, breakInside: 'avoid' }}>
                  {item.kind === 'mcq' ? (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                        Câu {item.order}: {item.question}
                      </p>
                      <p style={{ fontSize: 12, color: '#059669', margin: '0 0 4px' }}>
                        Đáp án đúng: <strong>{item.correctText ?? '—'}</strong>
                      </p>
                      {item.selectedIndex == null ? (
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>Lựa chọn lần đầu: học viên chưa làm câu này</p>
                      ) : (
                        <>
                          <p style={{ fontSize: 12, color: item.isCorrect ? '#059669' : '#DC2626', margin: '0 0 4px' }}>
                            Lựa chọn lần đầu: <strong>{item.selectedText ?? '—'}</strong> {item.isCorrect ? '(Đúng)' : '(Sai)'}
                          </p>
                          <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                            {item.attemptsUntilCorrect == null
                              ? `Chưa làm đúng (đã thử ${item.totalAttempts} lần)`
                              : item.attemptsUntilCorrect === 1
                                ? 'Làm đúng ngay lần đầu'
                                : `Làm đúng ở lần thử thứ ${item.attemptsUntilCorrect} (tổng ${item.totalAttempts} lần thử)`}
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                        Câu {item.order} (Đúng/Sai): {item.groupQuestion}
                      </p>
                      {item.items.map((it: any, idx: number) => {
                        const answered = it.selected != null
                        const isRight = answered && it.selected === it.correct
                        return (
                          <p key={idx} style={{ fontSize: 12, margin: '0 0 3px', color: !answered ? '#94A3B8' : isRight ? '#059669' : '#DC2626' }}>
                            - {it.statement} — Đáp án đúng: <strong>{it.correct ? 'Đúng' : 'Sai'}</strong> · Học viên chọn: {!answered ? 'chưa làm' : it.selected ? 'Đúng' : 'Sai'}
                          </p>
                        )
                      })}
                      {item.totalAttempts === 0 ? (
                        <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0', fontStyle: 'italic' }}>Học viên chưa làm nhóm câu này</p>
                      ) : (
                        <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                          Lần đầu đúng {item.firstCorrectCount}/{item.firstTotalCount} câu con ·{' '}
                          {item.attemptsUntilAllCorrect == null
                            ? `chưa lần nào đúng hết cả nhóm (đã thử ${item.totalAttempts} lần)`
                            : item.attemptsUntilAllCorrect === 1
                              ? 'đúng hết cả nhóm ngay lần đầu'
                              : `đúng hết cả nhóm ở lần thử thứ ${item.attemptsUntilAllCorrect} (tổng ${item.totalAttempts} lần thử)`}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
              <div style={{ height: 12 }} />
            </>
          )}


          {/* Q&A content */}
          <p style={{ fontSize: 13, fontWeight: 800, color: '#1E293B', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Nội dung bài làm
          </p>

          {qas.length === 0 && !freeText.trim() && (
            <p style={{ fontSize: 13, color: '#94A3B8', fontStyle: 'italic' }}>Không có nội dung câu trả lời dạng văn bản.</p>
          )}

          {qas.map((qa, i) => (
            <div key={i} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', marginBottom: 12, breakInside: 'avoid' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>
                Câu hỏi {i + 1}
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{qa.question}</p>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>
                Trả lời
              </p>
              <p style={{ fontSize: 13, margin: 0, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{qa.answer}</p>
            </div>
          ))}

          {freeText.trim() && (
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', marginBottom: 12, breakInside: 'avoid' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>
                Bài thực hành
              </p>
              {data.lesson?.practicePrompt && (
                <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 10px', whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  {data.lesson.practicePrompt}
                </p>
              )}
              <p style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>
                Trả lời
              </p>
              <p style={{ fontSize: 13, margin: 0, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{freeText}</p>
            </div>
          )}

          {data.fileUrl && (
            <p style={{ fontSize: 13, marginTop: 8 }}>
              📎 File đính kèm:{' '}
              <a href={data.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#2563EB' }}>{data.fileUrl}</a>
            </p>
          )}

          <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 32, borderTop: '1px solid #E2E8F0', paddingTop: 12 }}>
            Tài liệu xuất tự động từ hệ thống đào tạo nội bộ K-Global — chỉ dùng cho mục đích lưu trữ/nội bộ.
          </p>
        </div>
      </div>
    </>
  )
}