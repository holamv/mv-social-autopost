export type MetricsNetwork = 'facebook' | 'instagram' | 'youtube' | 'tiktok'

export type MetricValues = Record<string, number | null>

export interface PostMetrics {
  network: MetricsNetwork
  url: string
  publishedAt: string | null
  metrics: MetricValues
}

export interface MetricsReport {
  updatedAt: string
  networks: MetricsNetwork[]
  failures: Partial<Record<MetricsNetwork, string>>
  posts: PostMetrics[]
}
