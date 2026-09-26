import { createHmac, timingSafeEqual } from 'node:crypto'
import { getEnv } from '../config/env.js'
import {
  DECIMAL_RADIX,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  SIGNATURE_ALGORITHM,
  SIGNATURE_ENCODING,
  SIGNATURE_SEPARATOR,
} from '../config/constants.js'
import { OAUTH_STATE_PURPOSE, OAUTH_STATE_TTL_MINUTES } from './constants.js'

function sign(expiresAt: number): string {
  return createHmac(SIGNATURE_ALGORITHM, getEnv().MEDIA_SIGNING_SECRET)
    .update(`${OAUTH_STATE_PURPOSE}${SIGNATURE_SEPARATOR}${expiresAt}`)
    .digest(SIGNATURE_ENCODING)
}

export function createOAuthState(): string {
  const expiresAt = Date.now() + OAUTH_STATE_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND

  return `${expiresAt}${SIGNATURE_SEPARATOR}${sign(expiresAt)}`
}

export function isValidOAuthState(state: string): boolean {
  const [expiresPart = '', signature = ''] = state.split(SIGNATURE_SEPARATOR)
  const expiresAt = Number.parseInt(expiresPart, DECIMAL_RADIX)

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false
  }

  const encoder = new TextEncoder()
  const expected = encoder.encode(sign(expiresAt))
  const received = encoder.encode(signature)

  return expected.length === received.length && timingSafeEqual(expected, received)
}
