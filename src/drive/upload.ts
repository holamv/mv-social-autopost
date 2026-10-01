import type { Readable } from 'node:stream'
import { getDriveClient } from './client.js'

const UPLOAD_RESPONSE_FIELDS = 'id, webViewLink'

export interface UploadRequest {
  folderId: string
  name: string
  mimeType: string
  body: Readable
  appProperties: Record<string, string>
}

export interface UploadedFile {
  id: string
  webViewLink: string
}

export async function uploadFile(request: UploadRequest): Promise<UploadedFile> {
  const response = await getDriveClient().files.create({
    requestBody: { name: request.name, parents: [request.folderId], appProperties: request.appProperties },
    media: { mimeType: request.mimeType, body: request.body },
    fields: UPLOAD_RESPONSE_FIELDS,
    supportsAllDrives: true,
  })

  return { id: response.data.id ?? '', webViewLink: response.data.webViewLink ?? '' }
}
