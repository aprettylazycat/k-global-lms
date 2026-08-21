export type Role = 'learner' | 'admin'

export type Branch = {
  id: string
  name: string
  slug: string
  color_bg: string
  color_text: string
  leader_email?: string | null
}

export type MCQQuestion = {
  id: number
  type: 'mcq'
  question: string
  options: string[]
  correct: number
}

export type EssayQuestion = {
  id: number
  type: 'essay'
  question: string
}

export type TrueFalseQuestion = {
  id: number
  type: 'true_false'
  question: string
  items: { id: number; statement: string; correct: boolean }[]
}

export type Question = MCQQuestion | EssayQuestion | TrueFalseQuestion

export type Lesson = {
  id: number
  branch_id: string
  order_index: number
  title: string
  intro_text: string
  youtube_id: string
  youtube_id_2?: string | null
  questions: Question[]
  practice_prompt: string
  is_published: boolean
  video_url?: string | null
  no_quiz?: boolean  // Bài 0 không có câu hỏi
}

export type Progress = {
  lesson_id: number
  tick1: boolean
  tick2: boolean
  completed_at: string | null
  perfect_score?: boolean
}

export type Profile = {
  id: string
  name: string
  email: string
  role: Role
  branch_id: string
  branch?: Branch
  position: string | null
  onboarding_date: string | null
  goal_after_onboarding: string | null
  expectation: string | null
  avatar_url?: string | null
}