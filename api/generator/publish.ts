import { createHash, timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getEnv } from '../../src/config/env.js'
import {
  AUTHORIZATION_HEADER,
  BEARER_PREFIX,
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_ERROR,
  HTTP_METHOD_GET,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_METHOD_POST,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  SIGNATURE_ALGORITHM,
} from '../../src/config/constants.js'
import { SubmissionError, generatorStatus, submissionSchema, submitFromGenerator } from '../../src/generator/submit.js'

const HTTP_SERVICE_UNAVAILABLE = 503
const HTTP_BAD_GATEWAY = 502
const DISABLED_MESSAGE = 'Falta GENERATOR_API_TOKEN: la publicacion desde el generador esta apagada'
const UNAUTHORIZED_MESSAGE = 'No autorizado'
const METHOD_MESSAGE = 'Metodo no permitido'

function digest(value: string): Uint8Array {
  return new Uint8Array(createHash(SIGNATURE_ALGORITHM).update(value).digest())
}

function isAuthorized(request: VercelRequest, token: string): boolean {
  const received = request.headers[AUTHORIZATION_HEADER]

  return typeof received === 'string' && timingSafeEqual(digest(received), digest(`${BEARER_PREFIX}${token}`))
}

function fail(response: VercelResponse, status: number, error: string): void {
  response.status(status).json({ success: false, data: null, error })
}

async function handlePublish(request: VercelRequest, response: VercelResponse): Promise<void> {
  const parsed = submissionSchema.safeParse(request.body)

  if (!parsed.success) {
    fail(response, HTTP_BAD_REQUEST, parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
    return
  }

  try {
    response.status(HTTP_OK).json({ success: true, data: await submitFromGenerator(parsed.data) })
  } catch (error) {
    console.error('[Generator] Error publicando desde el generador:', error)
    const status = error instanceof SubmissionError ? error.status : HTTP_BAD_GATEWAY
    fail(response, status, error instanceof Error ? error.message : String(error))
  }
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  const token = getEnv().GENERATOR_API_TOKEN

  if (!token) {
    fail(response, HTTP_SERVICE_UNAVAILABLE, DISABLED_MESSAGE)
    return
  }

  if (!isAuthorized(request, token)) {
    fail(response, HTTP_UNAUTHORIZED, UNAUTHORIZED_MESSAGE)
    return
  }

  if (request.method === HTTP_METHOD_GET) {
    response.status(HTTP_OK).json({ success: true, data: await generatorStatus().catch(() => null) })
    return
  }

  if (request.method !== HTTP_METHOD_POST) {
    fail(response, HTTP_METHOD_NOT_ALLOWED, METHOD_MESSAGE)
    return
  }

  await handlePublish(request, response).catch((error) => fail(response, HTTP_INTERNAL_ERROR, String(error)))
}
