import type { drive_v3 } from 'googleapis'
import { getEnv } from '../config/env'
import { getDriveClient } from './client'
import { parseFileOrder, sortByOrder } from './ordering'
import {
  DRIVE_FILE_COLLECTION,
  DRIVE_FILE_PROPERTIES,
  DRIVE_MAX_PAGES,
  DRIVE_PAGE_TOKEN_FIELD,
  DRIVE_PAGE_SIZE,
  FACEBOOK_POST_ID_KEY,
  IMAGE_MIME_PREFIX,
  LOCKED_AT_KEY,
  LOCK_TTL_MINUTES,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  STATUS_KEY,
  STATUS_PUBLISHED,
  FIELD_SEPARATOR,
} from '../config/constants'
import type { PendingImage } from '../types'

function buildFieldsSelector(): string {
  const properties = DRIVE_FILE_PROPERTIES.join(FIELD_SEPARATOR)

  return [DRIVE_PAGE_TOKEN_FIELD, `${DRIVE_FILE_COLLECTION}(${properties})`].join(FIELD_SEPARATOR)
}

function buildPendingQuery(folderId: string): string {
  return [
    `'${folderId}' in parents`,
    'trashed = false',
    `mimeType contains '${IMAGE_MIME_PREFIX}'`,
    `not appProperties has { key='${STATUS_KEY}' and value='${STATUS_PUBLISHED}' }`,
  ].join(' and ')
}

function toPendingImage(file: drive_v3.Schema$File, defaultCaption: string): PendingImage {
  const properties = file.appProperties ?? {}

  return {
    id: file.id ?? '',
    name: file.name ?? '',
    order: parseFileOrder(file.name ?? ''),
    caption: file.description?.trim() || defaultCaption,
    lockedAt: properties[LOCKED_AT_KEY] ?? null,
    facebookPostId: properties[FACEBOOK_POST_ID_KEY] ?? null,
  }
}

export function isLocked(image: PendingImage, now: number): boolean {
  if (!image.lockedAt) {
    return false
  }

  const lockAge = now - new Date(image.lockedAt).getTime()

  return lockAge < LOCK_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND
}

export async function listPendingImages(): Promise<PendingImage[]> {
  const env = getEnv()
  const drive = getDriveClient()
  const collected: PendingImage[] = []
  let pageToken: string | undefined

  for (let page = 0; page < DRIVE_MAX_PAGES; page += 1) {
    const response = await drive.files.list({
      q: buildPendingQuery(env.DRIVE_SOURCE_FOLDER_ID),
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
