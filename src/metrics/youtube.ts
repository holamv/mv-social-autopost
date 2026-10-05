import { getYouTubeClient } from '../youtube/auth.js'
import { toCount, toIsoDate } from './numbers.js'
import type { PostMetrics } from './types.js'

const RECENT_VIDEO_LIMIT = 50
const CHANNEL_PARTS = ['contentDetails']
const STATISTICS_PARTS = ['statistics']
const PLAYLIST_PARTS = ['contentDetails']
const VIDEO_PARTS = ['statistics', 'snippet']
const SHORTS_URL_PREFIX = 'https://www.youtube.com/shorts/'

export async function collectYouTube(): Promise<PostMetrics[]> {
  const youtube = await getYouTubeClient()
  const channels = await youtube.channels.list({ part: CHANNEL_PARTS, mine: true })
  const uploads = channels.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads

  if (!uploads) {
    throw new Error('El canal conectado no tiene lista de subidas')
  }

  const playlist = await youtube.playlistItems.list({ part: PLAYLIST_PARTS, playlistId: uploads, maxResults: RECENT_VIDEO_LIMIT })
  const ids = (playlist.data.items ?? []).map((item) => item.contentDetails?.videoId).filter((id): id is string => Boolean(id))

  if (ids.length === 0) {
    return []
  }

  const videos = await youtube.videos.list({ part: VIDEO_PARTS, id: ids })

  return (videos.data.items ?? []).map((video) => ({
    network: 'youtube',
    url: `${SHORTS_URL_PREFIX}${video.id}`,
    publishedAt: toIsoDate(video.snippet?.publishedAt),
    metrics: {
      views: toCount(video.statistics?.viewCount),
      likes: toCount(video.statistics?.likeCount),
      comments: toCount(video.statistics?.commentCount),
      shares: null,
    },
  }))
}

export async function readYouTubeSubscribers(): Promise<number | null> {
  const youtube = await getYouTubeClient()
  const channels = await youtube.channels.list({ part: STATISTICS_PARTS, mine: true })
  const statistics = channels.data.items?.[0]?.statistics

  return statistics?.hiddenSubscriberCount ? null : toCount(statistics?.subscriberCount)
}
