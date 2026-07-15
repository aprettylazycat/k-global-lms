@'
'use client'
import { useState } from 'react'

const NAVY = '#466898'
const GOLD = '#C9A84C'
const CREAM = '#F5F0E8'
const BORDER = '#E2D8C8'
const MUTED = '#8AABC8'

export type FeedbackQuestion = {
  id: string
  question_text: string
  question_type: 'rating' | 'text'
  order_index: number
}

export default function FeedbackModal({
  moduleName, questions, submitting, onSubmit, onSkip,
}: {
  moduleName: string
  questions: FeedbackQuestion[]
  submitting: boolean
  onSubmit: (responses: { question_id: string; rating_value?: number; text_value?: string }[]) => void
  onSkip: () => void
}) {
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [texts, setTexts] = useState<Record<string, string>>({})

  const sorted = questions.slice().sort((a, b) => a.order_index - b.order_index)
  const hasAnyAnswer = Object.keys(ratings).length > 0 || Object.values(texts).some(v => v.trim())

  function handleSubmit() {
    const responses = sorted
      .map(q => {
        if (q.question_type === 'rating' && ratings[q.id]) {
          return { question_id: q.id, rating_value: ratings[q.id] }
        }
        if (q.question_type === 'text' && texts[q.id]?.trim()) {
          return { question_id: q.id, text_value: texts[q.id].trim() }
        }
        return null
      })
      .filter(Boolean) as { question_id: string; rating_value?: number; text_value?: string }[]
    onSubmit(responses)
  }

  return (
    // KhÃ´ng Ä‘Ã³ng báº±ng click-outside/ESC â€” chá»‰ Ä‘Ã³ng qua 2 nÃºt bÃªn dÆ°á»›i, Ä‘á»ƒ trÃ¡nh máº¥t cÃ¢u tráº£ lá»i dá»Ÿ dang
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="rounded-3xl max-w-lg w-full my-8 shadow-2xl overflow-hidden" style={{ backgroundColor: 'white' }}>

        {/* Header */}
        <div className="p-6 text-center" style={{ backgroundColor: NAVY }}>
          <p className="text-xl font-bold mb-1 text-white">
            Báº¡n vá»«a hoÃ n thÃ nh {moduleName}! ðŸŽ‰
          </p>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
            VÃ i phÃºt chia sáº» cáº£m nháº­n giÃºp K-Global cáº£i thiá»‡n chÆ°Æ¡ng trÃ¬nh Ä‘Ã o táº¡o.
          </p>
        </div>

        {/* Questions */}
        <div className="p-6 space-y-6 max-h-[55vh] overflow-y-auto">
          {sorted.map(q => (
            <div key={q.id}>
              <p className="text-sm font-semibold mb-3" style={{ color: NAVY }}>{q.question_text}</p>
              {q.question_type === 'rating' ? (
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatings(prev => ({ ...prev, [q.id]: star }))}
                      className="text-2xl transition-transform hover:scale-110"
                      style={{ color: (ratings[q.id] ?? 0) >= star ? GOLD : BORDER }}
                    >
                      â˜…
                    </button>
                  ))}
                </div>
              ) : (
                <textarea
                  rows={3}
                  className="w-full text-sm rounded-xl px-4 py-3 focus:outline-none resize-y"
                  style={{ border: `1px solid ${BORDER}`, backgroundColor: CREAM, color: NAVY }}
                  placeholder="Chia sáº» cáº£m nháº­n cá»§a báº¡n..."
                  value={texts[q.id] || ''}
                  onChange={e => setTexts(prev => ({ ...prev, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 pt-2 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || !hasAnyAnswer}
            className="w-full text-sm font-semibold text-white py-3 rounded-xl transition-opacity disabled:opacity-40 hover:opacity-90"
            style={{ backgroundColor: NAVY }}
          >
            {submitting ? 'Äang gá»­i...' : 'Gá»­i feedback'}
          </button>
          <button
            onClick={onSkip}
            disabled={submitting}
            className="w-full text-sm font-medium py-3 rounded-xl transition-colors disabled:opacity-40"
            style={{ color: MUTED }}
          >
            Bá» qua
          </button>
        </div>
      </div>
    </div>
  )
}
'@ | Set-Content -Path "components/FeedbackModal.tsx" -Encoding UTF8
