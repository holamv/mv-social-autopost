export const ACTION_ROW_TYPE = 1
export const BUTTON_TYPE = 2
export const STRING_SELECT_TYPE = 3
export const BUTTON_STYLE_PRIMARY = 1
export const BUTTON_STYLE_LINK = 5

export interface SelectOption {
  label: string
  value: string
  default?: boolean
}

export interface MessageComponent {
  type: number
  custom_id?: string
  label?: string
  style?: number
  url?: string
  placeholder?: string
  options?: SelectOption[]
  components?: MessageComponent[]
}

export interface MessagePayload {
  content: string
  components: MessageComponent[]
}

export function actionRow(...components: MessageComponent[]): MessageComponent {
  return { type: ACTION_ROW_TYPE, components }
}

export function findSelectedValue(rows: MessageComponent[], customId: string): string | null {
  for (const row of rows) {
    for (const component of row.components ?? []) {
      if (component.custom_id === customId) {
        return component.options?.find((option) => option.default)?.value ?? null
      }
    }
  }

  return null
}

export function withSelectedValue(rows: MessageComponent[], customId: string, value: string): MessageComponent[] {
  return rows.map((row) => ({
    ...row,
    components: (row.components ?? []).map((component) =>
      component.custom_id === customId
        ? { ...component, options: component.options?.map((option) => ({ ...option, default: option.value === value })) }
        : component,
    ),
  }))
}
