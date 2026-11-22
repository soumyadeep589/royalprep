export type ChapterSection = { id: string; title: string; body: string }
export type ChapterContent = { title: string; practiceChapter: string; sections: ChapterSection[] }
export type ChapterRevision = { revision: number; content: ChapterContent; createdAt: string }
export type ChapterPublication = ChapterRevision & { publishedAt: string | null; sourceRevision: number | null }
export type ChapterState = { id: string; currentRevision: number; draftRevision: number | null; publishedRevision: number | null; draft: ChapterRevision; history: ChapterPublication[] }
export type ChapterSummary = { id: string; revision: number; title: string; lastReadAt: string | null }
export type ChapterProgress = { revision: number; sectionId: string; version: number }
export type StudentChapter = ChapterRevision & { id: string; progress: ChapterProgress | null }
