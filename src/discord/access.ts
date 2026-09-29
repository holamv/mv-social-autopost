import { ADMINISTRATOR_PERMISSION } from './constants.js'

export interface InteractionMember {
  user: { id: string }
  roles: string[]
  permissions: string
}

function isAdministrator(permissions: string): boolean {
  try {
    return (BigInt(permissions) & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION
  } catch {
    return false
  }
}

export function canPublish(member: InteractionMember | undefined, allowedIds: string[]): boolean {
  if (!member) {
    return false
  }

  if (isAdministrator(member.permissions)) {
    return true
  }

  return allowedIds.includes(member.user.id) || member.roles.some((roleId) => allowedIds.includes(roleId))
}
