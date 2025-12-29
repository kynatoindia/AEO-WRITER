// User plan quotas - separated for easier testing
export const PLAN_QUOTAS = {
  free: {
    contentGeneration: 10, // per month
    apiCalls: 100, // per day
    projects: 3,
    tokensPerMonth: 10000,
    costLimitUsd: 5.0,
  },
  pro: {
    contentGeneration: 500, // per month
    apiCalls: 5000, // per day
    projects: 50,
    tokensPerMonth: 500000,
    costLimitUsd: 50.0,
  },
  enterprise: {
    contentGeneration: -1, // unlimited
    apiCalls: -1, // unlimited
    projects: -1, // unlimited
    tokensPerMonth: -1, // unlimited
    costLimitUsd: -1, // unlimited
  },
} as const;

export type UserPlan = keyof typeof PLAN_QUOTAS;
export type QuotaType = keyof typeof PLAN_QUOTAS.free;