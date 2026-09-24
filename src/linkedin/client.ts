import { getEnv, type Env } from '../config/env.js'
import { HTTP_METHOD_POST, MS_PER_SECOND } from '../config/constants.js'
import {
  AUTHORIZATION_HEADER,
  CONTENT_TYPE_HEADER,
  JSON_CONTENT_TYPE,
  LINKEDIN_API_BASE_URL,
  LINKEDIN_TOKEN_URL,
  LINKEDIN_VERSION_HEADER,
  REFRESH_GRANT_TYPE,
  RESTLI_PROTOCOL_HEADER,
  RESTLI_PROTOCOL_VERSION,
  TOKEN_EXPIRY_SAFETY_MS,
} from './constants.js'

export class LinkedInApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'LinkedInApiError'
  }
}

interface CachedToken {
  value: string
  expiresAt: number
}

interface TokenResponse {
  access_token: string
  expires_in: number
}

let cachedToken: CachedToken | null = null

export function linkedInDisabledReason(env: Env): string | null {
  if (!env.LINKEDIN_ORGANIZATION_ID) {
    return 'falta LINKEDIN_ORGANIZATION_ID'
  }

  const canRefresh = env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET && env.LINKEDIN_REFRESH_TOKEN

  return env.LINKEDIN_ACCESS_TOKEN || canRefresh ? null : 'falta LINKEDIN_ACCESS_TOKEN'
}

async function refreshAccessToken(env: Env): Promise<CachedToken> {
  const body = new URLSearchParams({
    grant_type: REFRESH_GRANT_TYPE,
    refresh_token: env.LINKEDIN_REFRESH_TOKEN ?? '',
    client_id: env.LINKEDIN_CLIENT_ID ?? '',
    client_secret: env.LINKEDIN_CLIENT_SECRET ?? '',
  })
  const response = await fetch(LINKEDIN_TOKEN_URL, { method: HTTP_METHOD_POST, body })

  if (!response.ok) {
    throw new LinkedInApiError(`No se pudo renovar el token de LinkedIn: ${await response.text()}`, response.status)
  }

  const payload = (await response.json()) as TokenResponse

  return { value: payload.access_token, expiresAt: Date.now() + payload.expires_in * MS_PER_SECOND }
}

async function getAccessToken(): Promise<string> {
  const env = getEnv()

  if (!env.LINKEDIN_REFRESH_TOKEN) {
    return env.LINKEDIN_ACCESS_TOKEN ?? ''
  }

  if (!cachedToken || cachedToken.expiresAt - TOKEN_EXPIRY_SAFETY_MS < Date.now()) {
    cachedToken = await refreshAccessToken(env)
  }

  return cachedToken.value
}

export async function authorizationHeader(): Promise<Record<string, string>> {
  return { [AUTHORIZATION_HEADER]: `Bearer ${await getAccessToken()}` }
}

export async function linkedInRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = {
    ...(await authorizationHeader()),
    [LINKEDIN_VERSION_HEADER]: getEnv().LINKEDIN_API_VERSION,
    [RESTLI_PROTOCOL_HEADER]: RESTLI_PROTOCOL_VERSION,
    [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
    ...init.headers,
  }
  const response = await fetch(`${LINKEDIN_API_BASE_URL}/${path}`, { ...init, headers })

  if (!response.ok) {
    throw new LinkedInApiError(`LinkedIn respondio ${response.status} en ${path}: ${await response.text()}`, response.status)
  }

  return response
}

export async function linkedInPost<T>(path: string, body: unknown): Promise<T> {
  const response = await linkedInRequest(path, { method: HTTP_METHOD_POST, body: JSON.stringify(body) })

  return (await response.json()) as T
}
