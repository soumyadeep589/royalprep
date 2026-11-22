import type { PracticeQuestion } from './question'

export type AttemptSummary = {
  id: string
  status: 'active' | 'submitted'
  createdAt: number
  deadline: number
  submittedAt: number | null
  count: number
  score: number | null
}

export type Attempt = {
  id: string
  version: number
  status: 'active' | 'submitted'
  createdAt: number
  deadline: number
  submittedAt: number | null
  serverTime: number
  questions: (PracticeQuestion & { correct?: number; explanation?: string })[]
  answers: Record<string, number>
  flags: string[]
  score?: number
}
