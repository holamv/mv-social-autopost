import { createHash, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getEnv } from '../src/config/env.js'
import { collectMetrics } from '../src/metrics/collect.js'
import {
  AUTHORIZATION_HEADER,
  BEARER_PREFIX,
  HTTP_INTERNAL_ERROR,
  HTTP_METHOD_GET,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  SIGNATURE_ALGORITHM,
} from '../src/config/constants.js'

const HTTP_SERVICE_UNAVAILABLE = 503
const UNAUTHORIZED_MESSAGE = 'No autorizado'
const METHOD_MESSAGE = 'Metodo no permitido'
const CONFIG_MESSAGE = 'Configuracion invalida del servicio'
const DISABLED_MESSAGE = 'Falta METRICS_API_TOKEN: el endpoint de metricas esta apagado'
const COLLECT_MESSAGE = 'No se pudieron leer las metricas'

function digest(value: string): Uint8Array {
  return new Uint8Array(createHash(SIGNATURE_ALGORITHM).update(value).digest())
}

function isAuthorized(request: VercelRequest, token: string): boolean {
  const received = request.headers[AUTHORIZATION_HEADER]

  return typeof received === 'string' && timingSafeEqual(digest(received), digest(`${BEARER_PREFIX}${token}`))
}

function readToken(response: VercelResponse): string | null {
  try {
    const token = getEnv().METRICS_API_TOKEN

    if (!token) {
      response.status(HTTP_SERVICE_UNAVAILABLE).json({ success: false, data: null, error: DISABLED_MESSAGE })
    }

    return token ?? null
  } catch (error) {
    console.error('[Metrics] Error de configuracion:', error)
    response.status(HTTP_INTERNAL_ERROR).json({ success: false, data: null, error: CONFIG_MESSAGE })

    return null
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== HTTP_METHOD_GET) {
    response.status(HTTP_METHOD_NOT_ALLOWED).json({ success: false, data: null, error: METHOD_MESSAGE })
    return
  }

  const token = readToken(response)

  if (!token) {
    return
  }

  if (!isAuthorized(request, token)) {
    response.status(HTTP_UNAUTHORIZED).json({ success: false, data: null, error: UNAUTHORIZED_MESSAGE })
    return
  }

  try {
    response.status(HTTP_OK).json({ success: true, data: await collectMetrics() })
  } catch (error) {
    console.error('[Metrics] Error leyendo las redes:', error)
    response.status(HTTP_INTERNAL_ERROR).json({ success: false, data: null, error: COLLECT_MESSAGE })
  }
}
