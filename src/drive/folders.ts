import { getDriveClient } from './client.js'
import { DRIVE_FOLDER_LOOKUP_FIELDS, DRIVE_FOLDER_MIME_TYPE } from '../config/constants.js'

const SINGLE_QUOTE = /'/g
const ESCAPED_SINGLE_QUOTE = "\\'"

function buildChildFolderQuery(parentId: string, name: string): string {
  return [
    `'${parentId}' in parents`,
    `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
    `name = '${name.replace(SINGLE_QUOTE, ESCAPED_SINGLE_QUOTE)}'`,
    'trashed = false',
  ].join(' and ')
}

export async function findChildFolder(parentId: string, name: string): Promise<string | null> {
  const response = await getDriveClient().files.list({
    q: buildChildFolderQuery(parentId, name),
    fields: DRIVE_FOLDER_LOOKUP_FIELDS,
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })

  return response.data.files?.[0]?.id ?? null
}
