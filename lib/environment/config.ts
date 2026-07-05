// lib/environment/config.ts
// Central registry of per-environment configuration.
// Infrastructure components read from this — never branch on the environment string directly.

import type { Environment, EnvironmentConfig } from './types'

export const ENVIRONMENT_CONFIGS: Record<Environment, EnvironmentConfig> = {
  live: {
    environment:  'live',
    quota:        { rpm: 60,  rpd: 1_000,  daily: 500,    monthly: 10_000  },
    billing:      { enabled: true,  deductTokens: true   },
    analytics:    { trackUsage: true,  includeInReports: true  },
    logging:      { level: 'info',  persistToAudit: true  },
    featureFlags: { aiEnabled: true,  webhooksEnabled: true  },
    ai:           { provider: 'deepseek', maxTokensMultiplier: 1.0 },
  },

  sandbox: {
    environment:  'sandbox',
    quota:        { rpm: 120, rpd: 10_000, daily: 5_000,  monthly: 100_000 },
    billing:      { enabled: false, deductTokens: false  },
    analytics:    { trackUsage: true,  includeInReports: false },
    logging:      { level: 'debug', persistToAudit: false },
    featureFlags: { aiEnabled: true,  webhooksEnabled: false  },
    ai:           { provider: 'deepseek', maxTokensMultiplier: 0.5 },
  },
}

export function resolveEnvironmentConfig(env: Environment): EnvironmentConfig {
  return ENVIRONMENT_CONFIGS[env]
}
