import type { Deadline } from '../core/deadline.js'
import { downloadByteRange } from '../drive/download.js'
import { TikTokApiError } from './api.js'
import { HTTP_CREATED, HTTP_PARTIAL_CONTENT, MAX_SINGLE_CHUNK_BYTES, TARGET_CHUNK_BYTES } from './constants.js'

const HTTP_METHOD_PUT = 'PUT'
const TIMEOUT_CODE = 'upload_timeout'
const REJECTED_CODE = 'upload_rejected'

export interface ChunkPlan {
  chunkSize: number
  totalChunkCount: number
}

export interface ByteRange {
  firstByte: number
  lastByte: number
}

export function planChunks(sizeBytes: number): ChunkPlan {
  if (sizeBytes <= MAX_SINGLE_CHUNK_BYTES) {
    return { chunkSize: sizeBytes, totalChunkCount: 1 }
  }

  return { chunkSize: TARGET_CHUNK_BYTES, totalChunkCount: Math.floor(sizeBytes / TARGET_CHUNK_BYTES) }
}

export function chunkRanges(sizeBytes: number, plan: ChunkPlan): ByteRange[] {
  return Array.from({ length: plan.totalChunkCount }, (_, index) => {
    const firstByte = index * plan.chunkSize
    const isLast = index === plan.totalChunkCount - 1

    return { firstByte, lastByte: isLast ? sizeBytes - 1 : firstByte + plan.chunkSize - 1 }
  })
}

export async function uploadChunks(
  uploadUrl: string,
  file: { id: string; mimeType: string; sizeBytes: number },
  plan: ChunkPlan,
  deadline: Deadline,
): Promise<void> {
  for (const range of chunkRanges(file.sizeBytes, plan)) {
    if (deadline.isExpired()) {
      throw new TikTokApiError('Sin tiempo para terminar de subir el video a TikTok', TIMEOUT_CODE)
    }

    const body = await downloadByteRange(file.id, range.firstByte, range.lastByte)
    const response = await fetch(uploadUrl, {
      method: HTTP_METHOD_PUT,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Length': String(body.byteLength),
        'Content-Range': `bytes ${range.firstByte}-${range.lastByte}/${file.sizeBytes}`,
      },
      body,
    })

    if (response.status !== HTTP_PARTIAL_CONTENT && response.status !== HTTP_CREATED) {
      throw new TikTokApiError(`TikTok rechazo una parte del video: ${response.status}`, REJECTED_CODE)
    }
  }
}
