import { getDiscordEnv } from '../../src/discord/env.js'
import { handleCommand, type CommandInteraction } from '../../src/discord/commands.js'
import { isValidDiscordSignature } from '../../src/discord/verify.js'
import { handleComponent, type ComponentInteraction } from '../../src/discord/tiktokComponents.js'
import {
  INTERACTION_TYPE_APPLICATION_COMMAND,
  INTERACTION_TYPE_MESSAGE_COMPONENT,
  INTERACTION_TYPE_PING,
  RESPONSE_TYPE_PONG,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from '../../src/discord/constants.js'
import {
  HTTP_BAD_REQUEST,
  HTTP_INTERNAL_ERROR,
  HTTP_UNAUTHORIZED,
} from '../../src/config/constants.js'

const INVALID_SIGNATURE_MESSAGE = 'Firma invalida'
const UNSUPPORTED_MESSAGE = 'Tipo de interaccion no soportado'
const CONFIG_MESSAGE = 'Configuracion invalida del servicio'

interface Interaction extends CommandInteraction {
  type: number
}

function readPublicKey(): string | null {
  try {
    return getDiscordEnv().DISCORD_PUBLIC_KEY
  } catch (error) {
    console.error('[DiscordInteractions] Error de configuracion:', error)
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const publicKey = readPublicKey()

  if (!publicKey) {
    return new Response(CONFIG_MESSAGE, { status: HTTP_INTERNAL_ERROR })
  }

  const rawBody = await request.text()
  const signature = request.headers.get(SIGNATURE_HEADER)
  const timestamp = request.headers.get(TIMESTAMP_HEADER)

  if (!isValidDiscordSignature(rawBody, signature, timestamp, publicKey)) {
    return new Response(INVALID_SIGNATURE_MESSAGE, { status: HTTP_UNAUTHORIZED })
  }

  const interaction = JSON.parse(rawBody) as Interaction

  if (interaction.type === INTERACTION_TYPE_PING) {
    return Response.json({ type: RESPONSE_TYPE_PONG })
  }

  if (interaction.type === INTERACTION_TYPE_APPLICATION_COMMAND) {
    return Response.json(handleCommand(interaction))
  }

  if (interaction.type === INTERACTION_TYPE_MESSAGE_COMPONENT) {
    return Response.json(handleComponent(interaction as unknown as ComponentInteraction))
  }

  return new Response(UNSUPPORTED_MESSAGE, { status: HTTP_BAD_REQUEST })
}
