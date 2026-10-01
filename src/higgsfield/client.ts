import { z } from 'zod'
import { getEnv } from '../config/env.js'
import { HTTP_METHOD_POST } from '../config/constants.js'
import { CONTENT_TYPE_HEADER, JSON_CONTENT_TYPE } from '../discord/constants.js'
import {
  HIGGSFIELD_API_BASE_URL,
  HIGGSFIELD_AUTH_SCHEME,
  HIGGSFIELD_KEY_SEPARATOR,
  HIGGSFIELD_WEBHOOK_PARAM,
  IDEMPOTENCY_KEY_HEADER,
  TERMINAL_STATUSES,
} from './constants.js'

const mediaOutputSchema = z.object({ url: z.string().url() })

const requestStatusSchema = z.object({
  request_id: z.string().uuid(),
  status: z.string(),
  error: z.string().nullish(),
  video: mediaOutputSchema.nullish(),
})

export type RequestStatus = z.infer<typeof requestStatusSchema>

export class HiggsfieldError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HiggsfieldError'
  }
}

export function isHiggsfieldConfigured(): boolean {
  const env = getEnv()

  return Boolean(env.HF_API_KEY_ID && env.HF_API_KEY_SECRET)
}

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

function authorizationHeader(): string {
  const env = getEnv()

  return `${HIGGSFIELD_AUTH_SCHEME} ${env.HF_API_KEY_ID ?? ''}${HIGGSFIELD_KEY_SEPARATOR}${env.HF_API_KEY_SECRET ?? ''}`
}

async function readStatus(response: Response): Promise<RequestStatus> {
  if (!response.ok) {
    throw new HiggsfieldError(`Higgsfield respondio ${response.status}: ${await response.text()}`)
  }

  const parsed = requestStatusSchema.safeParse(await response.json())

  if (!parsed.success) {
    throw new HiggsfieldError('Higgsfield devolvio una respuesta con formato inesperado')
  }

  return parsed.data
}

export async function submitVideo(prompt: string, webhookUrl: string, idempotencyKey: string): Promise<RequestStatus> {
  const url = new URL(`/${getEnv().HF_VIDEO_MODEL}`, HIGGSFIELD_API_BASE_URL)

  url.searchParams.set(HIGGSFIELD_WEBHOOK_PARAM, webhookUrl)

  const response = await fetch(url, {
    method: HTTP_METHOD_POST,
    headers: {
      Authorization: authorizationHeader(),
      [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
      [IDEMPOTENCY_KEY_HEADER]: idempotencyKey,
    },
    body: JSON.stringify({ prompt }),
  })

  return readStatus(response)
}

export async function fetchRequestStatus(requestId: string): Promise<RequestStatus> {
  const url = new URL(`/requests/${encodeURIComponent(requestId)}/status`, HIGGSFIELD_API_BASE_URL)

  return readStatus(await fetch(url, { headers: { Authorization: authorizationHeader() } }))
}
