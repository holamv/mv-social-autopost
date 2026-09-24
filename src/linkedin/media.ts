import { getEnv } from '../config/env.js'
import type { Deadline } from '../core/deadline.js'
import { downloadByteRange, downloadImageToMemory } from '../drive/download.js'
import { HTTP_INTERNAL_ERROR, HTTP_METHOD_POST } from '../config/constants.js'
import { authorizationHeader, LinkedInApiError, linkedInPost, linkedInRequest } from './client.js'
import {
  BINARY_CONTENT_TYPE,
  CONTENT_TYPE_HEADER,
  ETAG_HEADER,
  IMAGES_INITIALIZE_PATH,
  ORGANIZATION_URN_PREFIX,
  VIDEOS_FINALIZE_PATH,
  VIDEOS_INITIALIZE_PATH,
  VIDEOS_PATH,
  VIDEO_POLL_DELAY_MS,
  VIDEO_STATUS_AVAILABLE,
  VIDEO_STATUS_FAILED,
} from './constants.js'

const HTTP_METHOD_PUT = 'PUT'

interface UploadInstruction {
  uploadUrl: string
  firstByte: number
  lastByte: number
}

interface ImageInitResponse {
  value: { uploadUrl: string; image: string }
}

interface VideoInitResponse {
  value: { video: string; uploadToken: string; uploadInstructions: UploadInstruction[] }
}

interface VideoStatusResponse {
  status: string
  processingFailureReason?: string
}

function organizationUrn(): string {
  return `${ORGANIZATION_URN_PREFIX}${getEnv().LINKEDIN_ORGANIZATION_ID ?? ''}`
}

async function putBinary(uploadUrl: string, body: Uint8Array<ArrayBuffer>): Promise<Response> {
  const headers = { ...(await authorizationHeader()), [CONTENT_TYPE_HEADER]: BINARY_CONTENT_TYPE }
  const response = await fetch(uploadUrl, { method: HTTP_METHOD_PUT, headers, body })

  if (!response.ok) {
    throw new LinkedInApiError(`LinkedIn rechazo la subida: ${response.status}`, response.status)
  }

  return response
}

export async function uploadImage(fileId: string): Promise<string> {
  const image = await downloadImageToMemory(fileId)
  const init = await linkedInPost<ImageInitResponse>(IMAGES_INITIALIZE_PATH, {
    initializeUploadRequest: { owner: organizationUrn() },
  })

  await putBinary(init.value.uploadUrl, new Uint8Array(image.buffer))

  return init.value.image
}

export async function uploadVideo(fileId: string, sizeBytes: number, deadline: Deadline): Promise<string> {
  const init = await linkedInPost<VideoInitResponse>(VIDEOS_INITIALIZE_PATH, {
    initializeUploadRequest: { owner: organizationUrn(), fileSizeBytes: sizeBytes, uploadCaptions: false, uploadThumbnail: false },
  })
  const partIds: string[] = []

  for (const part of init.value.uploadInstructions) {
    if (deadline.isExpired()) {
      throw new LinkedInApiError(`Sin tiempo para terminar de subir el video ${fileId}`, HTTP_INTERNAL_ERROR)
    }

    const response = await putBinary(part.uploadUrl, await downloadByteRange(fileId, part.firstByte, part.lastByte))
    partIds.push(response.headers.get(ETAG_HEADER) ?? '')
  }

  await linkedInRequest(VIDEOS_FINALIZE_PATH, {
    method: HTTP_METHOD_POST,
    body: JSON.stringify({
      finalizeUploadRequest: { video: init.value.video, uploadToken: init.value.uploadToken, uploadedPartIds: partIds },
    }),
  })

  return init.value.video
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

export async function waitForVideo(videoUrn: string, deadline: Deadline): Promise<void> {
  while (deadline.remainingMs() > VIDEO_POLL_DELAY_MS) {
    const response = await linkedInRequest(`${VIDEOS_PATH}/${encodeURIComponent(videoUrn)}`)
    const video = (await response.json()) as VideoStatusResponse

    if (video.status === VIDEO_STATUS_AVAILABLE) {
      return
    }

    if (video.status === VIDEO_STATUS_FAILED) {
      throw new LinkedInApiError(`LinkedIn no pudo procesar el video: ${video.processingFailureReason ?? 'sin motivo'}`, HTTP_INTERNAL_ERROR)
    }

    await wait(VIDEO_POLL_DELAY_MS)
  }

  throw new LinkedInApiError(`El video ${videoUrn} sigue procesandose; se publicara en la proxima corrida`, HTTP_INTERNAL_ERROR)
}
