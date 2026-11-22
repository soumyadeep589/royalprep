export type HeroContent = {
  eyebrow: string
  headline: string
  highlight: string
  description: string
  primaryLabel: string
  primaryPath: string
  secondaryLabel: string
  secondaryPath: string
}

export type HeroRevision = { revision: number; content: HeroContent; createdAt: string }
export type HeroState = {
  currentRevision: number
  draftRevision: number | null
  publishedRevision: number | null
  draft: HeroRevision | null
  history: HeroRevision[]
}
