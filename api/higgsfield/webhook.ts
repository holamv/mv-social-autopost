import { waitUntil } from '@vercel/functions'
import { z } from 'zod'
import { HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR, HTTP_OK, HTTP_UNAUTHORIZED } from '../../src/config/constants.js'
import { WEBHOOK_TOKEN_PARAM } from '../../src/higgsfield/constants.js'
import { processResult } from '../../src/higgsfield/processResult.js'
import { isValidWebhookToken } from '../../src/higgsfield/webhookToken.js'

const UNAUTHORIZED_MESSAGE = 'No autorizado'
const INVALID_BODY_MESSAGE = 'Cuerpo invalido'
const CONFIG_MESSAGE = 'Configuracion invalida del servicio'
const ACCEPTED_MESSAGE = 'Recibido'

const deliverySchema = z.object({ request_id: z.string().uuid(), status: z.string() })

function hasValidToken(request: Request): boolean | null {
  try {
    return isValidWebhookToken(new URL(request.url).searchParams.get(WEBHOOK_TOKEN_PARAM))
  } catch (error) {
    console.error('[HiggsfieldWebhook] Error de configuracion:', error)
    return null
  }
}

async function readDelivery(request: Request): Promise<z.infer<typeof deliverySchema> | null> {
  try {
    const parsed = deliverySchema.safeParse(await request.json())

    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export async function POST(request: Request): Promise<Response> {
  const validToken = hasValidToken(request)

  if (validToken === null) {
    return new Response(CONFIG_MESSAGE, { status: HTTP_INTERNAL_ERROR })
  }

  if (!validToken) {
    return new Response(UNAUTHORIZED_MESSAGE, { status: HTTP_UNAUTHORIZED })
  }

  const delivery = await readDelivery(request)

  if (!delivery) {
    return new Response(INVALID_BODY_MESSAGE, { status: HTTP_BAD_REQUEST })
  }

  waitUntil(
    processResult(delivery.request_id).catch((error: unknown) => {
      console.error(`[HiggsfieldWebhook] Error con el pedido ${delivery.request_id}:`, error)
    }),
  )

  return new Response(ACCEPTED_MESSAGE, { status: HTTP_OK })
}
