import { getEnv } from '../config/env.js'
import { HTTP_METHOD_POST } from '../config/constants.js'

interface KvResponse {
  result: string | null
  error?: string
}

async function runCommand(command: string[]): Promise<string | null> {
  const env = getEnv()

  if (!env.KV_REST_API_URL || !env.KV_REST_API_TOKEN) {
    throw new Error('Falta configurar el almacen KV (KV_REST_API_URL y KV_REST_API_TOKEN)')
  }

  const response = await fetch(env.KV_REST_API_URL, {
    method: HTTP_METHOD_POST,
    headers: { Authorization: `Bearer ${env.KV_REST_API_TOKEN}` },
    body: JSON.stringify(command),
  })
  const payload = (await response.json()) as KvResponse

  if (!response.ok || payload.error) {
    throw new Error(`El almacen KV respondio ${response.status}: ${payload.error ?? 'sin detalle'}`)
  }

  return payload.result
}

export async function kvGet(key: string): Promise<string | null> {
  return runCommand(['GET', key])
}

export async function kvSet(key: string, value: string): Promise<void> {
  await runCommand(['SET', key, value])
}
