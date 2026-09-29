import { collectFacebook, collectInstagram } from './meta.js'
import { collectTikTok } from './tiktok.js'
import { collectYouTube } from './youtube.js'
import type { MetricsNetwork, MetricsReport, PostMetrics } from './types.js'

const COLLECTORS: Record<MetricsNetwork, () => Promise<PostMetrics[]>> = {
  facebook: collectFacebook,
  instagram: collectInstagram,
  youtube: collectYouTube,
  tiktok: collectTikTok,
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function collectMetrics(): Promise<MetricsReport> {
  const networks = Object.keys(COLLECTORS) as MetricsNetwork[]
  const results = await Promise.allSettled(networks.map((network) => COLLECTORS[network]()))
  const report: MetricsReport = { updatedAt: new Date().toISOString(), networks: [], failures: {}, posts: [] }

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
