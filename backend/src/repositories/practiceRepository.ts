import type { Pool } from 'pg'

export class PracticeNotFound extends Error {}
export class PracticeConflict extends Error {}

type PracticeAnswerRow = {
  questionId: string
  questionVersion: number
  chapter: string
  stem: string
  selected: number
  correct: number
  explanation: string
  answeredAt: string | number
}

export function createPracticeRepository(pool: Pool) {
  return {
    async list(owner: string) {
      const result = await pool.query<PracticeAnswerRow>(
        `SELECT question_id AS "questionId", question_version AS "questionVersion", chapter, stem,
          selected_option AS selected, correct_option AS correct, explanation, answered_at AS "answeredAt"
         FROM student_practice_answers WHERE owner_email=$1`, [owner],
      )
      return result.rows.map(row => ({ ...row, answeredAt: Number(row.answeredAt), isCorrect: row.selected === row.correct }))
    },
    async answer(owner: string, id: string, version: number, option: number) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await client.query<{ version: number; published: boolean; chapter: string; stem: string; correct: number; explanation: string }>(
          'SELECT version, published, chapter, stem, correct, explanation FROM questions WHERE id=$1 FOR UPDATE', [id],
        )
        const question = result.rows[0]
        if (!question?.published) throw new PracticeNotFound()
        if (question.version !== version) throw new PracticeConflict()
        await client.query(
          `INSERT INTO student_practice_answers
           (owner_email, question_id, question_version, chapter, stem, selected_option, correct_option, explanation, answered_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (owner_email, question_id) DO UPDATE SET
             question_version=EXCLUDED.question_version, chapter=EXCLUDED.chapter, stem=EXCLUDED.stem,
             selected_option=EXCLUDED.selected_option, correct_option=EXCLUDED.correct_option,
             explanation=EXCLUDED.explanation, answered_at=EXCLUDED.answered_at`,
          [owner, id, version, question.chapter, question.stem, option, question.correct, question.explanation, Date.now()],
        )
        await client.query('COMMIT')
        return { correct: question.correct, explanation: question.explanation, isCorrect: question.correct === option }
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally { client.release() }
    },
  }
}
