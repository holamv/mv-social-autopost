import { isValidOAuthState } from '../../src/lib/oauthState.js'
import { callbackPage } from '../../src/lib/callbackPage.js'
import { connectWithCode } from '../../src/tiktok/tokens.js'
import { HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR, HTTP_OK, HTTP_UNAUTHORIZED } from '../../src/config/constants.js'

const PAGE_TITLE = 'TikTok'
const CONNECTED_MESSAGE = 'Listo: la cuenta de TikTok quedo conectada. Ya puedes cerrar esta pestaña.'
const DENIED_MESSAGE = 'No se autorizo la cuenta en TikTok. Vuelve a pedir el enlace con /conectar-tiktok.'
const INVALID_STATE_MESSAGE = 'El enlace vencio o no es valido. Pide uno nuevo con /conectar-tiktok en Discord.'
const FAILED_MESSAGE = 'TikTok no confirmo la conexion. Revisa los logs en Vercel y vuelve a intentarlo.'

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const code = params.get('code')

  if (!isValidOAuthState('tiktok', params.get('state') ?? '')) {
    return callbackPage(PAGE_TITLE, INVALID_STATE_MESSAGE, HTTP_UNAUTHORIZED)
  }

  if (!code) {
    return callbackPage(PAGE_TITLE, DENIED_MESSAGE, HTTP_BAD_REQUEST)
  }

  try {
    await connectWithCode(code)
    return callbackPage(PAGE_TITLE, CONNECTED_MESSAGE, HTTP_OK)
  } catch (error) {
    console.error('[TikTokCallback] Error conectando la cuenta:', error)
    return callbackPage(PAGE_TITLE, FAILED_MESSAGE, HTTP_INTERNAL_ERROR)
  }
}
