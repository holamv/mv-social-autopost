export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: string
  meta?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type Channel = 'facebook' | 'instagram' | 'linkedin'

export type ChannelPostIds = Partial<Record<Channel, string>>

export interface PendingImage {
  id: string
  name: string
  order: number
  caption: string
  mimeType: string
  sizeBytes: number
  lockedAt: string | null
  postIds: ChannelPostIds
  linkedInMediaUrn: string | null
}

export interface PublishRoute {
  label: string
  sourceFolderId: string
  channels: Channel[]
  mimePrefixes: string[]
  publishedFolderId: string | null
  disabledReason: string | null
}

export interface RouteQueue {
  route: PublishRoute
  pending: PendingImage[]
}

export interface PublishedImage {
  fileId: string
  name: string
  route: string
  postIds: ChannelPostIds
}

export interface FailedImage {
  fileId: string
  name: string
  route: string
  error: string
}

export interface PublishRunSummary {
  pendingCount: number
  published: PublishedImage[]
  failed: FailedImage[]
  skipped: number
}

export interface DriveImage {
  fileId: string
  name: string
  mimeType: string
  sizeBytes: number
  buffer: Buffer
}

export interface MoveResult {
  fileId: string
  parents: string[]
  moved: boolean
}
