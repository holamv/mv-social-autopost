import { getEnv } from '../config/env.js'
import { graphGet } from '../meta/client.js'
import { toCount, toIsoDate } from './numbers.js'
import type { PostMetrics } from './types.js'

const RECENT_POST_LIMIT = 50
const FACEBOOK_FIELDS = 'permalink_url,created_time,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)'
const INSTAGRAM_FIELDS = 'permalink,timestamp,like_count,comments_count'
const FACEBOOK_REACH_METRIC = 'post_impressions_unique'
const INSTAGRAM_INSIGHT_METRICS = 'views,saved'
const INSIGHT_VALUE_FIELDS = 'name,values'
const FOLLOWERS_FIELD = 'followers_count'

interface GraphList<T> {
  data?: T[]
}

interface Summary {
  summary?: { total_count?: number }
}

interface FacebookPost {
  id: string
  permalink_url?: string
  created_time?: string
  shares?: { count?: number }
  reactions?: Summary
  comments?: Summary
}

interface InstagramMedia {
  id: string
  permalink?: string
  timestamp?: string
  like_count?: number
  comments_count?: number
}

interface FollowerProfile {
  followers_count?: number
}

interface Insight {
  name: string
  values?: { value?: number }[]
}

async function readInsights(path: string): Promise<Record<string, number | null>> {
  try {
    const payload = await graphGet<GraphList<Insight>>(path, INSIGHT_VALUE_FIELDS)

    return Object.fromEntries((payload.data ?? []).map((insight) => [insight.name, toCount(insight.values?.[0]?.value)]))
  } catch {
    return {}
  }
}

async function facebookEntry(post: FacebookPost, url: string): Promise<PostMetrics> {
  const insights = await readInsights(`${post.id}/insights/${FACEBOOK_REACH_METRIC}`)

  return {
    network: 'facebook',
    url,
    publishedAt: toIsoDate(post.created_time),
    metrics: {
      reach: insights[FACEBOOK_REACH_METRIC] ?? null,
      likes: toCount(post.reactions?.summary?.total_count),
      comments: toCount(post.comments?.summary?.total_count),
      shares: toCount(post.shares?.count) ?? 0,
    },
  }
}

async function instagramEntry(media: InstagramMedia, url: string): Promise<PostMetrics> {
  const insights = await readInsights(`${media.id}/insights?metric=${INSTAGRAM_INSIGHT_METRICS}`)

  return {
    network: 'instagram',
    url,
    publishedAt: toIsoDate(media.timestamp),
    metrics: {
      views: insights.views ?? null,
      likes: toCount(media.like_count),
      comments: toCount(media.comments_count),
      saves: insights.saved ?? null,
    },
  }
}

export async function collectFacebook(): Promise<PostMetrics[]> {
  const payload = await graphGet<GraphList<FacebookPost>>(`${getEnv().META_PAGE_ID}/posts?limit=${RECENT_POST_LIMIT}`, FACEBOOK_FIELDS)
  const posts = (payload.data ?? []).filter((post) => post.permalink_url)

  return Promise.all(posts.map((post) => facebookEntry(post, post.permalink_url ?? '')))
}

export async function collectInstagram(): Promise<PostMetrics[]> {
  const payload = await graphGet<GraphList<InstagramMedia>>(
    `${getEnv().META_INSTAGRAM_USER_ID}/media?limit=${RECENT_POST_LIMIT}`,
    INSTAGRAM_FIELDS,
  )
  const media = (payload.data ?? []).filter((item) => item.permalink)

  return Promise.all(media.map((item) => instagramEntry(item, item.permalink ?? '')))
}

async function readFollowers(accountId: string): Promise<number | null> {
  const profile = await graphGet<FollowerProfile>(accountId, FOLLOWERS_FIELD)

  return toCount(profile.followers_count)
}

export function readFacebookFollowers(): Promise<number | null> {
  return readFollowers(getEnv().META_PAGE_ID)
}

export function readInstagramFollowers(): Promise<number | null> {
  return readFollowers(getEnv().META_INSTAGRAM_USER_ID)
}
