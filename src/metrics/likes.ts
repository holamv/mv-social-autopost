import { resolveFacebookPage, type FacebookPageVariables } from '../config/facebookPages.js'
import {
  INSTAGRAM_COUNTRIES,
  resolveInstagramAccount,
  type InstagramAccountVariables,
  type InstagramCountry,
} from '../config/instagramAccounts.js'
import { graphGet } from '../meta/client.js'
import { describeError } from './errors.js'
import { toCount, toIsoDate } from './numbers.js'
import type { CountryPostMetrics, LikesReport, MetricsNetwork, PostMetrics } from './types.js'

const RECENT_POST_LIMIT = 50
const FACEBOOK_LIKES_FIELDS = 'permalink_url,created_time,reactions.summary(total_count).limit(0)'
const INSTAGRAM_LIKES_FIELDS = 'permalink,timestamp,like_count'

export type MetaAccountVariables = InstagramAccountVariables & FacebookPageVariables

export interface LikesSource {
  id: string
  read: () => Promise<CountryPostMetrics[]>
}

export interface LikesPlan {
  sources: LikesSource[]
  missing: string[]
}

interface GraphList<T> {
  data?: T[]
}

interface FacebookPost {
  permalink_url?: string
  created_time?: string
  reactions?: { summary?: { total_count?: number } }
}

interface InstagramMedia {
  permalink?: string
  timestamp?: string
  like_count?: number
}

function sourceId(network: MetricsNetwork, country: InstagramCountry): string {
  return `${network}-${country}`
}

function likesPost(network: MetricsNetwork, country: InstagramCountry | null, url: string, publishedAt: unknown, likes: unknown): CountryPostMetrics {
  return { network, country, url, publishedAt: toIsoDate(publishedAt), metrics: { likes: toCount(likes) } }
}

async function readInstagramLikes(userId: string, accessToken: string, country: InstagramCountry): Promise<CountryPostMetrics[]> {
  const payload = await graphGet<GraphList<InstagramMedia>>(`${userId}/media?limit=${RECENT_POST_LIMIT}`, INSTAGRAM_LIKES_FIELDS, accessToken)

  return (payload.data ?? [])
    .filter((media) => media.permalink)
    .map((media) => likesPost('instagram', country, media.permalink ?? '', media.timestamp, media.like_count))
}

async function readFacebookLikes(pageId: string, accessToken: string, country: InstagramCountry): Promise<CountryPostMetrics[]> {
  const payload = await graphGet<GraphList<FacebookPost>>(`${pageId}/posts?limit=${RECENT_POST_LIMIT}`, FACEBOOK_LIKES_FIELDS, accessToken)

  return (payload.data ?? [])
    .filter((post) => post.permalink_url)
    .map((post) => likesPost('facebook', country, post.permalink_url ?? '', post.created_time, post.reactions?.summary?.total_count))
}

export function metaLikesPlan(variables: MetaAccountVariables): LikesPlan {
  const plan: LikesPlan = { sources: [], missing: [] }

  INSTAGRAM_COUNTRIES.forEach((country) => {
    const account = resolveInstagramAccount(variables, country)
    const page = resolveFacebookPage(variables, country)

    if (account) {
      plan.sources.push({ id: sourceId('instagram', country), read: () => readInstagramLikes(account.userId, account.accessToken, country) })
    } else {
      plan.missing.push(sourceId('instagram', country))
    }

    if (page) {
      plan.sources.push({ id: sourceId('facebook', country), read: () => readFacebookLikes(page.pageId, page.accessToken, country) })
    } else {
      plan.missing.push(sourceId('facebook', country))
    }
  })

  return plan
}

export function brandSource(network: MetricsNetwork, collect: () => Promise<PostMetrics[]>): LikesSource {
  return {
    id: network,
    read: async () => (await collect()).map((post) => likesPost(network, null, post.url, post.publishedAt, post.metrics.likes)),
  }
}

export async function collectLikes(plan: LikesPlan): Promise<LikesReport> {
  const results = await Promise.allSettled(plan.sources.map((source) => source.read()))
  const report: LikesReport = { updatedAt: new Date().toISOString(), sources: [], failures: {}, missing: plan.missing, posts: [] }

  plan.sources.forEach((source, index) => {
    const result = results[index]

    if (result?.status === 'fulfilled') {
      report.sources.push(source.id)
      report.posts.push(...result.value)
      return
    }

    console.error(`[Metrics] Error leyendo likes de ${source.id}:`, result?.reason)
    report.failures[source.id] = describeError(result?.reason)
  })

  if (plan.missing.length > 0) {
    console.warn(`[Metrics] Cuentas sin configurar, sin likes: ${plan.missing.join(', ')}`)
  }

  return report
}
