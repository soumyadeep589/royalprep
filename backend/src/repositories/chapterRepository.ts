import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { ChapterContent } from '../models/chapter.js'

export class ChapterConflict extends Error {}
export class ChapterNotFound extends Error {}

type ChapterState = { id: string; currentRevision: number; draftRevision: number | null; publishedRevision: number | null }
type ChapterRevision = { revision: number; content: ChapterContent; createdAt: Date }
type ChapterPublication = ChapterRevision & { publishedAt: Date | null; sourceRevision: number | null }
type Progress = { revision: number; sectionId: string; version: number }

export function createChapterRepository(pool: Pool) {
  async function state(client: Pool | PoolClient, id: string, lock = false): Promise<ChapterState | undefined> {
    const result = await client.query<ChapterState>(
      `SELECT id, current_revision AS "currentRevision", draft_revision AS "draftRevision", published_revision AS "publishedRevision" FROM chapter_documents WHERE id=$1${lock ? ' FOR UPDATE' : ''}`, [id],
    )
    return result.rows[0]
  }
  async function revision(client: Pool | PoolClient, id: string, number: number): Promise<ChapterRevision | undefined> {
    const result = await client.query<ChapterRevision>('SELECT revision, content, created_at AS "createdAt" FROM chapter_revisions WHERE chapter_id=$1 AND revision=$2', [id, number])
    return result.rows[0]
  }
  async function transact<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
  function check(current: ChapterState, expected: number) {
    if (current.currentRevision !== expected) throw new ChapterConflict('Chapter changed; reload before saving or publishing.')
  }
  async function published(client: Pool | PoolClient, id: string): Promise<ChapterRevision | undefined> {
    const current = await state(client, id)
    if (!current || current.publishedRevision === null) return undefined
    return revision(client, id, current.publishedRevision)
  }

  return {
    async listAdmin() {
      const result = await pool.query<{ id: string; currentRevision: number; publishedRevision: number | null; title: string }>(
        `SELECT d.id, d.current_revision AS "currentRevision", d.published_revision AS "publishedRevision", r.content->>'title' AS title
         FROM chapter_documents d JOIN chapter_revisions r ON r.chapter_id=d.id AND r.revision=d.draft_revision ORDER BY d.id`,
      )
      return result.rows
    },
    async listPublished(owner: string) {
      const result = await pool.query<{ id: string; revision: number; title: string; lastReadAt: Date | null }>(
        `SELECT d.id, r.revision, r.content->>'title' AS title, p.updated_at AS "lastReadAt" FROM chapter_documents d
         JOIN chapter_revisions r ON r.chapter_id=d.id AND r.revision=d.published_revision
         LEFT JOIN student_chapter_progress p ON p.chapter_id=d.id AND p.owner_email=$1 ORDER BY d.id`, [owner],
      )
      return result.rows
    },
    async adminChapter(id: string) {
      const current = await state(pool, id)
      if (!current || current.draftRevision === null) return undefined
      const history = await pool.query<ChapterPublication>(
        `SELECT r.revision, r.content, r.created_at AS "createdAt", p.published_at AS "publishedAt", p.source_revision AS "sourceRevision"
         FROM chapter_publications p JOIN chapter_revisions r ON r.chapter_id=p.chapter_id AND r.revision=p.revision
         WHERE p.chapter_id=$1 ORDER BY p.revision DESC`, [id],
      )
      return { ...current, draft: await revision(pool, id, current.draftRevision), history: history.rows }
    },
    async create(content: ChapterContent) {
      return transact(async client => {
        const id = randomUUID()
        await client.query('INSERT INTO chapter_documents (id, current_revision, draft_revision) VALUES ($1, 1, 1)', [id])
        await client.query('INSERT INTO chapter_revisions (chapter_id, revision, content) VALUES ($1, 1, $2::jsonb)', [id, JSON.stringify(content)])
        return id
      })
    },
    async saveDraft(id: string, expected: number, content: ChapterContent) {
      return transact(async client => {
        const current = await state(client, id, true)
        if (!current) throw new ChapterNotFound('Chapter not found.')
        check(current, expected)
        const next = current.currentRevision + 1
        await client.query('INSERT INTO chapter_revisions (chapter_id, revision, content) VALUES ($1, $2, $3::jsonb)', [id, next, JSON.stringify(content)])
        await client.query('UPDATE chapter_documents SET current_revision=$2, draft_revision=$2 WHERE id=$1', [id, next])
        return next
      })
    },
    async publish(id: string, expected: number) {
      return transact(async client => {
        const current = await state(client, id, true)
        if (!current || current.draftRevision === null) throw new ChapterNotFound('Chapter draft not found.')
        check(current, expected)
        if (current.publishedRevision !== current.draftRevision) {
          await client.query('INSERT INTO chapter_publications (chapter_id, revision) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, current.draftRevision])
          await client.query('UPDATE chapter_documents SET published_revision=$2 WHERE id=$1', [id, current.draftRevision])
        }
        return current.draftRevision
      })
    },
    async restore(id: string, expected: number, sourceRevision: number) {
      return transact(async client => {
        const current = await state(client, id, true)
        if (!current) throw new ChapterNotFound('Chapter not found.')
        check(current, expected)
        const publication = await client.query('SELECT 1 FROM chapter_publications WHERE chapter_id=$1 AND revision=$2', [id, sourceRevision])
        const source = publication.rowCount ? await revision(client, id, sourceRevision) : undefined
        if (!source) throw new ChapterNotFound('Published chapter revision not found.')
        const next = current.currentRevision + 1
        await client.query('INSERT INTO chapter_revisions (chapter_id, revision, content) VALUES ($1, $2, $3::jsonb)', [id, next, JSON.stringify(source.content)])
        await client.query('INSERT INTO chapter_publications (chapter_id, revision, source_revision) VALUES ($1, $2, $3)', [id, next, sourceRevision])
        await client.query('UPDATE chapter_documents SET current_revision=$2, draft_revision=$2, published_revision=$2 WHERE id=$1', [id, next])
        return next
      })
    },
    async readPublished(id: string) { return published(pool, id) },
    async readProgress(owner: string, id: string): Promise<Progress | undefined> {
      const result = await pool.query<Progress>('SELECT revision, section_id AS "sectionId", version FROM student_chapter_progress WHERE owner_email=$1 AND chapter_id=$2', [owner, id])
      return result.rows[0]
    },
    async writeProgress(owner: string, id: string, expected: number, chapterRevision: number, sectionId: string): Promise<Progress> {
      try { return await transact(async client => {
        const current = await state(client, id, true)
        if (!current || current.publishedRevision === null) throw new ChapterNotFound('Published chapter not found.')
        if (current.publishedRevision !== chapterRevision) throw new ChapterConflict('Chapter changed; reload before saving progress.')
        const content = await revision(client, id, chapterRevision)
        if (!content || !content.content.sections.some(section => section.id === sectionId)) throw new ChapterNotFound('Chapter section not found.')
        if (expected === 0) {
          const inserted = await client.query<Progress>(
            `INSERT INTO student_chapter_progress (owner_email, chapter_id, revision, section_id, version)
             VALUES ($1, $2, $3, $4, 1)
             RETURNING revision, section_id AS "sectionId", version`, [owner, id, chapterRevision, sectionId],
          )
          return inserted.rows[0]
        }
        const updated = await client.query<Progress>(
          `UPDATE student_chapter_progress SET revision=$3, section_id=$4, version=version+1, updated_at=now()
           WHERE owner_email=$1 AND chapter_id=$2 AND version=$5
           RETURNING revision, section_id AS "sectionId", version`, [owner, id, chapterRevision, sectionId, expected],
        )
        if (!updated.rows[0]) throw new ChapterConflict('Progress changed; reload before saving.')
        return updated.rows[0]
      }) } catch (error) {
        if (expected === 0 && error instanceof Error && 'code' in error && error.code === '23505') throw new ChapterConflict('Progress changed; reload before saving.')
        throw error
      }
    },
  }
}
