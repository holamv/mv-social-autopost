import type { drive_v3 } from 'googleapis'
import { getEnv } from '../config/env.js'
import { getDriveClient } from './client.js'
import { parseFileOrder, sortByOrder } from './ordering.js'
import {
  DRIVE_FILE_COLLECTION,
  DRIVE_FILE_PROPERTIES,
  DRIVE_MAX_PAGES,
  DRIVE_PAGE_TOKEN_FIELD,
  DRIVE_PAGE_SIZE,
  CHANNEL_POST_ID_KEYS,
  LINKEDIN_MEDIA_URN_KEY,
  LOCKED_AT_KEY,
  LOCK_TTL_MINUTES,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  STATUS_KEY,
  STATUS_PUBLISHED,
  FIELD_SEPARATOR,
} from '../config/constants.js'
import type { Channel, ChannelPostIds, PendingImage } from '../types.js'

function buildFieldsSelector(): string {
  const properties = DRIVE_FILE_PROPERTIES.join(FIELD_SEPARATOR)

  return [DRIVE_PAGE_TOKEN_FIELD, `${DRIVE_FILE_COLLECTION}(${properties})`].join(FIELD_SEPARATOR)
}

function buildMimeFilter(mimePrefixes: string[]): string {
  return `(${mimePrefixes.map((prefix) => `mimeType contains '${prefix}'`).join(' or ')})`
}

function buildPendingQuery(folderId: string, mimePrefixes: string[]): string {
  return [
    `'${folderId}' in parents`,
    'trashed = false',
    buildMimeFilter(mimePrefixes),
    `not appProperties has { key='${STATUS_KEY}' and value='${STATUS_PUBLISHED}' }`,
  ].join(' and ')
}

function readPostIds(properties: Record<string, string>): ChannelPostIds {
  const postIds: ChannelPostIds = {}

  for (const [channel, key] of Object.entries(CHANNEL_POST_ID_KEYS) as [Channel, string][]) {
    const postId = properties[key]

    if (postId) {
      postIds[channel] = postId
    }
  }

  return postIds
}

function toPendingImage(file: drive_v3.Schema$File, defaultCaption: string): PendingImage {
  const properties = file.appProperties ?? {}

  return {
    id: file.id ?? '',
    name: file.name ?? '',
    order: parseFileOrder(file.name ?? ''),
    caption: file.description?.trim() || defaultCaption,
    lockedAt: properties[LOCKED_AT_KEY] ?? null,
    mimeType: file.mimeType ?? '',
    sizeBytes: Number(file.size ?? 0),
    postIds: readPostIds(properties),
    linkedInMediaUrn: properties[LINKEDIN_MEDIA_URN_KEY] ?? null,
  }
}

export function isLocked(image: PendingImage, now: number): boolean {
  if (!image.lockedAt) {
    return false
  }

  const lockAge = now - new Date(image.lockedAt).getTime()

  return lockAge < LOCK_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND
}

export async function listPendingImages(folderId: string, mimePrefixes: string[]): Promise<PendingImage[]> {
  const env = getEnv()
  const drive = getDriveClient()
  const collected: PendingImage[] = []
  let pageToken: string | undefined

  for (let page = 0; page < DRIVE_MAX_PAGES; page += 1) {
    const response = await drive.files.list({
      q: buildPendingQuery(folderId, mimePrefixes),
      fields: buildFieldsSelector(),
      pageSize: DRIVE_PAGE_SIZE,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    for (const file of response.data.files ?? []) {
      collected.push(toPendingImage(file, env.DEFAULT_CAPTION))
    }

    pageToken = response.data.nextPageToken ?? undefined

    if (!pageToken) {
      break
    }
  }

  const now = Date.now()

  return sortByOrder(collected.filter((image) => image.id && !isLocked(image, now)))
}
