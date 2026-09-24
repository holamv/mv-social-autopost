import { createPrivateKey } from 'node:crypto'
import { ESCAPED_PRIVATE_KEY_NEWLINE, REAL_NEWLINE } from './constants.js'

const JSON_OBJECT_START = '{'
const SERVICE_ACCOUNT_KEY_FIELD = 'private_key'
const WRAPPING_QUOTES = /^(["'])([\s\S]*)\1$/

function extractFromServiceAccountJson(value: string): string {
  if (!value.startsWith(JSON_OBJECT_START)) {
    return value
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const key = parsed[SERVICE_ACCOUNT_KEY_FIELD]

    return typeof key === 'string' ? key : value
  } catch {
    return value
  }
}

function stripWrappingQuotes(value: string): string {
  return value.replace(WRAPPING_QUOTES, '$2')
}

export function normalizePrivateKey(raw: string): string {
  const unwrapped = stripWrappingQuotes(extractFromServiceAccountJson(raw.trim()).trim())

  return unwrapped.replace(ESCAPED_PRIVATE_KEY_NEWLINE, REAL_NEWLINE).trim() + REAL_NEWLINE
}

export function isReadablePrivateKey(key: string): boolean {
  try {
    createPrivateKey(key)
    return true
  } catch {
    return false
  }
}
