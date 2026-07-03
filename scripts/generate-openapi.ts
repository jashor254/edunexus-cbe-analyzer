#!/usr/bin/env tsx
// scripts/generate-openapi.ts
// Generates an OpenAPI 3.1 specification from EduNexus route metadata.
// Usage: npx tsx scripts/generate-openapi.ts [--out=./openapi.json]
//
// The spec is consumed by:
//   - developers.edunexus.co.ke API Reference docs
//   - SDK generators (TypeScript, Python)
//   - Postman collection export

import fs from 'fs'
import path from 'path'

// ── Types ─────────────────────────────────────────────────────────────────────

type OpenAPISchema = Record<string, unknown>

type ParameterLocation = 'path' | 'query' | 'header' | 'cookie'

type Parameter = {
  name:        string
  in:          ParameterLocation
  description?: string
  required?:   boolean
  schema:      OpenAPISchema
}

type RequestBody = {
  required:    boolean
  content:     Record<string, { schema: OpenAPISchema }>
}

type Response = {
  description: string
  content?:    Record<string, { schema: OpenAPISchema }>
}

type Operation = {
  summary:      string
  description?: string
  tags:         string[]
  security?:    Array<Record<string, string[]>>
  parameters?:  Parameter[]
  requestBody?: RequestBody
  responses:    Record<string, Response>
}

type PathItem = Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', Operation>>

// ── Route catalogue ──────────────────────────────────────────────────────────
// Hand-authored metadata for the public API surface.
// Matches what route handlers actually accept/return.

const PATHS: Record<string, PathItem> = {

  // ── Organizations ──────────────────────────────────────────────────────────
  '/api/organizations/create': {
    post: {
      summary: 'Create organization',
      tags: ['Organizations'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name:    { type: 'string', example: 'Nairobi Academy' },
            slug:    { type: 'string', example: 'nairobi-academy' },
            type:    { type: 'string', enum: ['school','district','county','ministry','publisher','university','ngo','developer'] },
            website: { type: 'string', format: 'uri' },
          },
        }}},
      },
      responses: {
        '201': { description: 'Organization created', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Organization' } } } },
        '400': { description: 'Validation error' },
        '401': { description: 'Unauthorized' },
      },
    },
  },

  '/api/organizations/{orgId}': {
    get: {
      summary: 'Get organization',
      tags: ['Organizations'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        '200': { description: 'Organization details', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Organization' } } } },
        '404': { description: 'Not found' },
      },
    },
    patch: {
      summary: 'Update organization settings',
      tags: ['Organizations'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object',
          properties: {
            name:          { type: 'string' },
            website:       { type: 'string', format: 'uri' },
            timezone:      { type: 'string', example: 'Africa/Nairobi' },
            locale:        { type: 'string', example: 'en-KE' },
            currency:      { type: 'string', example: 'KES' },
            primary_color: { type: 'string', example: '#1e3a5f' },
          },
        }}},
      },
      responses: {
        '200': { description: 'Updated' },
        '403': { description: 'Forbidden' },
      },
    },
  },

  '/api/organizations/{orgId}/members': {
    get: {
      summary: 'List organization members',
      tags: ['Organizations'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: {
        '200': { description: 'Member list', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/OrgMember' } } } } },
      },
    },
  },

  '/api/organizations/{orgId}/invitations': {
    post: {
      summary: 'Invite member to organization',
      tags: ['Organizations'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['email', 'role'],
          properties: {
            email:   { type: 'string', format: 'email' },
            role:    { type: 'string', enum: ['admin','member','viewer','billing'] },
            message: { type: 'string' },
          },
        }}},
      },
      responses: { '201': { description: 'Invitation sent' }, '400': { description: 'Invalid input' } },
    },
  },

  '/api/organizations/{orgId}/api-keys': {
    get: {
      summary: 'List API keys',
      tags: ['API Keys'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: { '200': { description: 'API key list' } },
    },
    post: {
      summary: 'Create API key',
      tags: ['API Keys'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object', required: ['name'],
          properties: {
            name:         { type: 'string', example: 'Production Key' },
            scopes:       { type: 'array', items: { type: 'string' }, example: ['read:curriculum', 'write:assessments'] },
            expires_at:   { type: 'string', format: 'date-time' },
          },
        }}},
      },
      responses: { '201': { description: 'Key created — raw key shown once' } },
    },
  },

  // ── Billing ────────────────────────────────────────────────────────────────
  '/api/organizations/{orgId}/billing/usage': {
    get: {
      summary: 'Get usage summary',
      tags: ['Billing'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: { '200': { description: 'Current period usage' } },
    },
  },

  '/api/organizations/{orgId}/billing/plans': {
    get: {
      summary: 'List subscription plans',
      tags: ['Billing'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      responses: { '200': { description: 'Available plans' } },
    },
    post: {
      summary: 'Upgrade subscription plan',
      tags: ['Billing'],
      security: [{ bearerAuth: [] }],
      parameters: [{ name: 'orgId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object', required: ['plan_name'], properties: { plan_name: { type: 'string' } } } } },
      },
      responses: { '200': { description: 'Plan upgraded' } },
    },
  },

  // ── AI ────────────────────────────────────────────────────────────────────
  '/api/sow/generate': {
    post: {
      summary: 'Generate Scheme of Work',
      tags: ['AI Generation'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object',
          required: ['subject', 'grade', 'term', 'class_id'],
          properties: {
            subject:    { type: 'string', example: 'Mathematics' },
            grade:      { type: 'integer', minimum: 7, maximum: 12 },
            term:       { type: 'integer', minimum: 1, maximum: 3 },
            class_id:   { type: 'string', format: 'uuid' },
            weeks:      { type: 'integer', default: 14 },
            curriculum: { type: 'string', enum: ['CBC', 'KICD_844', 'IGCSE'], default: 'CBC' },
          },
        }}},
      },
      responses: { '200': { description: 'Generated scheme of work in JSON' }, '402': { description: 'Insufficient tokens' } },
    },
  },

  '/api/lesson-plans/generate': {
    post: {
      summary: 'Generate lesson plan',
      tags: ['AI Generation'],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: {
          type: 'object',
          required: ['subject', 'grade', 'strand', 'sub_strand'],
          properties: {
            subject:      { type: 'string' },
            grade:        { type: 'integer', minimum: 7, maximum: 12 },
            strand:       { type: 'string' },
            sub_strand:   { type: 'string' },
            duration_mins:{ type: 'integer', default: 40 },
          },
        }}},
      },
      responses: { '200': { description: 'Generated lesson plan' } },
    },
  },

  // ── Search ────────────────────────────────────────────────────────────────
  '/api/search': {
    get: {
      summary: 'Unified platform search',
      tags: ['Search'],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'q',     in: 'query', required: true,  schema: { type: 'string', example: 'quadratic equations' } },
        { name: 'types', in: 'query', required: false, schema: { type: 'string', example: 'sow,lesson_plan,curriculum' }, description: 'Comma-separated resource types to search' },
        { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 20, maximum: 100 } },
      ],
      responses: {
        '200': { description: 'Search results ranked by relevance' },
        '400': { description: 'Query too short' },
      },
    },
  },

  // ── Health ────────────────────────────────────────────────────────────────
  '/api/health': {
    get: {
      summary: 'Platform health check',
      tags: ['Platform'],
      responses: {
        '200': { description: 'Healthy' },
        '503': { description: 'Service degraded or down' },
      },
    },
  },
}

// ── Component schemas ─────────────────────────────────────────────────────────

const SCHEMAS: Record<string, OpenAPISchema> = {
  Organization: {
    type: 'object',
    properties: {
      id:            { type: 'string', format: 'uuid' },
      name:          { type: 'string' },
      slug:          { type: 'string' },
      type:          { type: 'string' },
      status:        { type: 'string', enum: ['active', 'suspended', 'trial'] },
      timezone:      { type: 'string' },
      locale:        { type: 'string' },
      currency:      { type: 'string' },
      primary_color: { type: 'string' },
      created_at:    { type: 'string', format: 'date-time' },
      updated_at:    { type: 'string', format: 'date-time' },
    },
  },

  OrgMember: {
    type: 'object',
    properties: {
      id:              { type: 'string', format: 'uuid' },
      organization_id: { type: 'string', format: 'uuid' },
      user_id:         { type: 'string', format: 'uuid' },
      role:            { type: 'string', enum: ['owner', 'admin', 'member', 'viewer', 'billing'] },
      status:          { type: 'string', enum: ['active', 'inactive', 'suspended'] },
      joined_at:       { type: 'string', format: 'date-time' },
    },
  },

  Error: {
    type: 'object',
    required: ['error'],
    properties: {
      error: { type: 'string' },
      code:  { type: 'string' },
    },
  },
}

// ── Spec assembly ─────────────────────────────────────────────────────────────

function buildSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title:       'EduNexus API',
      description: 'The EduNexus Education Intelligence Platform API. Build adaptive learning experiences for African schools.',
      version:     process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
      contact: {
        name:  'EduNexus Developer Platform',
        email: 'api@edunexus.co.ke',
        url:   'https://developers.edunexus.co.ke',
      },
      license: {
        name: 'Proprietary',
        url:  'https://edunexus.co.ke/legal/terms',
      },
    },
    externalDocs: {
      description: 'EduNexus Developer Documentation',
      url:         'https://developers.edunexus.co.ke/docs',
    },
    servers: [
      { url: 'https://app.edunexus.co.ke', description: 'Production' },
      { url: 'http://localhost:3000',       description: 'Local development' },
    ],
    tags: [
      { name: 'Organizations', description: 'Multi-tenant organization management' },
      { name: 'API Keys',      description: 'API key lifecycle management' },
      { name: 'Billing',       description: 'Subscription, usage, and invoicing' },
      { name: 'AI Generation', description: 'CBC-aligned AI content generation' },
      { name: 'Search',        description: 'Platform-wide search' },
      { name: 'Platform',      description: 'Health and observability' },
    ],
    paths: PATHS,
    components: {
      securitySchemes: {
        bearerAuth: {
          type:         'http',
          scheme:       'bearer',
          bearerFormat: 'JWT',
          description:  'Supabase session JWT or API key with Bearer prefix',
        },
      },
      schemas: SCHEMAS,
    },
  }
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

const outFlag = process.argv.find(a => a.startsWith('--out='))
const outPath = outFlag
  ? outFlag.replace('--out=', '')
  : path.join(process.cwd(), 'openapi.json')

const spec = buildSpec()
fs.writeFileSync(outPath, JSON.stringify(spec, null, 2))
console.log(`✅ OpenAPI spec written to ${outPath}`)
console.log(`   Paths: ${Object.keys(PATHS).length}`)
console.log(`   Schemas: ${Object.keys(SCHEMAS).length}`)
