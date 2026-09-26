import { isValidOAuthState } from '../../src/tiktok/oauthState.js'
import { connectWithCode } from '../../src/tiktok/tokens.js'
import { HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR, HTTP_OK, HTTP_UNAUTHORIZED } from '../../src/config/constants.js'

const HTML_HEADERS = { 'Content-Type': 'text/html; charset=utf-8' }
const CONNECTED_MESSAGE = 'Listo: la cuenta de TikTok quedo conectada. Ya puedes cerrar esta pestaña.'
const DENIED_MESSAGE = 'No se autorizo la cuenta en TikTok. Vuelve a pedir el enlace con /conectar-tiktok.'
const INVALID_STATE_MESSAGE = 'El enlace vencio o no es valido. Pide uno nuevo con /conectar-tiktok en Discord.'
const FAILED_MESSAGE = 'TikTok no confirmo la conexion. Revisa los logs en Vercel y vuelve a intentarlo.'

function page(message: string, status: number): Response {
  return new Response(`<!doctype html><meta charset="utf-8"><title>TikTok</title><p>${message}</p>`, {
    status,
    headers: HTML_HEADERS,
  })
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const code = params.get('code')

  if (!isValidOAuthState(params.get('state') ?? '')) {
    return page(INVALID_STATE_MESSAGE, HTTP_UNAUTHORIZED)
  }

  if (!code) {
    return page(DENIED_MESSAGE, HTTP_BAD_REQUEST)
  }

  try {
    await connectWithCode(code)
    return page(CONNECTED_MESSAGE, HTTP_OK)
  } catch (error) {
    console.error('[TikTokCallback] Error conectando la cuenta:', error)
    return page(FAILED_MESSAGE, HTTP_INTERNAL_ERROR)
  }
}
