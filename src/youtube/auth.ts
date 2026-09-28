import { google, type youtube_v3 } from 'googleapis'
import { getEnv, type Env } from '../config/env.js'
import { kvGet, kvSet } from '../lib/kv.js'

const CALLBACK_ROUTE = '/api/youtube/callback'
const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
const OFFLINE_ACCESS = 'offline'
const FORCE_CONSENT = 'consent'
const TOKEN_STORE_KEY = 'youtube:tokens'
const API_VERSION = 'v3'
const TOKENS_EVENT = 'tokens'

interface StoredTokens {
  refreshToken: string
}

export function youTubeDisabledReason(env: Env): string | null {
  const required: [string, unknown][] = [
    ['YOUTUBE_CLIENT_ID', env.YOUTUBE_CLIENT_ID],
    ['YOUTUBE_CLIENT_SECRET', env.YOUTUBE_CLIENT_SECRET],
    ['KV_REST_API_URL', env.KV_REST_API_URL],
    ['KV_REST_API_TOKEN', env.KV_REST_API_TOKEN],
  ]
  const missing = required.filter(([, value]) => !value).map(([name]) => name)

  return missing.length > 0 ? `falta ${missing.join(', ')}` : null
}

function createOAuthClient() {
  const env = getEnv()

  return new google.auth.OAuth2(
    env.YOUTUBE_CLIENT_ID,
    env.YOUTUBE_CLIENT_SECRET,
    new URL(CALLBACK_ROUTE, env.PUBLIC_BASE_URL).toString(),
  )
}

export function buildYouTubeAuthorizeUrl(state: string): string {
  return createOAuthClient().generateAuthUrl({
    access_type: OFFLINE_ACCESS,
    prompt: FORCE_CONSENT,
    scope: [UPLOAD_SCOPE],
    state,
  })
}

async function saveRefreshToken(refreshToken: string): Promise<void> {
  const stored: StoredTokens = { refreshToken }

  await kvSet(TOKEN_STORE_KEY, JSON.stringify(stored))
}

export async function connectYouTube(code: string): Promise<void> {
  const { tokens } = await createOAuthClient().getToken(code)

  if (!tokens.refresh_token) {
    throw new Error('Google no devolvio refresh token: quita el acceso de la app en la cuenta de Google y vuelve a conectar')
  }

  await saveRefreshToken(tokens.refresh_token)
}

export async function getYouTubeClient(): Promise<youtube_v3.Youtube> {
  const raw = await kvGet(TOKEN_STORE_KEY)

  if (!raw) {
    throw new Error('El canal de YouTube no esta conectado: usa /conectar-youtube en Discord')
  }

  const auth = createOAuthClient()

  auth.setCredentials({ refresh_token: (JSON.parse(raw) as StoredTokens).refreshToken })
  auth.on(TOKENS_EVENT, (tokens) => {
    if (tokens.refresh_token) {
      saveRefreshToken(tokens.refresh_token).catch((error: unknown) => {
        console.error('[YouTubeAuth] Error guardando el refresh token nuevo:', error)
      })
    }
  })

  return google.youtube({ version: API_VERSION, auth })
}
