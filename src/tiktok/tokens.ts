import { getEnv, type Env } from '../config/env.js'
import { HTTP_METHOD_POST, MS_PER_SECOND } from '../config/constants.js'
import { kvGet, kvSet } from '../lib/kv.js'
import {
  AUTHORIZATION_CODE_GRANT,
  FORM_CONTENT_TYPE,
  REFRESH_TOKEN_GRANT,
  RESPONSE_TYPE_CODE,
  TIKTOK_API_BASE_URL,
  TIKTOK_AUTHORIZE_URL,
  TIKTOK_CALLBACK_ROUTE,
  TIKTOK_SCOPES,
  TIKTOK_TOKEN_PATH,
  TOKEN_EXPIRY_SAFETY_MS,
  TOKEN_STORE_KEY,
} from './constants.js'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_expires_in?: number
  open_id?: string
  error?: string
  error_description?: string
}

interface StoredTokens {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
  refreshExpiresAt: number
  openId: string
}

export function tikTokDisabledReason(env: Env): string | null {
  const required: [string, unknown][] = [
    ['TIKTOK_CLIENT_KEY', env.TIKTOK_CLIENT_KEY],
    ['TIKTOK_CLIENT_SECRET', env.TIKTOK_CLIENT_SECRET],
    ['KV_REST_API_URL', env.KV_REST_API_URL],
    ['KV_REST_API_TOKEN', env.KV_REST_API_TOKEN],
    ['DISCORD_BOT_TOKEN', env.DISCORD_BOT_TOKEN],
    ['DISCORD_TIKTOK_CHANNEL_ID', env.DISCORD_TIKTOK_CHANNEL_ID],
  ]
  const missing = required.filter(([, value]) => !value).map(([name]) => name)

  return missing.length > 0 ? `falta ${missing.join(', ')}` : null
}

function redirectUri(): string {
  return new URL(TIKTOK_CALLBACK_ROUTE, getEnv().PUBLIC_BASE_URL).toString()
}

export function buildAuthorizeUrl(state: string): string {
  const url = new URL(TIKTOK_AUTHORIZE_URL)

  url.searchParams.set('client_key', getEnv().TIKTOK_CLIENT_KEY ?? '')
  url.searchParams.set('scope', TIKTOK_SCOPES)
  url.searchParams.set('response_type', RESPONSE_TYPE_CODE)
  url.searchParams.set('redirect_uri', redirectUri())
  url.searchParams.set('state', state)

  return url.toString()
}

async function requestTokens(params: Record<string, string>): Promise<StoredTokens> {
  const env = getEnv()
  const body = new URLSearchParams({
    client_key: env.TIKTOK_CLIENT_KEY ?? '',
    client_secret: env.TIKTOK_CLIENT_SECRET ?? '',
    ...params,
  })
  const response = await fetch(`${TIKTOK_API_BASE_URL}/${TIKTOK_TOKEN_PATH}`, {
    method: HTTP_METHOD_POST,
    headers: { 'Content-Type': FORM_CONTENT_TYPE },
    body,
  })
  const payload = (await response.json()) as TokenResponse

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(`TikTok rechazo el token: ${payload.error_description ?? payload.error ?? response.status}`)
  }

  const now = Date.now()

  return {
    accessToken: payload.access_token,
    accessExpiresAt: now + (payload.expires_in ?? 0) * MS_PER_SECOND,
    refreshToken: payload.refresh_token,
    refreshExpiresAt: now + (payload.refresh_expires_in ?? 0) * MS_PER_SECOND,
    openId: payload.open_id ?? '',
  }
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await kvSet(TOKEN_STORE_KEY, JSON.stringify(tokens))
}

export async function connectWithCode(code: string): Promise<void> {
  await saveTokens(await requestTokens({ code, grant_type: AUTHORIZATION_CODE_GRANT, redirect_uri: redirectUri() }))
}

export async function getAccessToken(): Promise<string> {
  const raw = await kvGet(TOKEN_STORE_KEY)

  if (!raw) {
    throw new Error('La cuenta de TikTok no esta conectada: usa /conectar-tiktok en Discord')
  }

  const tokens = JSON.parse(raw) as StoredTokens

  if (tokens.accessExpiresAt - TOKEN_EXPIRY_SAFETY_MS > Date.now()) {
    return tokens.accessToken
  }

  const refreshed = await requestTokens({ grant_type: REFRESH_TOKEN_GRANT, refresh_token: tokens.refreshToken })
  await saveTokens(refreshed)

  return refreshed.accessToken
}
