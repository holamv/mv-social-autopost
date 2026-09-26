export const STATUS_COMMAND = 'estado'
export const PUBLISH_NOW_COMMAND = 'publicar-ahora'
export const CONNECT_TIKTOK_COMMAND = 'conectar-tiktok'

const CHAT_INPUT_COMMAND_TYPE = 1

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
    description: 'Publica ahora lo siguiente de cada carpeta y manda a aprobacion lo de TikTok',
    type: CHAT_INPUT_COMMAND_TYPE,
  },
  {
    name: CONNECT_TIKTOK_COMMAND,
    description: 'Da el enlace para autorizar la cuenta de TikTok de Manzana Verde',
    type: CHAT_INPUT_COMMAND_TYPE,
  },
]
