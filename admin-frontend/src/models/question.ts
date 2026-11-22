export type QuestionInput = { chapter: string; published: boolean; stem: string; options: string[]; correct: number; explanation: string; source?: string }
export type Question = QuestionInput & { id: string; version: number }
export type PracticeQuestion = Pick<Question, 'id' | 'version' | 'chapter' | 'stem' | 'options'>
export type PracticeFeedback = { correct: number; explanation: string; isCorrect: boolean }
export type QuestionReport = { id: string; questionId: string; questionVersion: number; questionStem: string; message: string; createdAt: number }
