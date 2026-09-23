import { getEnv } from '../config/env'
import {
  GRAPH_API_VERSION,
  GRAPH_BASE_URL,
  HTTP_METHOD_GET,
  HTTP_METHOD_POST,
} from '../config/constants'

const ACCESS_TOKEN_PARAM = 'access_token'
const FIELDS_PARAM = 'fields'

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

function buildUrl(path: string): URL {
  return new URL(`/${GRAPH_API_VERSION}/${path}`, GRAPH_BASE_URL)
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: { message?: string } }

  if (!response.ok) {
    throw new MetaApiError(payload.error?.message ?? response.statusText, response.status)
  }

  return payload
}

export async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams({ ...params, [ACCESS_TOKEN_PARAM]: getEnv().META_GRAPH_ACCESS_TOKEN })
  const response = await fetch(buildUrl(path), { method: HTTP_METHOD_POST, body })

  return parseResponse<T>(response)
}

export async function graphUpload<T>(path: string, form: FormData): Promise<T> {
  form.append(ACCESS_TOKEN_PARAM, getEnv().META_GRAPH_ACCESS_TOKEN)

  const response = await fetch(buildUrl(path), { method: HTTP_METHOD_POST, body: form })

  return parseResponse<T>(response)
}

export async function graphGet<T>(path: string, fields: string): Promise<T> {
  const url = buildUrl(path)

  url.searchParams.set(FIELDS_PARAM, fields)
  url.searchParams.set(ACCESS_TOKEN_PARAM, getEnv().META_GRAPH_ACCESS_TOKEN)

  const response = await fetch(url, { method: HTTP_METHOD_GET })

  return parseResponse<T>(response)
}
