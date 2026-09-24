export const STATUS_COMMAND = 'estado'
export const PUBLISH_NOW_COMMAND = 'publicar-ahora'

const CHAT_INPUT_COMMAND_TYPE = 1
const ADMINISTRATORS_ONLY = '0'

export interface CommandDefinition {
  name: string
  description: string
  type: number
  default_member_permissions?: string
}

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    name: STATUS_COMMAND,
    description: 'Muestra cuantas imagenes quedan en la cola y cuales salen primero',
    type: CHAT_INPUT_COMMAND_TYPE,
  },
  {
    name: PUBLISH_NOW_COMMAND,
    description: 'Publica ahora la siguiente imagen de la cola en Facebook e Instagram',
    type: CHAT_INPUT_COMMAND_TYPE,
    default_member_permissions: ADMINISTRATORS_ONLY,
  },
]
