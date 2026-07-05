// lib/environment/types.ts
// The environment abstraction for the EduNexus platform.
// New environments (staging, test, local) are added by extending Environment
// and adding an entry to ENVIRONMENT_CONFIGS — nothing else changes.

export type Environment = 'live' | 'sandbox'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type QuotaConfig = {
  rpm:     number  // requests per minute (per API key)
  rpd:     number  // requests per day (per API key)
  daily:   number  // org-level daily cap
  monthly: number  // org-level monthly cap
}

export type BillingConfig = {
  enabled:       boolean  // whether billing events are generated
  deductTokens:  boolean  // whether AI token balance is debited
}

export type AnalyticsConfig = {
  trackUsage:        boolean  // whether usage_events rows are written
  includeInReports:  boolean  // whether those rows appear in billing/analytics dashboards
}

export type LoggingConfig = {
  level:           LogLevel  // minimum log level for console output
  persistToAudit:  boolean   // whether requests are written to audit_logs
}

export type FeatureFlagConfig = {
  aiEnabled:        boolean  // whether AI endpoints are callable
  webhooksEnabled:  boolean  // whether outbound webhook delivery is active
}

export type AIProviderConfig = {
  provider:             'deepseek' | 'mock'  // which LLM backend to use
  maxTokensMultiplier:  number               // applied to every max_tokens value
}

export type EnvironmentConfig = {
  environment:  Environment
  quota:        QuotaConfig
  billing:      BillingConfig
  analytics:    AnalyticsConfig
  logging:      LoggingConfig
  featureFlags: FeatureFlagConfig
  ai:           AIProviderConfig
}

export type RequestContext = {
  requestId:         string
  environment:       Environment
  environmentConfig: EnvironmentConfig
  orgId:             string
  userId?:           string
  scopes:            string[]
  apiKeyId:          string
  timestamp:         Date
}
