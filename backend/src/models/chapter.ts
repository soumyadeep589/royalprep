import { z } from 'zod'
import { revisionSchema } from './hero.js'

const sectionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4000),
}).strict()

export const chapterContentSchema = z.object({
  title: z.string().trim().min(1).max(160),
  practiceChapter: z.string().trim().max(120),
  sections: z.array(sectionSchema).min(1).max(25),
}).strict().refine(content => new Set(content.sections.map(section => section.id)).size === content.sections.length, {
  message: 'Section IDs must be unique.',
})

export const chapterDraftSchema = z.object({ expectedRevision: revisionSchema, content: chapterContentSchema }).strict()
export const chapterPublishSchema = z.object({ expectedRevision: revisionSchema }).strict()
export const chapterRestoreSchema = z.object({ expectedRevision: revisionSchema, sourceRevision: revisionSchema.min(1) }).strict()
export const chapterProgressSchema = z.object({
  expectedVersion: revisionSchema,
  revision: revisionSchema.min(1),
  sectionId: z.string().uuid(),
}).strict()

export type ChapterContent = z.infer<typeof chapterContentSchema>
