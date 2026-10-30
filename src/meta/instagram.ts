import { getEnv } from '../config/env.js'
import {
  resolveInstagramAccount,
  toInstagramCountry,
  type InstagramAccount,
  type InstagramCountry,
} from '../config/instagramAccounts.js'
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
const USERNAME_FIELD = 'username'

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

export function instagramAccountFor(country: InstagramCountry): InstagramAccount | null {
  return resolveInstagramAccount(getEnv(), country)
}

export function countryOrFail(fileId: string, storedCountry: string | null): InstagramCountry {
  if (storedCountry === null) {
    return getEnv().META_INSTAGRAM_COUNTRY
  }

  const country = toInstagramCountry(storedCountry)

  if (!country) {
    console.warn(`[Instagram] El archivo ${fileId} pide un pais desconocido: ${storedCountry}`)
    throw new MetaApiError(`El archivo pide el pais de Instagram "${storedCountry}", que el autopost no conoce`, HTTP_INTERNAL_ERROR)
  }

  return country
}

export function requireInstagramAccount(fileId: string, storedCountry: string | null): InstagramAccount {
  const country = countryOrFail(fileId, storedCountry)
  const account = instagramAccountFor(country)

  if (!account) {
    console.warn(`[Instagram] Sin cuenta de ${country} para publicar el archivo ${fileId}`)
    throw new MetaApiError(`Falta conectar la cuenta de Instagram de ${country} (META_INSTAGRAM_USER_ID_${country})`, HTTP_INTERNAL_ERROR)
  }

  return account
}

export async function fetchInstagramUsername(account: InstagramAccount): Promise<string | null> {
  const profile = await graphGet<{ username?: string }>(account.userId, USERNAME_FIELD, account.accessToken)

  return profile.username || null
}

async function waitForContainer(containerId: string, deadline: Deadline, accessToken: string): Promise<void> {
  for (let attempt = 0; attempt < INSTAGRAM_POLL_ATTEMPTS; attempt += 1) {
    if (deadline.remainingMs() < INSTAGRAM_POLL_DELAY_MS) {
      throw new MetaApiError(`Sin tiempo para esperar el contenedor ${containerId}`, HTTP_INTERNAL_ERROR)
    }

    const status = await graphGet<ContainerStatusResponse>(containerId, INSTAGRAM_STATUS_FIELD, accessToken)

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
  account: InstagramAccount,
): Promise<string> {
  const container = await graphPost<ContainerResponse>(
    `${account.userId}/${GRAPH_MEDIA_EDGE}`,
    { [IMAGE_URL_PARAM]: imageUrl, [CAPTION_PARAM]: caption },
    account.accessToken,
  )

  await waitForContainer(container.id, deadline, account.accessToken)

  const published = await graphPost<ContainerResponse>(
    `${account.userId}/${GRAPH_MEDIA_PUBLISH_EDGE}`,
    { [CREATION_ID_PARAM]: container.id },
    account.accessToken,
  )

  return published.id
}
