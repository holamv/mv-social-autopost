import { createPublicKey, verify, type KeyObject } from 'node:crypto'
import {
  BASE64URL_ENCODING,
  HEX_ENCODING,
  SIGNATURE_CURVE,
  SIGNATURE_KEY_FORMAT,
  SIGNATURE_KEY_TYPE,
} from './constants.js'

let cachedKey: KeyObject | null = null
let cachedKeyHex: string | null = null

function toPublicKey(publicKeyHex: string): KeyObject {
  if (cachedKey && cachedKeyHex === publicKeyHex) {
    return cachedKey
  }

  cachedKey = createPublicKey({
    key: {
      kty: SIGNATURE_KEY_TYPE,
      crv: SIGNATURE_CURVE,
      x: Buffer.from(publicKeyHex, HEX_ENCODING).toString(BASE64URL_ENCODING),
    },
    format: SIGNATURE_KEY_FORMAT,
  })
  cachedKeyHex = publicKeyHex

  return cachedKey
}

export function isValidDiscordSignature(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): boolean {
  if (!signatureHex || !timestamp) {
    return false
  }

  try {
    const signature = new Uint8Array(Buffer.from(signatureHex, HEX_ENCODING))
    const signedPayload = new TextEncoder().encode(`${timestamp}${rawBody}`)

    return verify(null, signedPayload, toPublicKey(publicKeyHex), signature)
  } catch (error) {
    console.error('[DiscordVerify] Error verificando firma:', error)
    return false
  }
}
