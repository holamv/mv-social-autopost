import { getEnv } from '../config/env.js'
import { FACEBOOK_FOLDER_NAME, INSTAGRAM_FOLDER_NAME, ROOT_ROUTE_LABEL } from '../config/constants.js'
import { findChildFolder } from '../drive/folders.js'
import type { Channel, PublishRoute } from '../types.js'

const MOVE_STRATEGY = 'move'

interface ChannelFolder {
  folderName: string
  channels: Channel[]
}

const CHANNEL_FOLDERS: ChannelFolder[] = [
  { folderName: FACEBOOK_FOLDER_NAME, channels: ['facebook'] },
  { folderName: INSTAGRAM_FOLDER_NAME, channels: ['instagram'] },
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
    publishedFolderId: await resolvePublishedChild(publishedRootId, channelFolder.folderName),
  }
}

export async function resolveRoutes(): Promise<PublishRoute[]> {
  const env = getEnv()
  const publishedRootId = env.MARK_STRATEGY === MOVE_STRATEGY ? env.DRIVE_PUBLISHED_FOLDER_ID || null : null

  const rootRoute: PublishRoute = {
    label: ROOT_ROUTE_LABEL,
    sourceFolderId: env.DRIVE_SOURCE_FOLDER_ID,
    channels: ROOT_CHANNELS,
    publishedFolderId: publishedRootId,
  }

  const channelRoutes = await Promise.all(
    CHANNEL_FOLDERS.map((channelFolder) =>
      resolveChannelRoute(channelFolder, env.DRIVE_SOURCE_FOLDER_ID, publishedRootId),
    ),
  )

  return [rootRoute, ...channelRoutes.filter((route): route is PublishRoute => route !== null)]
}
