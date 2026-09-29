import { HTTP_METHOD_POST } from '../config/constants.js'
import { JSON_UTF8_CONTENT_TYPE, OK_ERROR_CODE, TIKTOK_API_BASE_URL, TIKTOK_CREATOR_INFO_PATH, TIKTOK_STATUS_PATH } from './constants.js'
import { getAccessToken } from './tokens.js'

export class TikTokApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = 'TikTokApiError'
  }
}

interface TikTokEnvelope<T> {
  data: T
  error?: { code: string; message: string }
}

export interface CreatorInfo {
  creator_nickname: string
  creator_username: string
  privacy_level_options: string[]
  comment_disabled: boolean
  duet_disabled: boolean
  stitch_disabled: boolean
  max_video_post_duration_sec: number
}

export interface PublishStatus {
  status: string
  fail_reason?: string
}

export async function tikTokPost<T>(path: string, body: unknown = {}): Promise<T> {
  const response = await fetch(`${TIKTOK_API_BASE_URL}/${path}`, {
    method: HTTP_METHOD_POST,
    headers: { Authorization: `Bearer ${await getAccessToken()}`, 'Content-Type': JSON_UTF8_CONTENT_TYPE },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as TikTokEnvelope<T>
  const code = payload.error?.code ?? String(response.status)

  if (!response.ok || code !== OK_ERROR_CODE) {
    throw new TikTokApiError(`TikTok respondio ${code} en ${path}: ${payload.error?.message ?? ''}`, code)
  }

  return payload.data
}

export function queryCreatorInfo(): Promise<CreatorInfo> {
  return tikTokPost<CreatorInfo>(TIKTOK_CREATOR_INFO_PATH)
}

export function fetchPublishStatus(publishId: string): Promise<PublishStatus> {
  return tikTokPost<PublishStatus>(TIKTOK_STATUS_PATH, { publish_id: publishId })
}
