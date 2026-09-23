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

export interface PendingImage {
  id: string
  name: string
  order: number
  caption: string
  lockedAt: string | null
  facebookPostId: string | null
}

export interface PublishedImage {
  fileId: string
  name: string
  facebookPostId: string
  instagramMediaId: string
}

export interface FailedImage {
  fileId: string
  name: string
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
