// Bài làm tự luận được lưu dạng text gộp nhiều câu hỏi, ví dụ:
// "Câu hỏi tự luận 1:\n...\nTrả lời:\n...\n\nCâu hỏi tự luận 2:\n...\nTrả lời:\n...\n\n---\n\n<bài thực hành tự do>"
// Hàm này tách lại thành từng cặp câu hỏi/trả lời + phần bài thực hành tự do (nếu có).
export function parseAnswerText(text: string) {
  const parts = (text || '').split('\n\n---\n\n')
  const essayPart = parts[0]
  const freeText = parts.slice(1).join('\n\n---\n\n')

  const blocks = essayPart.split(/\n\n(?=Câu hỏi tự luận)/g).filter(Boolean)
  const qas = blocks
    .map(block => {
      const match = block.match(/^Câu hỏi tự luận \d+:\s*([\s\S]*?)\nTrả lời:\s*([\s\S]*)$/)
      return match ? { question: match[1].trim(), answer: match[2].trim() } : null
    })
    .filter(Boolean) as { question: string; answer: string }[]

  return { qas, freeText: qas.length > 0 ? freeText : text }
}
