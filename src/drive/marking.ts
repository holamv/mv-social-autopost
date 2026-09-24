import type { drive_v3 } from 'googleapis'
import { getDriveClient } from './client.js'
import { moveFile } from './move.js'
import {
  CHANNEL_POST_ID_KEYS,
  LOCKED_AT_KEY,
  PUBLISHED_AT_KEY,
  STATUS_KEY,
  STATUS_PUBLISHED,
} from '../config/constants.js'
import type { Channel, PublishRoute } from '../types.js'

type AppPropertyPatch = Record<string, string | null>

async function patchAppProperties(fileId: string, appProperties: AppPropertyPatch): Promise<void> {
  const drive = getDriveClient()
  const requestBody = { appProperties } as unknown as drive_v3.Schema$File

  await drive.files.update({ fileId, requestBody, supportsAllDrives: true })
}

export async function claimImage(fileId: string): Promise<void> {
  await patchAppProperties(fileId, { [LOCKED_AT_KEY]: new Date().toISOString() })
}

export async function releaseImage(fileId: string): Promise<void> {
  await patchAppProperties(fileId, { [LOCKED_AT_KEY]: null })
}

export async function storeChannelPostId(fileId: string, channel: Channel, postId: string): Promise<void> {
  await patchAppProperties(fileId, { [CHANNEL_POST_ID_KEYS[channel]]: postId })
}

export async function markAsPublished(fileId: string, route: PublishRoute): Promise<void> {
  await patchAppProperties(fileId, {
    [STATUS_KEY]: STATUS_PUBLISHED,
    [PUBLISHED_AT_KEY]: new Date().toISOString(),
    [LOCKED_AT_KEY]: null,
  })

  if (route.publishedFolderId) {
    await moveFile(fileId, route.sourceFolderId, route.publishedFolderId)
  }
}
