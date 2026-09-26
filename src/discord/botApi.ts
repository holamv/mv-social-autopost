import { getEnv } from '../config/env.js'
import { HTTP_METHOD_POST } from '../config/constants.js'
import { CONTENT_TYPE_HEADER, DISCORD_API_BASE_URL, JSON_CONTENT_TYPE } from './constants.js'
import type { MessagePayload } from './components.js'

interface CreatedMessage {
  id: string
}

export async function sendChannelMessage(channelId: string, payload: MessagePayload): Promise<string> {
  const response = await fetch(`${DISCORD_API_BASE_URL}/channels/${channelId}/messages`, {
    method: HTTP_METHOD_POST,
    headers: {
      Authorization: `Bot ${getEnv().DISCORD_BOT_TOKEN ?? ''}`,
      [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Discord rechazo el mensaje de aprobacion: ${response.status} ${await response.text()}`)
  }

  return ((await response.json()) as CreatedMessage).id
}
