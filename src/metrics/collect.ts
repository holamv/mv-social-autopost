import { collectFacebook, collectInstagram, readFacebookFollowers, readInstagramFollowers } from './meta.js'
import { collectTikTok, readTikTokFollowers } from './tiktok.js'
import { collectYouTube, readYouTubeSubscribers } from './youtube.js'
import type { FollowerCounts, MetricsNetwork, MetricsReport, PostMetrics } from './types.js'

const COLLECTORS: Record<MetricsNetwork, () => Promise<PostMetrics[]>> = {
  facebook: collectFacebook,
  instagram: collectInstagram,
  youtube: collectYouTube,
  tiktok: collectTikTok,
}

const FOLLOWER_READERS: Record<MetricsNetwork, () => Promise<number | null>> = {
  facebook: readFacebookFollowers,
  instagram: readInstagramFollowers,
  youtube: readYouTubeSubscribers,
  tiktok: readTikTokFollowers,
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function readFollowerCounts(networks: MetricsNetwork[]): Promise<FollowerCounts> {
  const results = await Promise.allSettled(networks.map((network) => FOLLOWER_READERS[network]()))
  const followers: FollowerCounts = { facebook: null, instagram: null, youtube: null, tiktok: null }

  networks.forEach((network, index) => {
    const result = results[index]

    if (result?.status === 'fulfilled') {
      followers[network] = result.value
      return
    }

    console.error(`[Metrics] Error leyendo seguidores de ${network}:`, result?.reason)
  })

  return followers
}

export async function collectMetrics(): Promise<MetricsReport> {
  const networks = Object.keys(COLLECTORS) as MetricsNetwork[]
  const [results, followers] = await Promise.all([
    Promise.allSettled(networks.map((network) => COLLECTORS[network]())),
    readFollowerCounts(networks),
  ])
  const report: MetricsReport = { updatedAt: new Date().toISOString(), networks: [], failures: {}, followers, posts: [] }

  networks.forEach((network, index) => {
    const result = results[index]

    if (!result) {
      return
    }

    if (result.status === 'fulfilled') {
      report.networks.push(network)
      report.posts.push(...result.value)
      return
    }

    console.error(`[Metrics] Error leyendo ${network}:`, result.reason)
    report.failures[network] = describeError(result.reason)
  })

  return report
}
