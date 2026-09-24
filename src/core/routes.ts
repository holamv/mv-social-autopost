import { getEnv, type Env } from '../config/env.js'
import {
  FACEBOOK_FOLDER_NAME,
  IMAGE_MIME_PREFIX,
  INSTAGRAM_FOLDER_NAME,
  LINKEDIN_FOLDER_NAME,
  ROOT_ROUTE_LABEL,
  VIDEO_MIME_PREFIX,
} from '../config/constants.js'
import { linkedInDisabledReason } from '../linkedin/client.js'
import { findChildFolder } from '../drive/folders.js'
import type { Channel, PublishRoute } from '../types.js'

const MOVE_STRATEGY = 'move'

const IMAGES_ONLY = [IMAGE_MIME_PREFIX]
const IMAGES_AND_VIDEOS = [IMAGE_MIME_PREFIX, VIDEO_MIME_PREFIX]

interface ChannelFolder {
  folderName: string
  channels: Channel[]
  mimePrefixes: string[]
  disabledReason: (env: Env) => string | null
}

const ALWAYS_ENABLED = (): null => null

const CHANNEL_FOLDERS: ChannelFolder[] = [
  { folderName: FACEBOOK_FOLDER_NAME, channels: ['facebook'], mimePrefixes: IMAGES_ONLY, disabledReason: ALWAYS_ENABLED },
  { folderName: INSTAGRAM_FOLDER_NAME, channels: ['instagram'], mimePrefixes: IMAGES_ONLY, disabledReason: ALWAYS_ENABLED },
  {
    folderName: LINKEDIN_FOLDER_NAME,
    channels: ['linkedin'],
    mimePrefixes: IMAGES_AND_VIDEOS,
    disabledReason: linkedInDisabledReason,
  },
]

const ROOT_CHANNELS: Channel[] = ['facebook', 'instagram']

async function resolvePublishedChild(publishedRootId: string | null, folderName: string): Promise<string | null> {
  if (!publishedRootId) {
    return null
  }

  const folderId = await findChildFolder(publishedRootId, folderName)

  if (!folderId) {
    console.warn(`[Routes] Falta la carpeta Publicados/${folderName}: se marcara sin mover`)
  }

  return folderId
}

async function resolveChannelRoute(
  channelFolder: ChannelFolder,
  sourceRootId: string,
  publishedRootId: string | null,
): Promise<PublishRoute | null> {
  const sourceFolderId = await findChildFolder(sourceRootId, channelFolder.folderName)

  if (!sourceFolderId) {
    return null
  }

  return {
    label: channelFolder.folderName,
    sourceFolderId,
    channels: channelFolder.channels,
    mimePrefixes: channelFolder.mimePrefixes,
    publishedFolderId: await resolvePublishedChild(publishedRootId, channelFolder.folderName),
    disabledReason: channelFolder.disabledReason(getEnv()),
  }
}

export async function resolveRoutes(): Promise<PublishRoute[]> {
  const env = getEnv()
  const publishedRootId = env.MARK_STRATEGY === MOVE_STRATEGY ? env.DRIVE_PUBLISHED_FOLDER_ID || null : null

  const rootRoute: PublishRoute = {
    label: ROOT_ROUTE_LABEL,
    sourceFolderId: env.DRIVE_SOURCE_FOLDER_ID,
    channels: ROOT_CHANNELS,
    mimePrefixes: IMAGES_ONLY,
    publishedFolderId: publishedRootId,
    disabledReason: null,
  }

  const channelRoutes = await Promise.all(
    CHANNEL_FOLDERS.map((channelFolder) =>
      resolveChannelRoute(channelFolder, env.DRIVE_SOURCE_FOLDER_ID, publishedRootId),
    ),
  )

  return [rootRoute, ...channelRoutes.filter((route): route is PublishRoute => route !== null)]
}
