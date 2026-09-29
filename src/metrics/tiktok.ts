import { MS_PER_SECOND } from '../config/constants.js'
import { tikTokPost } from '../tiktok/api.js'
import { TIKTOK_VIDEO_LIST_PATH } from '../tiktok/constants.js'
import { toCount, toIsoDate } from './numbers.js'
import type { PostMetrics } from './types.js'

const PAGE_SIZE = 20
const MAX_PAGES = 3
const VIDEO_FIELDS = 'id,create_time,share_url,view_count,like_count,comment_count,share_count'

interface TikTokVideo {
  id: string
  create_time?: number
  share_url?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
}

interface VideoPage {
  videos?: TikTokVideo[]
  cursor?: number
  has_more?: boolean
}

function toPostMetrics(video: TikTokVideo): PostMetrics {
  return {
    network: 'tiktok',
    url: video.share_url ?? '',
    publishedAt: video.create_time ? toIsoDate(video.create_time * MS_PER_SECOND) : null,
    metrics: {
      views: toCount(video.view_count),
      likes: toCount(video.like_count),
      comments: toCount(video.comment_count),
      shares: toCount(video.share_count),
    },
  }
}

export async function collectTikTok(): Promise<PostMetrics[]> {
  const videos: TikTokVideo[] = []
  let cursor: number | undefined

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = cursor === undefined ? { max_count: PAGE_SIZE } : { max_count: PAGE_SIZE, cursor }
    const result = await tikTokPost<VideoPage>(`${TIKTOK_VIDEO_LIST_PATH}?fields=${VIDEO_FIELDS}`, body)

    videos.push(...(result.videos ?? []))

    if (!result.has_more) {
      break
    }

    cursor = result.cursor
  }

  return videos.filter((video) => video.share_url).map(toPostMetrics)
}
