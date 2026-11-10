import { getEnv } from '../config/env.js'
import { brandSource, collectLikes, metaLikesPlan } from './likes.js'
import { collectTikTok } from './tiktok.js'
import type { LikesReport } from './types.js'
import { collectYouTube } from './youtube.js'

export function collectAllLikes(): Promise<LikesReport> {
  const meta = metaLikesPlan(getEnv())

  return collectLikes({
    sources: [...meta.sources, brandSource('youtube', collectYouTube), brandSource('tiktok', collectTikTok)],
    missing: meta.missing,
  })
}
