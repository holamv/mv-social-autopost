import { getDriveClient } from './client.js'
import {
  DRIVE_MOVE_PROPERTIES,
  DRIVE_PARENTS_FIELD,
  FIELD_SEPARATOR,
  HTTP_BAD_REQUEST,
  HTTP_FORBIDDEN,
  HTTP_NOT_FOUND,
  PARENT_SEPARATOR,
} from '../config/constants.js'
import type { MoveResult } from '../types.js'

export class DriveMoveError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message)
    this.name = 'DriveMoveError'
  }
}

function readStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return null
  }

  const status = (error as { status?: unknown }).status

  return typeof status === 'number' ? status : null
}

function describeFailure(status: number | null, fileId: string): string {
  if (status === HTTP_NOT_FOUND) {
    return `No se encontro el archivo ${fileId} o alguna de las carpetas indicadas`
  }

  if (status === HTTP_FORBIDDEN) {
    return `Sin permiso para mover ${fileId}: la cuenta de servicio necesita rol Editor en ambas carpetas`
  }

  if (status === HTTP_BAD_REQUEST) {
    return `Drive rechazo el movimiento de ${fileId} por parametros invalidos`
  }

  return `Error inesperado moviendo el archivo ${fileId}`
}

function assertArguments(fileId: string, fromFolderId: string, toFolderId: string): void {
  if (!fileId || !fromFolderId || !toFolderId) {
    throw new DriveMoveError('Se requieren el ID del archivo y de ambas carpetas', null)
  }

  if (fromFolderId === toFolderId) {
    throw new DriveMoveError('La carpeta de origen y la de destino son la misma', null)
  }
}

async function fetchParents(fileId: string): Promise<string[]> {
  const drive = getDriveClient()

  const response = await drive.files.get({
    fileId,
    fields: DRIVE_PARENTS_FIELD,
    supportsAllDrives: true,
  })

  return response.data.parents ?? []
}

export async function moveFile(
  fileId: string,
  fromFolderId: string,
  toFolderId: string,
): Promise<MoveResult> {
  assertArguments(fileId, fromFolderId, toFolderId)

  try {
    const parents = await fetchParents(fileId)

    if (parents.includes(toFolderId) && !parents.includes(fromFolderId)) {
      return { fileId, parents, moved: false }
    }

    const response = await getDriveClient().files.update({
      fileId,
      addParents: toFolderId,
      removeParents: parents.filter((parent) => parent === fromFolderId).join(PARENT_SEPARATOR) || undefined,
      fields: DRIVE_MOVE_PROPERTIES.join(FIELD_SEPARATOR),
      supportsAllDrives: true,
    })

    return { fileId, parents: response.data.parents ?? [], moved: true }
  } catch (error) {
    console.error(`[DriveMove] Error moviendo ${fileId} a ${toFolderId}:`, error)

    if (error instanceof DriveMoveError) {
      throw error
    }

    const status = readStatus(error)

    throw new DriveMoveError(describeFailure(status, fileId), status)
  }
}