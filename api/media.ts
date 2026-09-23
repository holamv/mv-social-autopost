import type { VercelRequest, VercelResponse } from '@vercel/node'
import { downloadImageToMemory } from '../src/drive/download'
import { isValidMediaRequest } from '../src/lib/signedUrl'
import {
  DECIMAL_RADIX,
  HTTP_METHOD_GET,
  HTTP_METHOD_NOT_ALLOWED,
  HTTP_NOT_FOUND,
  HTTP_OK,
  HTTP_UNAUTHORIZED,
  MEDIA_CACHE_CONTROL,
  MEDIA_EXPIRES_PARAM,
  MEDIA_FILE_PARAM,
  MEDIA_SIGNATURE_PARAM,
} from '../src/config/constants'

const CONTENT_TYPE_HEADER = 'Content-Type'
const CACHE_CONTROL_HEADER = 'Cache-Control'
const INVALID_LINK_MESSAGE = 'Enlace invalido o vencido'
const NOT_FOUND_MESSAGE = 'Imagen no encontrada'
const METHOD_MESSAGE = 'Metodo no permitido'

function readParam(request: VercelRequest, key: string): string {
  const value = request.query[key]

  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  if (request.method !== HTTP_METHOD_GET) {
    response.status(HTTP_METHOD_NOT_ALLOWED).send(METHOD_MESSAGE)
    return
  }

  const fileId = readParam(request, MEDIA_FILE_PARAM)
  const expiresAt = Number.parseInt(readParam(request, MEDIA_EXPIRES_PARAM), DECIMAL_RADIX)
  const signature = readParam(request, MEDIA_SIGNATURE_PARAM)

  if (!fileId || !isValidMediaRequest(fileId, expiresAt, signature)) {
    response.status(HTTP_UNAUTHORIZED).send(INVALID_LINK_MESSAGE)
    return
  }

  try {
    const image = await downloadImageToMemory(fileId)

    response.setHeader(CONTENT_TYPE_HEADER, image.mimeType)
    response.setHeader(CACHE_CONTROL_HEADER, MEDIA_CACHE_CONTROL)
    response.status(HTTP_OK).send(image.buffer)
  } catch (error) {
    console.error(`[Media] Error sirviendo ${fileId}:`, error)
    response.status(HTTP_NOT_FOUND).send(NOT_FOUND_MESSAGE)
  }
}
