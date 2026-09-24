import type { drive_v3 } from 'googleapis'
import { getDriveClient } from './client.js'
import {
  BYTES_PER_MEGABYTE,
  DEFAULT_MIME_TYPE,
  DRIVE_DOWNLOAD_PROPERTIES,
  DRIVE_MEDIA_ALT,
  FIELD_SEPARATOR,
  IMAGE_MIME_PREFIX,
  MAX_IMAGE_MEGABYTES,
} from '../config/constants.js'
import type { DriveImage } from '../types.js'

export class DriveDownloadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DriveDownloadError'
  }
}

async function fetchMetadata(fileId: string): Promise<drive_v3.Schema$File> {
  const drive = getDriveClient()

  const response = await drive.files.get({
    fileId,
    fields: DRIVE_DOWNLOAD_PROPERTIES.join(FIELD_SEPARATOR),
    supportsAllDrives: true,
  })

  return response.data
}

function assertDownloadable(metadata: drive_v3.Schema$File, fileId: string): void {
  const mimeType = metadata.mimeType ?? ''

  if (!mimeType.startsWith(IMAGE_MIME_PREFIX)) {
    throw new DriveDownloadError(`El archivo ${fileId} no es una imagen (${mimeType || 'sin tipo'})`)
  }

  const declaredMegabytes = Number(metadata.size ?? 0) / BYTES_PER_MEGABYTE

  if (declaredMegabytes > MAX_IMAGE_MEGABYTES) {
    throw new DriveDownloadError(
      `El archivo ${fileId} pesa ${declaredMegabytes.toFixed(1)} MB y el limite en memoria es ${MAX_IMAGE_MEGABYTES} MB`,
    )
  }
}

export async function downloadImageToMemory(fileId: string): Promise<DriveImage> {
  const metadata = await fetchMetadata(fileId)

  assertDownloadable(metadata, fileId)

  const drive = getDriveClient()

  const response = await drive.files.get(
    { fileId, alt: DRIVE_MEDIA_ALT, supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )

  const buffer = Buffer.from(response.data as ArrayBuffer)

  if (buffer.byteLength === 0) {
    throw new DriveDownloadError(`El archivo ${fileId} llego vacio desde Drive`)
  }

  return {
    fileId,
    name: metadata.name ?? fileId,
    mimeType: metadata.mimeType ?? DEFAULT_MIME_TYPE,
    sizeBytes: buffer.byteLength,
    buffer,
  }
}

export function toUploadBlob(image: DriveImage): Blob {
  return new Blob([new Uint8Array(image.buffer)], { type: image.mimeType })
}
