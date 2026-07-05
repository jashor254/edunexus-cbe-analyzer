// lib/environment/context.ts
// Builds a RequestContext from a validated API key result.
// Called once per inbound request, immediately after validateApiKey().

import { resolveEnvironmentConfig } from './config'
import type { Environment, RequestContext } from './types'

export type BuildContextInput = {
  environment: Environment
  orgId:       string
  userId?:     string
  scopes:      string[]
  apiKeyId:    string
}

export function buildRequestContext(input: BuildContextInput): RequestContext {
  return {
    requestId:         crypto.randomUUID(),
    environment:       input.environment,
    environmentConfig: resolveEnvironmentConfig(input.environment),
    orgId:             input.orgId,
    userId:            input.userId,
    scopes:            input.scopes,
    apiKeyId:          input.apiKeyId,
    timestamp:         new Date(),
  }
}
