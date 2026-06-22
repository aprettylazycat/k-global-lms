export type Role = 'learner' | 'admin'

export type Branch = {
  id: string
  name: string
  slug: string
  color_bg: string
  color_text: string
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

export type Question = MCQQuestion | EssayQuestion

export type Lesson = {
  id: number
  branch_id: string
  order_index: number
  title: string
  intro_text: string
  youtube_id: string
  questions: Question[]
  practice_prompt: string
  is_published: boolean
}

export type Progress = {
  lesson_id: number
  tick1: boolean
  tick2: boolean
  completed_at: string | null
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
  mentor_name: string | null
  goal_after_onboarding: string | null
  expectation: string | null
}