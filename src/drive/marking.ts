import type { drive_v3 } from 'googleapis'
import { getEnv } from '../config/env'
import { getDriveClient } from './client'
import { moveFile } from './move'
import {
  FACEBOOK_POST_ID_KEY,
  INSTAGRAM_MEDIA_ID_KEY,
  LOCKED_AT_KEY,
  PUBLISHED_AT_KEY,
  STATUS_KEY,
  STATUS_PUBLISHED,
} from '../config/constants'

const MOVE_STRATEGY = 'move'

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

export async function storeFacebookPostId(fileId: string, facebookPostId: string): Promise<void> {
  await patchAppProperties(fileId, { [FACEBOOK_POST_ID_KEY]: facebookPostId })
}

async function moveToPublishedFolder(fileId: string): Promise<void> {
  const env = getEnv()

  if (!env.DRIVE_PUBLISHED_FOLDER_ID) {
    return
  }

  await moveFile(fileId, env.DRIVE_SOURCE_FOLDER_ID, env.DRIVE_PUBLISHED_FOLDER_ID)
}

export async function markAsPublished(
  fileId: string,
  facebookPostId: string,
  instagramMediaId: string,
): Promise<void> {
  await patchAppProperties(fileId, {
    [STATUS_KEY]: STATUS_PUBLISHED,
    [PUBLISHED_AT_KEY]: new Date().toISOString(),
    [FACEBOOK_POST_ID_KEY]: facebookPostId,
    [INSTAGRAM_MEDIA_ID_KEY]: instagramMediaId,
    [LOCKED_AT_KEY]: null,
  })

  if (getEnv().MARK_STRATEGY === MOVE_STRATEGY) {
    await moveToPublishedFolder(fileId)
  }
}
