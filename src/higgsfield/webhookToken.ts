import { createHmac, timingSafeEqual } from 'node:crypto'
import { getEnv } from '../config/env.js'
import { SIGNATURE_ALGORITHM, SIGNATURE_ENCODING } from '../config/constants.js'
import { WEBHOOK_ROUTE, WEBHOOK_TOKEN_PARAM, WEBHOOK_TOKEN_PURPOSE } from './constants.js'

function expectedToken(): string {
  return createHmac(SIGNATURE_ALGORITHM, getEnv().MEDIA_SIGNING_SECRET).update(WEBHOOK_TOKEN_PURPOSE).digest(SIGNATURE_ENCODING)
}

export function buildWebhookUrl(): string {
  const url = new URL(WEBHOOK_ROUTE, getEnv().PUBLIC_BASE_URL)

  url.searchParams.set(WEBHOOK_TOKEN_PARAM, expectedToken())

  return url.toString()
}

export function isValidWebhookToken(token: string | null): boolean {
  if (!token) {
    return false
  }

  const encoder = new TextEncoder()
  const expected = encoder.encode(expectedToken())
  const received = encoder.encode(token)

  return expected.length === received.length && timingSafeEqual(expected, received)
}
