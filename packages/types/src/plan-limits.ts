import type { Plan } from './enums'

export const PROMPT_LIMITS: Record<Plan, number> = {
  FREE: 50,
  STARTER: 500,
  PROFESSIONAL: 2000,
  AGENCY: Infinity,
  ENTERPRISE: Infinity,
}

export function getPromptLimit(plan: Plan): number {
  return PROMPT_LIMITS[plan]
}
