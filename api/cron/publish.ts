import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getEnv } from '../../src/config/env'
import { createDeadline } from '../../src/core/deadline'
import { runPublishCycle } from '../../src/core/pipeline'
import {
  AUTHORIZATION_HEADER,
  BEARER_PREFIX,
  HTTP_INTERNAL_ERROR,
  HTTP_METHOD_GET,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_MULTI_STATUS,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
} from '../../src/config/constants'
import type { ApiResponse, PublishRunSummary } from '../../src/types'

const UNAUTHORIZED_MESSAGE = 'No autorizado'
const METHOD_MESSAGE = 'Metodo no permitido'
const CONFIG_MESSAGE = 'Configuracion invalida del servicio'

function isAuthorized(request: VercelRequest, cronSecret: string): boolean {
  return request.headers[AUTHORIZATION_HEADER] === `${BEARER_PREFIX}${cronSecret}`
}

function resolveStatus(result: ApiResponse<PublishRunSummary>): number {
  if (!result.success) {
    return HTTP_INTERNAL_ERROR
  }

  if (result.data.failed.length === 0) {
    return HTTP_OK
  }

  return result.data.published.length > 0 ? HTTP_MULTI_STATUS : HTTP_INTERNAL_ERROR
}

function readCronSecret(response: VercelResponse): string | null {
  try {
    return getEnv().CRON_SECRET
  } catch (error) {
    console.error('[CronPublish] Error de configuracion:', error)
    response.status(HTTP_INTERNAL_ERROR).json({ success: false, data: null, error: CONFIG_MESSAGE })

    return null
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== HTTP_METHOD_GET) {
    response.status(HTTP_METHOD_NOT_ALLOWED).json({ success: false, data: null, error: METHOD_MESSAGE })
    return
  }

  const cronSecret = readCronSecret(response)

  if (!cronSecret) {
    return
  }

  if (!isAuthorized(request, cronSecret)) {
    response.status(HTTP_UNAUTHORIZED).json({ success: false, data: null, error: UNAUTHORIZED_MESSAGE })
    return
  }

  const startedAt = Date.now()
  const result = await runPublishCycle(createDeadline())

  console.log(`[CronPublish] Ciclo terminado en ${Date.now() - startedAt} ms`)

  response.status(resolveStatus(result)).json(result)
}
