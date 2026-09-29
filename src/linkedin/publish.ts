import type { Deadline } from '../core/deadline.js'
import { storeLinkedInMediaUrn } from '../drive/marking.js'
import {
  BYTES_PER_MEGABYTE,
  HTTP_BAD_REQUEST,
  IMAGE_MIME_PREFIX,
  MAX_VIDEO_MEGABYTES,
  VIDEO_MIME_PREFIX,
} from '../config/constants.js'
import type { PendingImage } from '../types.js'
import { LinkedInApiError } from './client.js'
import { IMAGE_URN_PREFIX } from './constants.js'
import { uploadImage, uploadVideo, waitForVideo } from './media.js'
import { createMediaPost } from './posts.js'

function assertVideoSize(file: PendingImage): void {
  const megabytes = file.sizeBytes / BYTES_PER_MEGABYTE

  if (megabytes > MAX_VIDEO_MEGABYTES) {
    throw new LinkedInApiError(
      `${file.name} pesa ${megabytes.toFixed(1)} MB y el limite es ${MAX_VIDEO_MEGABYTES} MB`,
      HTTP_BAD_REQUEST,
    )
  }
}

async function uploadMedia(file: PendingImage, deadline: Deadline): Promise<string> {
  if (file.mimeType.startsWith(IMAGE_MIME_PREFIX)) {
    return uploadImage(file.id)
  }

  if (file.mimeType.startsWith(VIDEO_MIME_PREFIX)) {
    assertVideoSize(file)
    return uploadVideo(file.id, file.sizeBytes, deadline)
  }

  throw new LinkedInApiError(`${file.name} no es imagen ni video (${file.mimeType})`, HTTP_BAD_REQUEST)
}

export async function publishToLinkedIn(file: PendingImage, deadline: Deadline): Promise<string> {
  let mediaUrn = file.linkedInMediaUrn

  if (!mediaUrn) {
    mediaUrn = await uploadMedia(file, deadline)
    await storeLinkedInMediaUrn(file.id, mediaUrn)
  }

  if (!mediaUrn.startsWith(IMAGE_URN_PREFIX)) {
    await waitForVideo(mediaUrn, deadline)
  }

  return createMediaPost(mediaUrn, file.caption)
}
