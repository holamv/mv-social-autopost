import { getDiscordEnv } from './env.js'
import {
  CONTENT_TYPE_HEADER,
  DISCORD_API_BASE_URL,
  HTTP_METHOD_PATCH,
  JSON_CONTENT_TYPE,
  ORIGINAL_MESSAGE_PATH,
} from './constants.js'
import type { MessagePayload } from './components.js'

export async function editOriginalResponse(interactionToken: string, content: string | MessagePayload): Promise<void> {
  const { DISCORD_APPLICATION_ID } = getDiscordEnv()
  const url = `${DISCORD_API_BASE_URL}/webhooks/${DISCORD_APPLICATION_ID}/${interactionToken}/${ORIGINAL_MESSAGE_PATH}`
  const payload = typeof content === 'string' ? { content } : content

  const response = await fetch(url, {
    method: HTTP_METHOD_PATCH,
    headers: { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    console.error(`[DiscordApi] Error editando respuesta: ${response.status} ${await response.text()}`)
  }
}
