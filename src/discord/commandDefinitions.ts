export const STATUS_COMMAND = 'estado'
export const PUBLISH_NOW_COMMAND = 'publicar-ahora'
export const CONNECT_TIKTOK_COMMAND = 'conectar-tiktok'
export const CONNECT_YOUTUBE_COMMAND = 'conectar-youtube'
export const SCHEDULE_COMMAND = 'horario'

export const NETWORK_OPTION = 'red'
export const HOURS_OPTION = 'horas'
export const ALL_NETWORKS_VALUE = 'todas'

const CHAT_INPUT_COMMAND_TYPE = 1
const STRING_OPTION_TYPE = 3

export interface CommandChoice {
  name: string
  value: string
}

export interface CommandOption {
  type: number
  name: string
  description: string
  required?: boolean
  choices?: CommandChoice[]
}

export interface CommandDefinition {
  name: string
  description: string
  type: number
  default_member_permissions?: string
  options?: CommandOption[]
}

export const NETWORK_CHOICES: CommandChoice[] = [
  { name: 'Carpeta principal (Facebook + Instagram)', value: 'principal' },
  { name: 'Facebook', value: 'facebook' },
  { name: 'Instagram', value: 'instagram' },
  { name: 'LinkedIn', value: 'linkedin' },
  { name: 'TikTok', value: 'tiktok' },
  { name: 'YouTube Shorts', value: 'youtube' },
]

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    name: STATUS_COMMAND,
    description: 'Muestra cuantas imagenes quedan en la cola y cuales salen primero',
    type: CHAT_INPUT_COMMAND_TYPE,
  },
  {
    name: PUBLISH_NOW_COMMAND,
    description: 'Publica ahora lo siguiente de cada carpeta, o solo de la red que elijas',
    type: CHAT_INPUT_COMMAND_TYPE,
    options: [
      {
        type: STRING_OPTION_TYPE,
        name: NETWORK_OPTION,
        description: 'Red a publicar (si no eliges, todas)',
        choices: [{ name: 'Todas', value: ALL_NETWORKS_VALUE }, ...NETWORK_CHOICES],
      },
    ],
  },
  {
    name: SCHEDULE_COMMAND,
    description: 'Muestra o cambia en que horas publica cada red',
    type: CHAT_INPUT_COMMAND_TYPE,
    options: [
      { type: STRING_OPTION_TYPE, name: NETWORK_OPTION, description: 'Red a configurar', choices: NETWORK_CHOICES },
      {
        type: STRING_OPTION_TYPE,
        name: HOURS_OPTION,
        description: 'Horas de 0 a 23 separadas por coma (9,13,19), "siempre" o "pausa"',
      },
    ],
  },
  {
    name: CONNECT_TIKTOK_COMMAND,
    description: 'Da el enlace para autorizar la cuenta de TikTok de Manzana Verde',
    type: CHAT_INPUT_COMMAND_TYPE,
  },
  {
    name: CONNECT_YOUTUBE_COMMAND,
    description: 'Da el enlace para autorizar el canal de YouTube de Manzana Verde',
    type: CHAT_INPUT_COMMAND_TYPE,
  },
]
