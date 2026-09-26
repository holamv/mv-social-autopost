import type { Deadline } from '../core/deadline.js'
import { BYTES_PER_MEGABYTE, MAX_VIDEO_MEGABYTES } from '../config/constants.js'
import type { PendingImage } from '../types.js'
import { fetchPublishStatus, queryCreatorInfo, TikTokApiError, tikTokPost, type CreatorInfo } from './api.js'
import {
  FILE_UPLOAD_SOURCE,
  STATUS_FAILED,
  STATUS_POLL_DELAY_MS,
  STATUS_PUBLISH_COMPLETE,
  TIKTOK_VIDEO_INIT_PATH,
  TITLE_MAX_LENGTH,
} from './constants.js'
import { planChunks, uploadChunks } from './upload.js'

const INVALID_PRIVACY_CODE = 'invalid_privacy'
const TOO_LARGE_CODE = 'file_too_large'

interface InitResponse {
  publish_id: string
  upload_url: string
}

export interface TikTokPublishResult {
  publishId: string
  completed: boolean
}

function assertPublishable(file: PendingImage, privacy: string, creator: CreatorInfo): void {
  if (!creator.privacy_level_options.includes(privacy)) {
    throw new TikTokApiError(`La privacidad ${privacy} no esta permitida para esta cuenta`, INVALID_PRIVACY_CODE)
  }

  if (file.sizeBytes / BYTES_PER_MEGABYTE > MAX_VIDEO_MEGABYTES) {
    throw new TikTokApiError(`${file.name} supera el limite de ${MAX_VIDEO_MEGABYTES} MB`, TOO_LARGE_CODE)
  }
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

async function waitForPublish(publishId: string, deadline: Deadline): Promise<boolean> {
  while (deadline.remainingMs() > STATUS_POLL_DELAY_MS) {
    const status = await fetchPublishStatus(publishId)

    if (status.status === STATUS_PUBLISH_COMPLETE) {
      return true
    }

    if (status.status === STATUS_FAILED) {
      throw new TikTokApiError(`TikTok no pudo publicar el video: ${status.fail_reason ?? 'sin motivo'}`, STATUS_FAILED)
    }

    await wait(STATUS_POLL_DELAY_MS)
  }

  return false
}

export async function publishTikTokVideo(
  file: PendingImage,
  privacy: string,
  deadline: Deadline,
): Promise<TikTokPublishResult> {
  const creator = await queryCreatorInfo()

  assertPublishable(file, privacy, creator)

  const plan = planChunks(file.sizeBytes)
  const init = await tikTokPost<InitResponse>(TIKTOK_VIDEO_INIT_PATH, {
    post_info: {
      title: file.caption.slice(0, TITLE_MAX_LENGTH),
      privacy_level: privacy,
      disable_comment: creator.comment_disabled,
      disable_duet: creator.duet_disabled,
      disable_stitch: creator.stitch_disabled,
    },
    source_info: {
      source: FILE_UPLOAD_SOURCE,
      video_size: file.sizeBytes,
      chunk_size: plan.chunkSize,
      total_chunk_count: plan.totalChunkCount,
    },
  })

  await uploadChunks(init.upload_url, file, plan, deadline)

  return { publishId: init.publish_id, completed: await waitForPublish(init.publish_id, deadline) }
}
