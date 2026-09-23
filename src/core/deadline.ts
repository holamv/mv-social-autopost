import {
  DEADLINE_SAFETY_SECONDS,
  FUNCTION_MAX_DURATION_SECONDS,
  MS_PER_SECOND,
} from '../config/constants.js'

export interface Deadline {
  remainingMs: () => number
  isExpired: () => boolean
}

export function createDeadline(): Deadline {
  const budgetSeconds = FUNCTION_MAX_DURATION_SECONDS - DEADLINE_SAFETY_SECONDS
  const endsAt = Date.now() + budgetSeconds * MS_PER_SECOND

  return {
    remainingMs: () => Math.max(endsAt - Date.now(), 0),
    isExpired: () => Date.now() >= endsAt,
  }
}
