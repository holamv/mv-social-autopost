import { DECIMAL_RADIX, LEADING_NUMBER_PATTERN, UNNUMBERED_FILE_ORDER } from '../config/constants.js'
import type { PendingImage } from '../types.js'

export function parseFileOrder(fileName: string): number {
  const match = LEADING_NUMBER_PATTERN.exec(fileName)

  if (!match?.[1]) {
    return UNNUMBERED_FILE_ORDER
  }

  return Number.parseInt(match[1], DECIMAL_RADIX)
}

export function sortByOrder(images: PendingImage[]): PendingImage[] {
  return [...images].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order
    }

    return left.name.localeCompare(right.name)
  })
}
