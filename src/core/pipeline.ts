import { getEnv } from '../config/env.js'
import type { Deadline } from './deadline.js'
import { CHANNEL_PUBLISHERS } from './publishers.js'
import { resolveRoutes } from './routes.js'
import { currentLocalHour, isDue, loadSchedules } from './schedule.js'
import { listPendingImages } from '../drive/listPending.js'
import { claimImage, markAsPublished, releaseImage, storeChannelPostId } from '../drive/marking.js'
import { proposeFile } from '../tiktok/proposal.js'
import type {
  ApiResponse,
  ChannelPostIds,
  FailedImage,
  PendingImage,
  ProposedFile,
  PublishRoute,
  PublishRunSummary,
  PublishedImage,
  RouteKey,
  RouteQueue,
} from '../types.js'

const RUN_ERROR_MESSAGE = 'No se pudo completar la publicacion programada'

interface BatchOutcome {
  published: PublishedImage[]
  proposed: ProposedFile[]
  failed: FailedImage[]
  skipped: number
}

function emptyOutcome(): BatchOutcome {
  return { published: [], proposed: [], failed: [], skipped: 0 }
}

async function proposeQueue(queue: RouteQueue, outcome: BatchOutcome): Promise<void> {
  const unproposed = queue.pending.filter((file) => !file.tikTokMessageId).slice(0, getEnv().BATCH_SIZE)

  for (const file of unproposed) {
    try {
      await proposeFile(file)
      outcome.proposed.push({ fileId: file.id, name: file.name, route: queue.route.label })
    } catch (error) {
      console.error(`[Pipeline] Error proponiendo ${queue.route.label}/${file.name}:`, error)
      outcome.failed.push({ fileId: file.id, name: file.name, route: queue.route.label, error: String(error) })
    }
  }
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

  if (queue.route.mode === 'approval') {
    await proposeQueue(queue, outcome)
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

export interface CycleOptions {
  routeKey?: RouteKey
  respectSchedule?: boolean
}

async function selectRoutes(options: CycleOptions): Promise<PublishRoute[]> {
  const routes = (await resolveRoutes()).filter((route) => !options.routeKey || route.key === options.routeKey)

  if (!options.respectSchedule) {
    return routes
  }

  const schedules = await loadSchedules()
  const localHour = currentLocalHour(new Date())

  return routes.filter((route) => isDue(schedules[route.key], localHour))
}

export async function listQueues(options: CycleOptions = {}): Promise<RouteQueue[]> {
  const routes = await selectRoutes(options)

  return Promise.all(routes.map(async (route) => ({ route, pending: await listPendingImages(route.sourceFolderId, route.mimePrefixes) })))
}

export async function runPublishCycle(
  deadline: Deadline,
  options: CycleOptions = {},
): Promise<ApiResponse<PublishRunSummary>> {
  try {
    const queues = await listQueues(options)
    const outcome = emptyOutcome()

    for (const queue of queues) {
      await publishQueue(queue, deadline, outcome)
    }

    const pendingCount = queues.reduce((total, queue) => total + queue.pending.length, 0)

    return { success: true, data: { pendingCount, ...outcome } }
  } catch (error) {
    console.error('[Pipeline] Error en el ciclo de publicacion:', error)

    return {
      success: false,
      data: { pendingCount: 0, ...emptyOutcome() },
      error: RUN_ERROR_MESSAGE,
    }
  }
}
