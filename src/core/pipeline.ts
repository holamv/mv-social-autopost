import { getEnv } from '../config/env.js'
import type { Deadline } from './deadline.js'
import { CHANNEL_PUBLISHERS } from './publishers.js'
import { resolveRoutes } from './routes.js'
import { listPendingImages } from '../drive/listPending.js'
import { claimImage, markAsPublished, releaseImage, storeChannelPostId } from '../drive/marking.js'
import type {
  ApiResponse,
  ChannelPostIds,
  FailedImage,
  PendingImage,
  PublishRoute,
  PublishRunSummary,
  PublishedImage,
  RouteQueue,
} from '../types.js'

const RUN_ERROR_MESSAGE = 'No se pudo completar la publicacion programada'

interface BatchOutcome {
  published: PublishedImage[]
  failed: FailedImage[]
  skipped: number
}

async function publishImage(image: PendingImage, route: PublishRoute, deadline: Deadline): Promise<PublishedImage> {
  await claimImage(image.id)

  const postIds: ChannelPostIds = { ...image.postIds }

  for (const channel of route.channels) {
    if (postIds[channel]) {
      continue
    }

    const postId = await CHANNEL_PUBLISHERS[channel](image, deadline)

    postIds[channel] = postId
    await storeChannelPostId(image.id, channel, postId)
  }

  await markAsPublished(image.id, route)

  return { fileId: image.id, name: image.name, route: route.label, postIds }
}

async function publishQueue(queue: RouteQueue, deadline: Deadline, outcome: BatchOutcome): Promise<void> {
  if (queue.route.disabledReason) {
    return
  }

  for (const image of queue.pending.slice(0, getEnv().BATCH_SIZE)) {
    if (deadline.isExpired()) {
      outcome.skipped += 1
      continue
    }

    try {
      outcome.published.push(await publishImage(image, queue.route, deadline))
    } catch (error) {
      console.error(`[Pipeline] Error publicando ${queue.route.label}/${image.name}:`, error)
      outcome.failed.push({ fileId: image.id, name: image.name, route: queue.route.label, error: String(error) })
      await releaseImage(image.id)
    }
  }
}

export async function listQueues(): Promise<RouteQueue[]> {
  const routes = await resolveRoutes()

  return Promise.all(routes.map(async (route) => ({ route, pending: await listPendingImages(route.sourceFolderId, route.mimePrefixes) })))
}

export async function runPublishCycle(deadline: Deadline): Promise<ApiResponse<PublishRunSummary>> {
  try {
    const queues = await listQueues()
    const outcome: BatchOutcome = { published: [], failed: [], skipped: 0 }

    for (const queue of queues) {
      await publishQueue(queue, deadline, outcome)
    }

    const pendingCount = queues.reduce((total, queue) => total + queue.pending.length, 0)

    return { success: true, data: { pendingCount, ...outcome } }
  } catch (error) {
    console.error('[Pipeline] Error en el ciclo de publicacion:', error)

    return {
      success: false,
      data: { pendingCount: 0, published: [], failed: [], skipped: 0 },
      error: RUN_ERROR_MESSAGE,
    }
  }
}
