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

export const OAUTH_STATE_TTL_MINUTES = 10

export type OAuthPurpose = 'tiktok' | 'youtube'

function sign(purpose: OAuthPurpose, expiresAt: number): string {
  return createHmac(SIGNATURE_ALGORITHM, getEnv().MEDIA_SIGNING_SECRET)
    .update(`${purpose}${SIGNATURE_SEPARATOR}${expiresAt}`)
    .digest(SIGNATURE_ENCODING)
}

export function createOAuthState(purpose: OAuthPurpose): string {
  const expiresAt = Date.now() + OAUTH_STATE_TTL_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND

  return `${expiresAt}${SIGNATURE_SEPARATOR}${sign(purpose, expiresAt)}`
}

export function isValidOAuthState(purpose: OAuthPurpose, state: string): boolean {
  const [expiresPart = '', signature = ''] = state.split(SIGNATURE_SEPARATOR)
  const expiresAt = Number.parseInt(expiresPart, DECIMAL_RADIX)

  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false
  }

  const encoder = new TextEncoder()
  const expected = encoder.encode(sign(purpose, expiresAt))
  const received = encoder.encode(signature)

  return expected.length === received.length && timingSafeEqual(expected, received)
}
