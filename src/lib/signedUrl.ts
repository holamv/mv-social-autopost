import { createHmac, timingSafeEqual } from 'node:crypto'
import { getEnv } from '../config/env'
import {
  MEDIA_EXPIRES_PARAM,
  MEDIA_FILE_PARAM,
  MEDIA_ROUTE,
  MEDIA_SIGNATURE_PARAM,
  MEDIA_URL_TTL_MINUTES,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  SIGNATURE_ALGORITHM,
  SIGNATURE_ENCODING,
  SIGNATURE_SEPARATOR,
} from '../config/constants'

function sign(fileId: string, expiresAt: number, secret: string): string {
  return createHmac(SIGNATURE_ALGORITHM, secret)
    .update(`${fileId}${SIGNATURE_SEPARATOR}${expiresAt}`)
    .digest(SIGNATURE_ENCODING)
}

export function buildSignedMediaUrl(fileId: string): string {
  const env = getEnv()
  const ttl = MEDIA_URL_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND
  const expiresAt = Date.now() + ttl
  const url = new URL(MEDIA_ROUTE, env.PUBLIC_BASE_URL)

  url.searchParams.set(MEDIA_FILE_PARAM, fileId)
  url.searchParams.set(MEDIA_EXPIRES_PARAM, String(expiresAt))
  url.searchParams.set(MEDIA_SIGNATURE_PARAM, sign(fileId, expiresAt, env.MEDIA_SIGNING_SECRET))

  return url.toString()
}

export function isValidMediaRequest(fileId: string, expiresAt: number, signature: string): boolean {
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false
  }

  const encoder = new TextEncoder()
  const expected = encoder.encode(sign(fileId, expiresAt, getEnv().MEDIA_SIGNING_SECRET))
  const received = encoder.encode(signature)

  if (expected.length !== received.length) {
    return false
  }

  return timingSafeEqual(expected, received)
}
