import { Readable } from 'node:stream'
import { getEnv } from '../config/env.js'
import {
  BYTES_PER_MEGABYTE,
  LINKEDIN_FOLDER_NAME,
  MAX_VIDEO_MEGABYTES,
  TIKTOK_FOLDER_NAME,
  YOUTUBE_FOLDER_NAME,
} from '../config/constants.js'
import { findChildFolder } from '../drive/folders.js'
import { uploadFile, type UploadedFile } from '../drive/upload.js'
import {
  CONTENT_LENGTH_HEADER,
  GENERATED_FILE_EXTENSION,
  GENERATED_FILE_PREFIX,
  GENERATED_VIDEO_MIME_TYPE,
  ISO_DATE_LENGTH,
  REQUEST_ID_PROPERTY,
  SHORT_ID_LENGTH,
  STORAGE_QUOTA_ERROR,
} from './constants.js'
import type { GenerationJob, VideoRouteKey } from './jobs.js'

export const VIDEO_ROUTE_FOLDERS: Record<VideoRouteKey, string> = {
  linkedin: LINKEDIN_FOLDER_NAME,
  tiktok: TIKTOK_FOLDER_NAME,
  youtube: YOUTUBE_FOLDER_NAME,
}

export class DeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeliveryError'
  }
}

export function buildFileName(job: GenerationJob): string {
  const date = job.createdAt.slice(0, ISO_DATE_LENGTH)
  const shortId = job.requestId.slice(0, SHORT_ID_LENGTH)

  return `${GENERATED_FILE_PREFIX}-${date}-${shortId}${GENERATED_FILE_EXTENSION}`
}

async function resolveFolder(routeKey: VideoRouteKey): Promise<string> {
  const folderName = VIDEO_ROUTE_FOLDERS[routeKey]
  const folderId = await findChildFolder(getEnv().DRIVE_SOURCE_FOLDER_ID, folderName)

  if (!folderId) {
    throw new DeliveryError(`No existe la carpeta ${folderName}/ dentro de la carpeta de origen en Drive`)
  }

  return folderId
}

async function* readChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = body.getReader()

  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      yield chunk.value
    }
  } finally {
    reader.releaseLock()
  }
}

async function openVideoStream(videoUrl: string): Promise<Readable> {
  const response = await fetch(videoUrl)

  if (!response.ok || !response.body) {
    throw new DeliveryError(`No pude bajar el video de Higgsfield (${response.status})`)
  }

  const megabytes = Number(response.headers.get(CONTENT_LENGTH_HEADER) ?? 0) / BYTES_PER_MEGABYTE

  if (megabytes > MAX_VIDEO_MEGABYTES) {
    throw new DeliveryError(`El video pesa ${megabytes.toFixed(1)} MB y el limite es ${MAX_VIDEO_MEGABYTES} MB`)
  }

  return Readable.from(readChunks(response.body))
}

function translateDriveError(error: unknown): unknown {
  if (error instanceof Error && STORAGE_QUOTA_ERROR.test(error.message)) {
    return new DeliveryError(
      'La cuenta de servicio no puede crear archivos en un Drive personal. La carpeta de origen tiene que estar en una unidad compartida.',
    )
  }

  return error
}

export async function deliverVideo(job: GenerationJob, videoUrl: string): Promise<UploadedFile> {
  const folderId = await resolveFolder(job.routeKey)
  const body = await openVideoStream(videoUrl)

  try {
    return await uploadFile({
      folderId,
      name: buildFileName(job),
      mimeType: GENERATED_VIDEO_MIME_TYPE,
      body,
      appProperties: { [REQUEST_ID_PROPERTY]: job.requestId },
    })
  } catch (error) {
    throw translateDriveError(error)
  }
}
