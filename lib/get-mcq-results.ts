import { supabaseAdmin } from './supabase-server'

export type McqQuestionResult = {
  kind: 'mcq'
  order: number
  question: string
  options: string[]
  correctIndex: number
  correctText: string | null
  selectedIndex: number | null      // lựa chọn ở LẦN THỬ ĐẦU TIÊN
  selectedText: string | null
  isCorrect: boolean | null         // null = học viên chưa từng làm câu này
  totalAttempts: number             // tổng số lần thử (mọi lần, mọi lượt làm quiz)
  attemptsUntilCorrect: number | null // làm đến lần thứ mấy thì đúng — null nếu chưa từng đúng
}

export type TfItemResult = {
  statement: string
  correct: boolean
  selected: boolean | null // lựa chọn ở LẦN THỬ ĐẦU TIÊN cho riêng câu con này
}

export type TfGroupResult = {
  kind: 'true_false'
  order: number
  groupQuestion: string
  items: TfItemResult[]        // trạng thái ở lần thử ĐẦU TIÊN
  firstCorrectCount: number    // số câu con đúng ở lần thử đầu tiên
  firstTotalCount: number
  totalAttempts: number        // số lần đã nộp lại cả nhóm Đúng/Sai này
  attemptsUntilAllCorrect: number | null // lần thử thứ mấy thì đúng HẾT cả nhóm — null nếu chưa từng đúng hết
}

export type QuizResult = McqQuestionResult | TfGroupResult

// Lấy toàn bộ câu trắc nghiệm (mcq) + nhóm Đúng/Sai (true_false) của 1 bài học,
// kèm lựa chọn lần đầu tiên và số lần thử tới khi đúng — dựa vào lịch sử đầy đủ
// trong quiz_attempts (xếp theo thời gian thực tế, kể cả khi học viên làm lại
// nguyên bài quiz nhiều lượt khác nhau).
export async function getMcqResults(userId: string, lessonId: number): Promise<QuizResult[]> {
  const { data: lesson } = await supabaseAdmin
    .from('lessons')
    .select('questions')
    .eq('id', lessonId)
    .single()

  const allQuestions = (lesson?.questions || []) as any[]
  const mcqDefs = allQuestions.filter(q => q?.type === 'mcq' && q?.question)
  const tfDefs = allQuestions.filter(q => q?.type === 'true_false' && q?.question)

  if (mcqDefs.length === 0 && tfDefs.length === 0) return []

  const { data: attempts } = await supabaseAdmin
    .from('quiz_attempts')
    .select('question_id, selected_option, is_correct, extra_data, created_at')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: true })

  const byQuestion = new Map<string, any[]>()
  ;(attempts || []).forEach((a: any) => {
    const key = String(a.question_id)
    if (!byQuestion.has(key)) byQuestion.set(key, [])
    byQuestion.get(key)!.push(a)
  })

  const mcqResults: McqQuestionResult[] = mcqDefs.map((q: any, i: number) => {
    const history = byQuestion.get(String(q.id)) || []
    const options: string[] = Array.isArray(q.options) ? q.options : []
    const first = history[0] ?? null
    const correctIdx = history.findIndex((a: any) => a.is_correct)

    return {
      kind: 'mcq',
      order: i + 1,
      question: q.question,
      options,
      correctIndex: q.correct,
      correctText: options[q.correct] ?? null,
      selectedIndex: first ? first.selected_option : null,
      selectedText: first ? options[first.selected_option] ?? null : null,
      isCorrect: first ? !!first.is_correct : null,
      totalAttempts: history.length,
      attemptsUntilCorrect: correctIdx === -1 ? null : correctIdx + 1,
    }
  })

  const tfResults: TfGroupResult[] = tfDefs.map((g: any, i: number) => {
    const history = byQuestion.get(`tf_group_${g.id}`) || []
    const first = history[0] ?? null
    const items: TfItemResult[] = (g.items || []).map((it: any) => {
      let selected: boolean | null = null
      if (first?.extra_data) {
        try {
          const parsed = JSON.parse(first.extra_data)
          const match = (parsed.items || []).find((x: any) => x.id === it.id || x.statement === it.statement)
          selected = match ? match.selected : null
        } catch {}
      }
      return { statement: it.statement, correct: it.correct, selected }
    })
    const firstCorrectCount = items.filter(it => it.selected === it.correct).length
    const allCorrectIdx = history.findIndex((a: any) => a.is_correct)

    return {
      kind: 'true_false',
      order: mcqDefs.length + i + 1,
      groupQuestion: g.question,
      items,
      firstCorrectCount,
      firstTotalCount: items.length,
      totalAttempts: history.length,
      attemptsUntilAllCorrect: allCorrectIdx === -1 ? null : allCorrectIdx + 1,
    }
  })

  return [...mcqResults, ...tfResults]
}