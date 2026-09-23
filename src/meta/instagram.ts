import { getEnv } from '../config/env.js'
import type { Deadline } from '../core/deadline.js'
import { graphGet, graphPost, MetaApiError } from './client.js'
import {
  GRAPH_MEDIA_EDGE,
  GRAPH_MEDIA_PUBLISH_EDGE,
  HTTP_INTERNAL_ERROR,
  INSTAGRAM_POLL_ATTEMPTS,
  INSTAGRAM_POLL_DELAY_MS,
  INSTAGRAM_STATUS_ERROR,
  INSTAGRAM_STATUS_FIELD,
  INSTAGRAM_STATUS_FINISHED,
} from '../config/constants.js'

const IMAGE_URL_PARAM = 'image_url'
const CAPTION_PARAM = 'caption'
const CREATION_ID_PARAM = 'creation_id'

interface ContainerResponse {
  id: string
}

interface ContainerStatusResponse {
  status_code: string
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

async function waitForContainer(containerId: string, deadline: Deadline): Promise<void> {
  for (let attempt = 0; attempt < INSTAGRAM_POLL_ATTEMPTS; attempt += 1) {
    if (deadline.remainingMs() < INSTAGRAM_POLL_DELAY_MS) {
      throw new MetaApiError(`Sin tiempo para esperar el contenedor ${containerId}`, HTTP_INTERNAL_ERROR)
    }

    const status = await graphGet<ContainerStatusResponse>(containerId, INSTAGRAM_STATUS_FIELD)

    if (status.status_code === INSTAGRAM_STATUS_FINISHED) {
      return
    }

    if (status.status_code === INSTAGRAM_STATUS_ERROR) {
      throw new MetaApiError(`Instagram rechazo el contenedor ${containerId}`, HTTP_INTERNAL_ERROR)
    }

    await wait(INSTAGRAM_POLL_DELAY_MS)
  }

  throw new MetaApiError(`El contenedor ${containerId} no termino de procesarse`, HTTP_INTERNAL_ERROR)
}

export async function publishToInstagram(
  imageUrl: string,
  caption: string,
  deadline: Deadline,
): Promise<string> {
  const env = getEnv()

  const container = await graphPost<ContainerResponse>(`${env.META_INSTAGRAM_USER_ID}/${GRAPH_MEDIA_EDGE}`, {
    [IMAGE_URL_PARAM]: imageUrl,
    [CAPTION_PARAM]: caption,
  })

  await waitForContainer(container.id, deadline)

  const published = await graphPost<ContainerResponse>(
    `${env.META_INSTAGRAM_USER_ID}/${GRAPH_MEDIA_PUBLISH_EDGE}`,
    { [CREATION_ID_PARAM]: container.id },
  )

  return published.id
}