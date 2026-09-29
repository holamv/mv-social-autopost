import { isValidOAuthState } from '../../src/lib/oauthState.js'
import { callbackPage, escapeHtml } from '../../src/lib/callbackPage.js'
import { connectYouTube } from '../../src/youtube/auth.js'
import { HTTP_BAD_REQUEST, HTTP_INTERNAL_ERROR, HTTP_OK, HTTP_UNAUTHORIZED } from '../../src/config/constants.js'

const PAGE_TITLE = 'YouTube'
const CONNECTED_PREFIX = 'Listo: quedo conectado el canal'
const CONNECTED_SUFFIX = 'Si no es el de Manzana Verde, vuelve a usar /conectar-youtube y elige el canal correcto.'
const DENIED_MESSAGE = 'No se autorizo el canal en Google. Vuelve a pedir el enlace con /conectar-youtube.'
const INVALID_STATE_MESSAGE = 'El enlace vencio o no es valido. Pide uno nuevo con /conectar-youtube en Discord.'
const FAILED_MESSAGE = 'Google no confirmo la conexion. Revisa los logs en Vercel y vuelve a intentarlo.'

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const code = params.get('code')

  if (!isValidOAuthState('youtube', params.get('state') ?? '')) {
    return callbackPage(PAGE_TITLE, INVALID_STATE_MESSAGE, HTTP_UNAUTHORIZED)
  }

  if (!code) {
    return callbackPage(PAGE_TITLE, DENIED_MESSAGE, HTTP_BAD_REQUEST)
  }

  try {
    const channelTitle = await connectYouTube(code)
    return callbackPage(PAGE_TITLE, `${CONNECTED_PREFIX} <b>${escapeHtml(channelTitle)}</b>. ${CONNECTED_SUFFIX}`, HTTP_OK)
  } catch (error) {
    console.error('[YouTubeCallback] Error conectando el canal:', error)
    return callbackPage(PAGE_TITLE, FAILED_MESSAGE, HTTP_INTERNAL_ERROR)
  }
}
