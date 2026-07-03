# EduNexus Repository Bootstrap Guide

**Version:** 1.0.0
**Classification:** Implementation Guide
**Follows:** Monorepo & Workspace Foundation Specification (`docs/monorepo-foundation-specification.md`)
**Audience:** Founding Engineering Team

---

> Every command in this guide is meant to be run. Every file is meant to be created. By the end of Part VII, `pnpm dev` starts the entire platform.

---

## Table of Contents

### Part I — Repository Initialization
- Chapter 1: Creating the Repository
- Chapter 2: Root Configuration

### Part II — Workspace Bootstrap
- Chapter 3: Creating Applications
- Chapter 4: Shared Packages

### Part III — Infrastructure Bootstrap
- Chapter 5: Docker
- Chapter 6: Local Infrastructure

### Part IV — Engineering Tooling
- Chapter 7: Git Hooks
- Chapter 8: Code Generation

### Part V — Developer Experience
- Chapter 9: VS Code
- Chapter 10: Cursor & Claude Code

### Part VI — Testing Bootstrap
- Chapter 11: Test Infrastructure
- Chapter 12: GitHub Actions

### Part VII — First Working Platform
- Chapter 13: Green Platform Milestone

### Final Chapter: The First Week

---

# Part I — Repository Initialization

---

## Chapter 1 — Creating the Repository

### 1.1 GitHub Organization Setup

The EduNexus codebase lives under the `edunexus` GitHub organization. Before creating the repository, configure the organization:

```bash
# Install GitHub CLI if not already installed
brew install gh       # macOS
# or: sudo apt install gh  # Ubuntu

# Authenticate
gh auth login

# Create the organization (if it doesn't exist)
# → Do this in the GitHub web UI: github.com/organizations/new

# Verify organization access
gh org list
```

Create the following teams inside the organization. Teams map to `CODEOWNERS` and pull request approval requirements:

| Team Slug | Description | Members |
|-----------|-------------|---------|
| `platform-team` | Core infrastructure owners | Tech Lead, Architect |
| `teacher-app-team` | Teacher application | Teacher app engineers |
| `learner-app-team` | Learner + Parent apps | Learner app engineers |
| `ai-team` | AI and knowledge graph | AI engineers |
| `devops-team` | Infrastructure and CI/CD | DevOps engineers |
| `design-system-team` | Shared UI components | Frontend engineers |
| `curriculum-team` | CBC curriculum data | Curriculum engineers |
| `data-team` | Analytics platform | Data engineers |
| `developer-platform-team` | External developer experience | DX engineers |

```bash
# Create teams via GitHub CLI
gh api orgs/edunexus/teams \
  --method POST \
  --field name="Platform Team" \
  --field slug="platform-team" \
  --field privacy="closed"

# Repeat for each team
# Or create all teams via the GitHub web UI: github.com/orgs/edunexus/teams
```

### 1.2 Creating the Repository

```bash
# Create the repository under the organization
gh repo create edunexus/edunexus \
  --private \
  --description "Kenya CBC/CBE AI Education Platform" \
  --homepage "https://edunexus.co.ke" \
  --disable-wiki \
  --enable-issues \
  --enable-discussions

# Clone it locally
git clone git@github.com:edunexus/edunexus.git
cd edunexus
```

### 1.3 Branch Protection Rules

Set up branch protection for `main` before any code is pushed:

```bash
# Configure branch protection via GitHub CLI
gh api repos/edunexus/edunexus/branches/main/protection \
  --method PUT \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / Validate",
      "CI / Unit Tests",
      "CI / Build",
      "CI / Integration Tests",
      "CI / Architecture Tests",
      "CI / CI Success"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 2,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF
```

Also enable these settings in the repository → Settings → General:

- **Default branch:** `main`
- **Allow squash merging:** ✓ (enforce squash for clean history)
- **Allow merge commits:** ✗
- **Allow rebase merging:** ✗
- **Automatically delete head branches:** ✓
- **Require contributors to sign off on web-based commits:** ✓

### 1.4 Repository Labels

Create the complete label set used for issues and pull requests:

```bash
# Create labels using a script
cat > scripts/create-labels.sh << 'SCRIPT'
#!/bin/bash
REPO="edunexus/edunexus"

create_label() {
  gh label create "$1" --color "$2" --description "$3" --repo "$REPO" 2>/dev/null || \
  gh label edit "$1" --color "$2" --description "$3" --repo "$REPO"
}

# Type labels
create_label "type: feature"       "0075ca" "New feature or request"
create_label "type: bug"           "d73a4a" "Something isn't working"
create_label "type: security"      "ee0701" "Security vulnerability"
create_label "type: performance"   "e4e669" "Performance improvement"
create_label "type: refactor"      "cfd3d7" "Code refactoring"
create_label "type: docs"          "0075ca" "Documentation"
create_label "type: chore"         "cfd3d7" "Maintenance task"
create_label "type: technical-debt" "fbca04" "Technical debt"

# Priority labels
create_label "priority: critical"  "b60205" "P0 — needs immediate attention"
create_label "priority: high"      "d93f0b" "P1 — needs attention this sprint"
create_label "priority: medium"    "e4e669" "P2 — scheduled work"
create_label "priority: low"       "0e8a16" "P3 — nice to have"

# Area labels
create_label "area: teacher-app"   "1d76db" "Teacher application"
create_label "area: learner-app"   "1d76db" "Learner application"
create_label "area: parent-app"    "1d76db" "Parent application"
create_label "area: admin"         "1d76db" "Admin application"
create_label "area: ai"            "5319e7" "AI systems"
create_label "area: curriculum"    "5319e7" "Curriculum data"
create_label "area: database"      "0075ca" "Database"
create_label "area: infra"         "0052cc" "Infrastructure"
create_label "area: ci-cd"         "0052cc" "CI/CD"
create_label "area: ui"            "e99695" "Design system"
create_label "area: payments"      "fbca04" "Billing and tokens"
create_label "area: developer-platform" "c2e0c6" "Developer platform"

# Status labels
create_label "status: needs-triage"   "ededed" "Awaiting triage"
create_label "status: in-progress"    "0e8a16" "Currently being worked on"
create_label "status: blocked"        "d93f0b" "Blocked on something"
create_label "status: needs-review"   "fbca04" "Awaiting review"
create_label "status: needs-rfc"      "5319e7" "Requires an RFC before implementation"

# Special labels
create_label "good first issue"    "7057ff" "Good for newcomers"
create_label "help wanted"         "008672" "Extra attention needed"
create_label "wontfix"             "ffffff" "This will not be worked on"
create_label "duplicate"           "cfd3d7" "Duplicate issue"
SCRIPT

chmod +x scripts/create-labels.sh
bash scripts/create-labels.sh
```

### 1.5 Issue Templates

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

**Bug Report:**

```bash
cat > .github/ISSUE_TEMPLATE/bug_report.yml << 'EOF'
name: Bug Report
description: File a bug report
title: "[Bug]: "
labels: ["type: bug", "status: needs-triage"]
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Thanks for reporting a bug. Fill out the form below with as much detail as possible.

  - type: dropdown
    id: area
    attributes:
      label: Area
      options:
        - Teacher Application
        - Learner Application
        - Parent Application
        - Admin
        - AI Generation
        - Curriculum
        - Payments / Tokens
        - Infrastructure
        - Other
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Description
      description: A clear and concise description of the bug.
    validations:
      required: true

  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. See error
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: Expected Behavior
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: Actual Behavior
    validations:
      required: true

  - type: input
    id: request-id
    attributes:
      label: Request ID (if available)
      description: Found in the X-Request-ID response header or error UI.
      placeholder: "req_..."

  - type: dropdown
    id: severity
    attributes:
      label: Severity
      options:
        - Critical (data loss / security)
        - High (feature broken for many users)
        - Medium (feature broken for some users)
        - Low (cosmetic / minor inconvenience)
    validations:
      required: true
EOF
```

**Feature Request:**

```bash
cat > .github/ISSUE_TEMPLATE/feature_request.yml << 'EOF'
name: Feature Request
description: Suggest a new feature or improvement
title: "[Feature]: "
labels: ["type: feature", "status: needs-triage"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem Statement
      description: What problem does this solve for teachers, learners, or parents?
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: Proposed Solution
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives Considered
      description: What other solutions did you consider?

  - type: dropdown
    id: rfc-needed
    attributes:
      label: Does this require an RFC?
      options:
        - "No — small scoped change"
        - "Yes — affects multiple packages or API contracts"
        - "Not sure"
    validations:
      required: true
EOF
```

**RFC Template:**

```bash
cat > .github/ISSUE_TEMPLATE/rfc.yml << 'EOF'
name: RFC
description: Propose a significant architectural change
title: "[RFC]: "
labels: ["type: feature", "status: needs-rfc"]
body:
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: One paragraph describing what this RFC proposes.
    validations:
      required: true

  - type: textarea
    id: motivation
    attributes:
      label: Motivation
      description: Why is this change needed?
    validations:
      required: true

  - type: textarea
    id: design
    attributes:
      label: Detailed Design
      description: The complete technical specification.
    validations:
      required: true

  - type: textarea
    id: drawbacks
    attributes:
      label: Drawbacks
    validations:
      required: true

  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives
EOF
```

### 1.6 Pull Request Template

```bash
cat > .github/PULL_REQUEST_TEMPLATE.md << 'EOF'
## What

<!-- One-paragraph description of what this PR does. -->

## Why

<!-- Why is this change needed? Link to issue: Closes #123 -->

## How

<!-- How was the approach chosen? Any alternatives considered? -->

## Testing

<!-- How was this tested? -->

- [ ] Unit tests added / updated
- [ ] Integration tests added / updated
- [ ] Manually tested in local dev
- [ ] Preview deployment reviewed

## Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] No `any` types introduced
- [ ] No `select('*')` queries introduced
- [ ] No secrets committed
- [ ] README updated (if public API changed)
- [ ] CLAUDE.md updated (if engineering standards changed)

## Screenshots (UI changes only)

<!-- Before / After screenshots or recording -->

## Deployment Notes

<!-- Anything special about deploying this change? New env vars? Migration required? -->
EOF
```

### 1.7 GitHub Milestones

```bash
# Create milestone for the first working platform
gh api repos/edunexus/edunexus/milestones \
  --method POST \
  --field title="Green Platform" \
  --field description="pnpm dev starts all applications successfully" \
  --field due_on="$(date -d '+7 days' -u +%Y-%m-%dT%H:%M:%SZ)"

gh api repos/edunexus/edunexus/milestones \
  --method POST \
  --field title="Alpha — Teacher App" \
  --field description="Teacher app: lesson plan generation end-to-end"

gh api repos/edunexus/edunexus/milestones \
  --method POST \
  --field title="Pioneer Beta" \
  --field description="50 pioneer teachers onboarded and active"
```

### 1.8 CODEOWNERS

```bash
cat > CODEOWNERS << 'EOF'
# Global — required reviewer for all pull requests
*                                   @edunexus/platform-team

# Applications
/apps/web/                          @edunexus/platform-team
/apps/teacher/                      @edunexus/teacher-app-team
/apps/learner/                      @edunexus/learner-app-team
/apps/parent/                       @edunexus/learner-app-team
/apps/admin/                        @edunexus/platform-team
/apps/analytics/                    @edunexus/data-team
/apps/studio/                       @edunexus/curriculum-team
/apps/developers/                   @edunexus/developer-platform-team
/apps/docs/                         @edunexus/platform-team
/apps/marketing/                    @edunexus/platform-team

# Shared Packages
/packages/ui/                       @edunexus/design-system-team
/packages/icons/                    @edunexus/design-system-team
/packages/database/                 @edunexus/platform-team
/packages/auth/                     @edunexus/platform-team
/packages/curriculum/               @edunexus/curriculum-team
/packages/ai/                       @edunexus/ai-team
/packages/knowledge-graph/          @edunexus/ai-team
/packages/assessment/               @edunexus/ai-team @edunexus/curriculum-team
/packages/sdk/                      @edunexus/developer-platform-team
/packages/events/                   @edunexus/platform-team
/packages/analytics/                @edunexus/data-team
/packages/logging/                  @edunexus/platform-team
/packages/observability/            @edunexus/platform-team
/packages/security/                 @edunexus/platform-team
/packages/validation/               @edunexus/platform-team

# Services
/services/                          @edunexus/platform-team
/services/ai/                       @edunexus/ai-team @edunexus/platform-team
/services/billing/                  @edunexus/platform-team
/services/knowledge-graph/          @edunexus/ai-team

# Workers
/workers/                           @edunexus/platform-team

# Infrastructure — DevOps team required
/infra/                             @edunexus/devops-team
/docker/                            @edunexus/devops-team
/.github/                           @edunexus/platform-team @edunexus/devops-team

# Engineering standards — architects required
/CLAUDE.md                          @edunexus/platform-team
/CONTRIBUTING.md                    @edunexus/platform-team
/ARCHITECTURE.md                    @edunexus/platform-team
/turbo.json                         @edunexus/platform-team @edunexus/devops-team
/pnpm-workspace.yaml                @edunexus/platform-team
EOF
```

---

## Chapter 2 — Root Configuration

### 2.1 package.json

```bash
cat > package.json << 'EOF'
{
  "name": "edunexus",
  "version": "1.0.0",
  "private": true,
  "description": "Kenya CBC/CBE AI Education Platform — Monorepo Root",
  "homepage": "https://edunexus.co.ke",
  "repository": {
    "type": "git",
    "url": "https://github.com/edunexus/edunexus.git"
  },
  "license": "MIT",
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.14.4+sha512.6b9463e8a5bcf4bf44d4e4b0fef1c1d1a4b0e2e4a1b8c7d2e3f4a5b6c7d8e9f0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "lint:fix": "turbo lint:fix",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "test:integration": "turbo test:integration",
    "test:e2e": "turbo test:e2e",
    "clean": "turbo clean && find . -name 'node_modules' -type d -prune -exec rm -rf '{}' + 2>/dev/null; true",
    "clean:turbo": "rm -rf .turbo",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,yaml,yml,css}\" --ignore-path .prettierignore",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,json,md,yaml,yml,css}\" --ignore-path .prettierignore",
    "generate": "turbo generate",
    "generate:types": "pnpm --filter @edunexus/db-generator generate",
    "generate:sdk": "pnpm --filter @edunexus/sdk-generator generate",
    "generate:icons": "pnpm --filter @edunexus/icons generate",
    "storybook": "pnpm --filter @edunexus/ui storybook",
    "storybook:build": "turbo build:storybook",
    "db:reset": "supabase db reset",
    "db:seed": "supabase db reset",
    "db:migrate": "supabase db push",
    "db:types": "supabase gen types typescript --local > packages/database/src/types/supabase.ts",
    "infra:up": "docker compose -f docker/docker-compose.yml up -d",
    "infra:down": "docker compose -f docker/docker-compose.yml down",
    "infra:logs": "docker compose -f docker/docker-compose.yml logs -f",
    "setup": "bash scripts/setup.sh",
    "ai:evaluate": "turbo ai:evaluate",
    "arch:test": "pnpm --filter @edunexus/arch-tests test",
    "changeset": "changeset",
    "version": "changeset version",
    "publish": "changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "prettier": "^3.3.0",
    "turbo": "^2.3.0"
  },
  "pnpm": {
    "overrides": {
      "typescript": "^5.7.0"
    },
    "peerDependencyRules": {
      "allowAny": ["react", "react-dom"]
    }
  }
}
EOF
```

### 2.2 pnpm-workspace.yaml

```bash
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
  - "workers/*"
  - "tooling/*"

# Catalog: shared dependency versions (pnpm 9.5+)
catalog:
  # React
  react: "^19.0.0"
  react-dom: "^19.0.0"
  "@types/react": "^19.0.0"
  "@types/react-dom": "^19.0.0"

  # Next.js
  next: "^15.1.0"

  # TypeScript
  typescript: "^5.7.0"

  # Supabase
  "@supabase/supabase-js": "^2.47.0"
  "@supabase/ssr": "^0.5.0"

  # Validation
  zod: "^3.24.0"

  # Tailwind
  tailwindcss: "^4.0.0"
  "@tailwindcss/typography": "^0.5.0"

  # Testing
  vitest: "^2.1.0"
  "@vitest/coverage-v8": "^2.1.0"
  "@testing-library/react": "^16.0.0"
  "@testing-library/user-event": "^14.0.0"

  # Utilities
  clsx: "^2.1.0"
  "tailwind-merge": "^2.5.0"
  "class-variance-authority": "^0.7.0"

  # Radix UI
  "@radix-ui/react-dialog": "^1.1.0"
  "@radix-ui/react-dropdown-menu": "^2.1.0"
  "@radix-ui/react-label": "^2.1.0"
  "@radix-ui/react-select": "^2.1.0"
  "@radix-ui/react-slot": "^1.1.0"
  "@radix-ui/react-tabs": "^1.1.0"
  "@radix-ui/react-tooltip": "^1.1.0"

  # Logging
  pino: "^9.5.0"
EOF
```

### 2.3 turbo.json

```bash
cat > turbo.json << 'EOF'
{
  "$schema": "https://turborepo.org/schema.json",
  "ui": "tui",
  "daemon": true,
  "globalEnv": [
    "NODE_ENV",
    "VERCEL_ENV",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL"
  ],
  "globalDependencies": [
    "tsconfig.base.json",
    "pnpm-workspace.yaml"
  ],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx,js,jsx}",
        "package.json",
        "tsconfig.json",
        "next.config.*",
        "tailwind.config.*",
        "!**/*.test.{ts,tsx}",
        "!**/*.spec.{ts,tsx}"
      ],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**",
        "storybook-static/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx,js,jsx}",
        "eslint.config.*",
        ".eslintrc.*",
        "package.json"
      ]
    },
    "lint:fix": {
      "cache": false,
      "inputs": [
        "src/**/*.{ts,tsx,js,jsx}"
      ]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx}",
        "tsconfig.json",
        "tsconfig.*.json"
      ]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx}",
        "tests/**/*.{ts,tsx}",
        "vitest.config.*"
      ],
      "outputs": [
        "coverage/**"
      ],
      "env": [
        "DATABASE_URL",
        "REDIS_URL",
        "TEST_*"
      ]
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**/*.{ts,tsx}",
        "tests/integration/**/*.{ts,tsx}"
      ],
      "cache": false,
      "env": [
        "DATABASE_URL",
        "REDIS_URL",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY"
      ]
    },
    "test:e2e": {
      "dependsOn": ["build"],
      "cache": false,
      "env": [
        "PLAYWRIGHT_BASE_URL",
        "TEST_TEACHER_EMAIL",
        "TEST_TEACHER_PASSWORD"
      ]
    },
    "ai:evaluate": {
      "dependsOn": ["^build"],
      "inputs": [
        "prompts/**",
        "src/generators/**"
      ],
      "cache": false,
      "env": [
        "DEEPSEEK_API_KEY",
        "AI_EVAL_SAMPLE_SIZE"
      ]
    },
    "storybook": {
      "cache": false,
      "persistent": true
    },
    "build:storybook": {
      "dependsOn": ["^build"],
      "outputs": ["storybook-static/**"]
    },
    "generate": {
      "cache": false,
      "inputs": [
        "schema.sql",
        "openapi.yaml",
        "*.sql"
      ]
    },
    "clean": {
      "cache": false
    }
  }
}
EOF
```

### 2.4 tsconfig.base.json

```bash
cat > tsconfig.base.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "EduNexus Base TypeScript Configuration",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "moduleDetection": "force",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "allowJs": false,
    "checkJs": false,

    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "inlineSources": false,

    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,

    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "exclude": [
    "node_modules",
    "dist",
    ".next",
    "coverage",
    "storybook-static",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.spec.ts",
    "**/*.spec.tsx"
  ]
}
EOF
```

### 2.5 ESLint Configuration

EduNexus uses the flat ESLint config format (ESLint v9+):

```bash
cat > eslint.config.js << 'EOF'
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/coverage/**',
      '**/storybook-static/**',
      '**/.turbo/**',
      '**/generated/**',
      'packages/database/src/types/supabase.ts',
    ],
  },

  // TypeScript-specific rules
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // No any — ever
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Explicit types
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // No floating promises
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Prefer const assertions
      '@typescript-eslint/prefer-as-const': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // No unused vars
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],

      // No direct supabase-js createClient imports
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@supabase/supabase-js'],
            importNames: ['createClient'],
            message: 'Use @edunexus/database client factories instead. See packages/database/src/client/.',
          },
        ],
        paths: [
          {
            name: 'react',
            importNames: ['default'],
            message: 'Import named exports from react instead.',
          },
        ],
      }],

      // No console.log
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Import ordering
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
          'type',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc' },
      }],

      // No default exports (except Next.js pages/layouts)
      'import/no-default-export': 'warn',
    },
  },

  // Relax default export rule for Next.js files
  {
    files: [
      '**/app/**/page.tsx',
      '**/app/**/layout.tsx',
      '**/app/**/loading.tsx',
      '**/app/**/error.tsx',
      '**/app/**/not-found.tsx',
      '**/app/**/route.ts',
      '**/next.config.*',
      '**/tailwind.config.*',
      '**/*.stories.{ts,tsx}',
    ],
    rules: {
      'import/no-default-export': 'off',
    },
  },
);
EOF
```

### 2.6 Prettier Configuration

```bash
cat > prettier.config.js << 'EOF'
/** @type {import('prettier').Config} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindConfig: './packages/ui/tailwind.config.ts',
};
EOF

cat > .prettierignore << 'EOF'
node_modules
.next
dist
coverage
storybook-static
.turbo
packages/database/src/types/supabase.ts
pnpm-lock.yaml
*.md
EOF
```

### 2.7 .editorconfig

```bash
cat > .editorconfig << 'EOF'
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
max_line_length = 100

[*.md]
trim_trailing_whitespace = false
max_line_length = off

[Makefile]
indent_style = tab

[*.{yaml,yml}]
indent_size = 2

[*.json]
indent_size = 2

[*.sql]
indent_size = 2

[*.sh]
indent_style = space
indent_size = 2
EOF
```

### 2.8 .nvmrc

```bash
echo "22.12.0" > .nvmrc
echo "22.12.0" > .node-version
```

### 2.9 .gitignore

```bash
cat > .gitignore << 'EOF'
# Dependencies
node_modules
.pnpm-store

# Build outputs
.next
dist
build
out
storybook-static

# Turbo
.turbo

# Environment
.env
.env.local
.env.*.local
.env.development
.env.production
.env.staging

# Test
coverage
.nyc_output
test-results
playwright-report
blob-report

# IDEs
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
!.vscode/launch.json
!.vscode/tasks.json
.idea
*.swp
*.swo
.DS_Store

# Logs
*.log
logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Supabase
supabase/.temp
supabase/.branches

# Generated files (regenerated on demand)
# NOTE: packages/database/src/types/supabase.ts IS committed
# NOTE: packages/curriculum/src/data/ IS committed

# Docker
docker-compose.override.yml

# OS
Thumbs.db
ehthumbs.db
Desktop.ini

# Secrets (should never be committed)
*.pem
*.key
*.pfx
secrets/
.secrets/
EOF
```

### 2.10 .gitattributes

```bash
cat > .gitattributes << 'EOF'
# Default — text files use LF
* text=auto eol=lf

# Explicitly text files
*.ts text eol=lf
*.tsx text eol=lf
*.js text eol=lf
*.jsx text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yaml text eol=lf
*.yml text eol=lf
*.css text eol=lf
*.html text eol=lf
*.sh text eol=lf
*.sql text eol=lf
*.toml text eol=lf

# Binary files — do not diff
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.webp binary
*.woff binary
*.woff2 binary
*.ttf binary
*.eot binary
*.svg text eol=lf

# Diff as text
pnpm-lock.yaml -diff
EOF
```

### 2.11 .env.example

```bash
cat > .env.example << 'EOF'
# ============================================================
# EduNexus Environment Variables
# ============================================================
# Copy this file to .env.local and fill in values.
# NEVER commit .env.local or any file with real secrets.
# ============================================================

# ── Supabase ────────────────────────────────────────────────
# Project URL from Supabase dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Anon/public key — safe to expose to browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Service role key — NEVER expose to browser or Next.js client components
# Used only in: services/*, workers/*, and server-side API routes
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ── Application URLs ─────────────────────────────────────────
# In development, all apps run on localhost with different ports
NEXT_PUBLIC_WEB_URL=http://localhost:3000
NEXT_PUBLIC_TEACHER_URL=http://localhost:3001
NEXT_PUBLIC_LEARNER_URL=http://localhost:3002
NEXT_PUBLIC_PARENT_URL=http://localhost:3003
NEXT_PUBLIC_ADMIN_URL=http://localhost:3004
NEXT_PUBLIC_ANALYTICS_URL=http://localhost:3005
NEXT_PUBLIC_DEVELOPERS_URL=http://localhost:3006

# ── AI Provider ──────────────────────────────────────────────
# DeepSeek API key for AI generation
# https://platform.deepseek.com/api_keys
DEEPSEEK_API_KEY=sk-...

# AI model configuration
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_MAX_TOKENS=4096

# ── Payments (Paystack) ──────────────────────────────────────
# https://dashboard.paystack.com/#/settings/developer
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_...

# Webhook secret for verifying Paystack webhooks
PAYSTACK_WEBHOOK_SECRET=your-webhook-secret

# ── Redis ─────────────────────────────────────────────────────
# Local: redis://localhost:6379
# Production: Upstash Redis URL
REDIS_URL=redis://localhost:6379

# ── ClickHouse (Analytics) ────────────────────────────────────
# Local: http://localhost:8123
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=edunexus_analytics

# ── Email ─────────────────────────────────────────────────────
# Local: Mailpit SMTP (http://localhost:8025 for web UI)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@edunexus.co.ke

# ── SMS (Africa's Talking) ────────────────────────────────────
AFRICASTALKING_API_KEY=your-api-key
AFRICASTALKING_USERNAME=sandbox
AFRICASTALKING_SENDER_ID=EduNexus

# ── Storage ───────────────────────────────────────────────────
# Local: MinIO (Supabase Storage uses Supabase's built-in)
STORAGE_BUCKET_REPORTS=reports
STORAGE_BUCKET_UPLOADS=uploads
STORAGE_BUCKET_ASSETS=assets

# ── Observability ─────────────────────────────────────────────
# Local: Grafana Tempo OTLP gRPC endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=edunexus-local

# Log level: trace | debug | info | warn | error
LOG_LEVEL=info

# ── Feature Flags ─────────────────────────────────────────────
FEATURE_PARENT_PULSE=true
FEATURE_CAREER_SIMULATION=true
FEATURE_KNOWLEDGE_GRAPH_V2=false

# ── Development Only ──────────────────────────────────────────
# Set to true to enable /api/test-* routes (NEVER in production)
ENABLE_TEST_ROUTES=false

# ── Node ─────────────────────────────────────────────────────
NODE_ENV=development
EOF
```

### 2.12 README.md

```bash
cat > README.md << 'EOF'
# EduNexus

Kenya's CBC/CBE AI Education Platform.

EduNexus serves teachers, learners, and parents with AI-powered lesson planning, assessment generation, learner intelligence, and career guidance — built specifically for the Kenya Competency-Based Curriculum.

## Quick Start

```bash
# Prerequisites: Node 22, pnpm 9, Docker
git clone git@github.com:edunexus/edunexus.git
cd edunexus
pnpm install
bash scripts/setup.sh
pnpm dev
```

| Application | URL |
|-------------|-----|
| Web / Marketing | http://localhost:3000 |
| Teacher App | http://localhost:3001 |
| Learner App | http://localhost:3002 |
| Parent App | http://localhost:3003 |
| Admin | http://localhost:3004 |
| Supabase Studio | http://localhost:54323 |
| Email (Mailpit) | http://localhost:8025 |

## Documentation

- [Monorepo Foundation Specification](docs/monorepo-foundation-specification.md)
- [Repository Bootstrap Guide](docs/repository-bootstrap-guide.md)
- [Engineering Handbook](docs/engineering/)
- [Architecture](ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)

## Tech Stack

- **Apps:** Next.js 15, React 19, Tailwind CSS 4
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Realtime)
- **AI:** DeepSeek
- **Payments:** Paystack
- **Queues:** BullMQ + Redis
- **Analytics:** ClickHouse
- **Build:** Turborepo + pnpm workspaces
- **Deploy:** Vercel (apps), Fly.io (services), Supabase (database)

## Structure

```
apps/       # User-facing applications
packages/   # Shared libraries
services/   # Backend services
workers/    # Async job processors
tooling/    # Developer tools
infra/      # Infrastructure as code
```

## License

MIT © EduNexus
EOF
```

### 2.13 SECURITY.md

```bash
cat > SECURITY.md << 'EOF'
# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✓         |
| < Latest | Security patches only |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Email: security@edunexus.co.ke

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

## Response Timeline

- **24 hours:** Acknowledgement of report
- **72 hours:** Initial assessment and severity classification
- **7 days:** Fix for Critical (CVSS 9.0+) vulnerabilities
- **30 days:** Fix for High (CVSS 7.0–8.9) vulnerabilities
- **90 days:** Fix for Medium and Low vulnerabilities

## Disclosure Policy

We follow coordinated disclosure. Vulnerabilities will not be publicly disclosed until a fix is deployed, unless the reporter agrees to a shorter timeline.

## Hall of Fame

Security researchers who responsibly disclose vulnerabilities are recognized in our release notes and Hall of Fame page at edunexus.co.ke/security/thanks.

## Security Standards

EduNexus follows OWASP Top 10 guidelines and Kenya Data Protection Act (DPA) 2019 requirements for all student data handling.
EOF
```

### 2.14 CONTRIBUTING.md

```bash
cat > CONTRIBUTING.md << 'EOF'
# Contributing to EduNexus

## Setup

```bash
git clone git@github.com:edunexus/edunexus.git
cd edunexus
pnpm install
bash scripts/setup.sh
```

See [Repository Bootstrap Guide](docs/repository-bootstrap-guide.md) for complete setup instructions.

## Branching

```
feat/description         # New feature
fix/description          # Bug fix
refactor/description     # Refactoring
docs/description         # Documentation
perf/description         # Performance
security/description     # Security fix
hotfix/description       # Emergency production fix
```

Branches live no longer than 2 days before merging.

## Commit Messages

```
feat: short description 🎯
fix: short description 🔧
refactor: short description ♻️
docs: short description 📋
perf: short description ⚡
security: short description 🔒
chore: short description 🧹
```

## Before Pushing

```bash
pnpm lint        # Must pass
pnpm typecheck   # Must pass
pnpm test        # Must pass
```

## Pull Requests

1. Fill out the PR template completely
2. Link to the relevant issue
3. Add screenshots for UI changes
4. Ensure all CI checks pass
5. Respond to review feedback within 24 hours

## Standards

- No `any` TypeScript types
- No `select('*')` Supabase queries
- No `console.log` (use structured logger)
- No business logic in API routes
- No direct Supabase client imports (use `@edunexus/database`)
- Every new API route must check auth first

See [CLAUDE.md](CLAUDE.md) for the complete engineering standards.

## RFCs

Changes to package boundaries, public API contracts, or database schemas require an RFC. File an issue using the RFC template.

## Need Help?

Open an issue with the "help wanted" label or ask in #engineering on Slack.
EOF
```

### 2.15 ARCHITECTURE.md

```bash
cat > ARCHITECTURE.md << 'EOF'
# EduNexus Architecture

## Core Documents

| Document | Purpose |
|----------|---------|
| [Monorepo Foundation Specification](docs/monorepo-foundation-specification.md) | Repository structure, packages, services, tooling |
| [Repository Bootstrap Guide](docs/repository-bootstrap-guide.md) | Step-by-step implementation guide |
| [Canonical Reference Architecture](docs/edunexus-canonical-architecture.md) | Complete platform architecture |
| [Educational Knowledge Graph](docs/the-educational-knowledge-graph.md) | CBC curriculum graph engineering |
| [Educational AI Systems](docs/educational-ai-systems.md) | AI system design |
| [Platform Implementation Guide](docs/platform-implementation-guide.md) | Production code patterns |

## Architecture Decision Records

ADRs are in [docs/architecture/adrs/](docs/architecture/adrs/).

| ADR | Title | Status |
|-----|-------|--------|
| [0001](docs/architecture/adrs/0001-turborepo-pnpm-monorepo.md) | Turborepo + pnpm monorepo | Accepted |
| [0002](docs/architecture/adrs/0002-nextjs-app-router.md) | Next.js App Router | Accepted |
| [0003](docs/architecture/adrs/0003-supabase.md) | Supabase for database + auth | Accepted |
| [0004](docs/architecture/adrs/0004-deepseek.md) | DeepSeek for AI generation | Accepted |
| [0005](docs/architecture/adrs/0005-bullmq-redis.md) | BullMQ + Redis for job queues | Accepted |

## Quick Reference

- **Database:** Supabase (PostgreSQL 15+), RLS enabled everywhere
- **Auth:** Supabase Auth (email/password + Google OAuth)
- **AI:** DeepSeek API via `services/ai`
- **Queues:** BullMQ + Redis (Upstash in production)
- **Analytics:** ClickHouse via `services/analytics`
- **Deploy:** Vercel (apps), Fly.io (services)
- **Monitoring:** Grafana + Prometheus + Tempo + Loki
EOF
```

---

# Part II — Workspace Bootstrap

---

## Chapter 3 — Creating Applications

### 3.1 Scaffold Script

Create a reusable application scaffold script:

```bash
cat > scripts/scaffold-app.sh << 'SCRIPT'
#!/bin/bash
# Usage: bash scripts/scaffold-app.sh <app-name> <port>
# Example: bash scripts/scaffold-app.sh teacher 3001

APP=$1
PORT=$2

if [ -z "$APP" ] || [ -z "$PORT" ]; then
  echo "Usage: bash scripts/scaffold-app.sh <app-name> <port>"
  exit 1
fi

APP_DIR="apps/$APP"
PKG_NAME="@edunexus/app-$APP"

echo "→ Scaffolding $APP_DIR..."
mkdir -p "$APP_DIR/app" "$APP_DIR/components" "$APP_DIR/lib" "$APP_DIR/public"

# package.json
cat > "$APP_DIR/package.json" << EOF
{
  "name": "$PKG_NAME",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port $PORT --turbopack",
    "build": "next build",
    "start": "next start --port $PORT",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "clean": "rm -rf .next dist"
  },
  "dependencies": {
    "@edunexus/database": "workspace:*",
    "@edunexus/ui": "workspace:*",
    "@edunexus/auth": "workspace:*",
    "@edunexus/validation": "workspace:*",
    "@edunexus/logging": "workspace:*",
    "@edunexus/config": "workspace:*",
    "next": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@edunexus/eslint-config": "workspace:*",
    "@edunexus/typescript-config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
EOF

# tsconfig.json
cat > "$APP_DIR/tsconfig.json" << EOF
{
  "extends": "@edunexus/typescript-config/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./components/*"],
      "@lib/*": ["./lib/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# next.config.ts
cat > "$APP_DIR/next.config.ts" << EOF
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@edunexus/ui',
    '@edunexus/icons',
    '@edunexus/curriculum',
    '@edunexus/analytics',
    '@edunexus/auth',
  ],
  experimental: {
    serverComponentsExternalPackages: ['@edunexus/database', 'pino'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
EOF

# tailwind.config.ts
cat > "$APP_DIR/tailwind.config.ts" << EOF
import type { Config } from 'tailwindcss';
import sharedConfig from '@edunexus/ui/tailwind.config';

export default {
  ...sharedConfig,
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
EOF

# app/layout.tsx
cat > "$APP_DIR/app/layout.tsx" << EOF
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EduNexus',
  description: 'Kenya CBC/CBE AI Education Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
EOF

# app/globals.css
cat > "$APP_DIR/app/globals.css" << EOF
@import 'tailwindcss';

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
}

body {
  @apply bg-background text-foreground;
}
EOF

# app/page.tsx
cat > "$APP_DIR/app/page.tsx" << EOF
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">EduNexus — $APP</h1>
        <p className="mt-2 text-gray-500">Coming soon</p>
      </div>
    </main>
  );
}
EOF

# README
cat > "$APP_DIR/README.md" << EOF
# @edunexus/app-$APP

EduNexus $APP application.

## Development

\`\`\`bash
pnpm --filter @edunexus/app-$APP dev
\`\`\`

Runs on http://localhost:$PORT
EOF

echo "✓ Scaffolded $APP_DIR (port $PORT)"
SCRIPT

chmod +x scripts/scaffold-app.sh
```

### 3.2 Bootstrap All Applications

```bash
# Create all applications
bash scripts/scaffold-app.sh web 3000
bash scripts/scaffold-app.sh teacher 3001
bash scripts/scaffold-app.sh learner 3002
bash scripts/scaffold-app.sh parent 3003
bash scripts/scaffold-app.sh admin 3004
bash scripts/scaffold-app.sh analytics 3005
bash scripts/scaffold-app.sh developers 3006
bash scripts/scaffold-app.sh studio 3007
bash scripts/scaffold-app.sh docs 3008
bash scripts/scaffold-app.sh marketing 3009
```

### 3.3 apps/web — Specific Configuration

The web app handles marketing and authentication entry:

```bash
# Add marketing-specific dependencies
cat > apps/web/package.json << 'EOF'
{
  "name": "@edunexus/app-web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000 --turbopack",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf .next"
  },
  "dependencies": {
    "@edunexus/ui": "workspace:*",
    "@edunexus/auth": "workspace:*",
    "@edunexus/database": "workspace:*",
    "@edunexus/analytics": "workspace:*",
    "@edunexus/config": "workspace:*",
    "next": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "@next/mdx": "^15.0.0",
    "next-mdx-remote": "^5.0.0"
  },
  "devDependencies": {
    "@edunexus/eslint-config": "workspace:*",
    "@edunexus/typescript-config": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
EOF

# Create the marketing route group structure
mkdir -p apps/web/app/\(marketing\)
mkdir -p apps/web/app/\(auth\)/sign-in
mkdir -p apps/web/app/\(auth\)/sign-up
mkdir -p apps/web/app/\(auth\)/forgot-password
mkdir -p apps/web/app/auth/callback
mkdir -p apps/web/app/api/waitlist
mkdir -p apps/web/content/blog

# Marketing layout
cat > "apps/web/app/(marketing)/layout.tsx" << 'EOF'
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
EOF

# Auth callback route
cat > apps/web/app/auth/callback/route.ts << 'EOF'
import { createServerSupabaseClient } from '@edunexus/database';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerSupabaseClient(cookieStore);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_callback_error`);
}
EOF
```

### 3.4 apps/teacher — Full Application Structure

The teacher app is the primary product. It gets the most complete initial structure:

```bash
# Create teacher app directory structure
mkdir -p apps/teacher/app/\(auth\)/dashboard
mkdir -p apps/teacher/app/\(auth\)/lesson-plans/new
mkdir -p "apps/teacher/app/(auth)/lesson-plans/[id]"
mkdir -p apps/teacher/app/\(auth\)/sow/new
mkdir -p "apps/teacher/app/(auth)/sow/[id]"
mkdir -p apps/teacher/app/\(auth\)/assessments/new
mkdir -p apps/teacher/app/\(auth\)/learners
mkdir -p apps/teacher/app/\(auth\)/settings/subscription
mkdir -p apps/teacher/app/api/lesson-plans/generate
mkdir -p apps/teacher/app/api/sow/generate
mkdir -p apps/teacher/app/api/tokens/balance
mkdir -p apps/teacher/app/auth/callback
mkdir -p apps/teacher/components/lesson-plan
mkdir -p apps/teacher/components/sow
mkdir -p apps/teacher/components/shared
mkdir -p apps/teacher/lib/lesson-plan
mkdir -p apps/teacher/lib/sow
mkdir -p apps/teacher/lib/ai

# Middleware for auth protection
cat > apps/teacher/middleware.ts << 'EOF'
import { createServerSupabaseClient } from '@edunexus/database';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const PUBLIC_PATHS = ['/auth/', '/api/auth/'];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const signInUrl = new URL(
      process.env['NEXT_PUBLIC_WEB_URL'] + '/auth/sign-in',
    );
    signInUrl.searchParams.set('redirect', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};
EOF

# Protected layout
cat > "apps/teacher/app/(auth)/layout.tsx" << 'EOF'
import { createServerSupabaseClient } from '@edunexus/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(process.env['NEXT_PUBLIC_WEB_URL'] + '/auth/sign-in');
  }

  return <div className="min-h-screen">{children}</div>;
}
EOF

# Dashboard page
cat > "apps/teacher/app/(auth)/dashboard/page.tsx" << 'EOF'
import { createServerSupabaseClient } from '@edunexus/database';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Dashboard — EduNexus Teacher' };

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Good morning, {user?.email}</h1>
      <p className="mt-2 text-gray-500">Dashboard coming soon.</p>
    </main>
  );
}
EOF
```

### 3.5 Shared Next.js Providers Pattern

Create a providers pattern used by all apps:

```bash
mkdir -p packages/ui/src/providers

cat > packages/ui/src/providers/index.tsx << 'EOF'
'use client';

import type { ReactNode } from 'react';
import { Toaster } from '../feedback/toast';

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps): JSX.Element {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
EOF
```

---

## Chapter 4 — Shared Packages

### 4.1 packages/typescript-config

```bash
mkdir -p packages/typescript-config

cat > packages/typescript-config/package.json << 'EOF'
{
  "name": "@edunexus/typescript-config",
  "version": "0.0.1",
  "private": true,
  "license": "MIT",
  "files": ["*.json"],
  "scripts": {
    "clean": "true"
  }
}
EOF

# Base config (already done in root — reference it)
cat > packages/typescript-config/base.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../tsconfig.base.json"
}
EOF

cat > packages/typescript-config/nextjs.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "allowJs": true,
    "jsx": "preserve",
    "plugins": [{ "name": "next" }],
    "incremental": true
  }
}
EOF

cat > packages/typescript-config/react-library.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
EOF

cat > packages/typescript-config/node.json << 'EOF'
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022"
  }
}
EOF
```

### 4.2 packages/eslint-config

```bash
mkdir -p packages/eslint-config/src

cat > packages/eslint-config/package.json << 'EOF'
{
  "name": "@edunexus/eslint-config",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    "./base": "./src/base.js",
    "./next": "./src/next.js",
    "./react": "./src/react.js"
  },
  "dependencies": {
    "@eslint/js": "^9.0.0",
    "eslint-plugin-import": "^2.31.0",
    "typescript-eslint": "^8.0.0"
  },
  "peerDependencies": {
    "eslint": "^9.0.0"
  }
}
EOF

cat > packages/eslint-config/src/base.js << 'EOF'
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'inline-type-imports',
      }],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@supabase/supabase-js'],
          importNames: ['createClient'],
          message: 'Use @edunexus/database client factories instead.',
        }],
      }],
    },
  },
];
EOF
```

### 4.3 packages/config

```bash
mkdir -p packages/config/src

cat > packages/config/package.json << 'EOF'
{
  "name": "@edunexus/config",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@edunexus/typescript-config": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
EOF

cat > packages/config/src/env.ts << 'EOF'
import { z } from 'zod';

const EnvironmentSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // AI
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
  DEEPSEEK_MAX_TOKENS: z.coerce.number().default(4096),

  // Payments
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().min(1).optional(),

  // Redis
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Node
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // App URLs
  NEXT_PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_TEACHER_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_LEARNER_URL: z.string().url().default('http://localhost:3002'),
  NEXT_PUBLIC_PARENT_URL: z.string().url().default('http://localhost:3003'),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().default('http://localhost:3004'),

  // Feature flags
  FEATURE_PARENT_PULSE: z.coerce.boolean().default(false),
  FEATURE_CAREER_SIMULATION: z.coerce.boolean().default(false),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

function parseEnv(): Environment {
  const result = EnvironmentSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.flatten().fieldErrors);
    throw new Error('Invalid environment configuration. See above for details.');
  }
  return result.data;
}

// Cache the parsed env
let _env: Environment | undefined;
export function getEnv(): Environment {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}
EOF

cat > packages/config/src/tokens.ts << 'EOF'
export const TOKEN_COSTS = {
  LESSON_PLAN: 5,
  SCHEME_OF_WORK: 20,
  ASSESSMENT: 10,
  FEEDBACK: 2,
  CLINIC_REPORT: 15,
  PARENT_PULSE: 3,
  REVISION_PLAN: 8,
} as const;

export type TokenCostKey = keyof typeof TOKEN_COSTS;

export const TOKEN_PACKAGES = {
  STARTER: { tokens: 100, priceKes: 500 },
  STANDARD: { tokens: 500, priceKes: 2000 },
  PROFESSIONAL: { tokens: 1500, priceKes: 5000 },
  SCHOOL: { tokens: 10000, priceKes: 25000 },
} as const;
EOF

cat > packages/config/src/index.ts << 'EOF'
export { getEnv, type Environment } from './env';
export { TOKEN_COSTS, TOKEN_PACKAGES, type TokenCostKey } from './tokens';
EOF

cat > packages/config/tsconfig.json << 'EOF'
{
  "extends": "@edunexus/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
EOF
```

### 4.4 packages/database

```bash
mkdir -p packages/database/src/client
mkdir -p packages/database/src/types

cat > packages/database/package.json << 'EOF'
{
  "name": "@edunexus/database",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "react-server": "./src/index.server.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@edunexus/config": "workspace:*",
    "@supabase/supabase-js": "catalog:",
    "@supabase/ssr": "catalog:"
  },
  "devDependencies": {
    "@edunexus/typescript-config": "workspace:*",
    "@types/node": "^22.0.0",
    "typescript": "catalog:"
  }
}
EOF

cat > packages/database/src/client/server.ts << 'EOF'
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '../types/supabase';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function createServerSupabaseClient(cookieStore: CookieStore) {
  return createServerClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from Server Component — cookies cannot be set
          }
        },
      },
    },
  );
}
EOF

cat > packages/database/src/client/service.ts << 'EOF'
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

let _serviceClient: ReturnType<typeof createClient<Database>> | undefined;

export function createServiceClient() {
  if (_serviceClient) return _serviceClient;

  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to use the service client');
  }

  _serviceClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _serviceClient;
}
EOF

cat > packages/database/src/client/browser.ts << 'EOF'
'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/supabase';

let _browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createBrowserSupabaseClient() {
  if (_browserClient) return _browserClient;

  _browserClient = createBrowserClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  );

  return _browserClient;
}
EOF

# Placeholder types — will be regenerated from Supabase schema
cat > packages/database/src/types/supabase.ts << 'EOF'
// This file is auto-generated. Do not edit manually.
// Run: pnpm db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
EOF

cat > packages/database/src/index.ts << 'EOF'
export { createBrowserSupabaseClient } from './client/browser';
export type { Database, Json } from './types/supabase';
EOF

cat > packages/database/src/index.server.ts << 'EOF'
export { createServerSupabaseClient } from './client/server';
export { createServiceClient } from './client/service';
export type { Database, Json } from './types/supabase';
EOF

cat > packages/database/tsconfig.json << 'EOF'
{
  "extends": "@edunexus/typescript-config/nextjs.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true
  },
  "include": ["src"]
}
EOF
```

### 4.5 packages/auth

```bash
mkdir -p packages/auth/src

cat > packages/auth/package.json << 'EOF'
{
  "name": "@edunexus/auth",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@edunexus/database": "workspace:*",
    "next": "catalog:"
  },
  "devDependencies": {
    "@edunexus/typescript-config": "workspace:*",
    "typescript": "catalog:"
  }
}
EOF

cat > packages/auth/src/get-user.ts << 'EOF'
import { createServerSupabaseClient } from '@edunexus/database';
import { cookies } from 'next/headers';

export type AuthUser = {
  id: string;
  email: string;
  role: 'teacher' | 'learner' | 'parent' | 'admin';
};

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return {
    id: user.id,
    email: user.email,
    role: (user.user_metadata['role'] as AuthUser['role']) ?? 'teacher',
  };
}

export async function requireAuthUser(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
EOF

cat > packages/auth/src/index.ts << 'EOF'
export { getAuthUser, requireAuthUser, type AuthUser } from './get-user';
EOF
```

### 4.6 packages/logging

```bash
mkdir -p packages/logging/src

cat > packages/logging/package.json << 'EOF'
{
  "name": "@edunexus/logging",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "pino": "catalog:"
  },
  "devDependencies": {
    "@edunexus/typescript-config": "workspace:*",
    "@types/node": "^22.0.0",
    "typescript": "catalog:"
  }
}
EOF

cat > packages/logging/src/logger.ts << 'EOF'
import pino from 'pino';

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(service: string) {
  return pino({
    name: service,
    level: process.env['LOG_LEVEL'] ?? 'info',
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label: string) => ({ level: label }),
    },
    redact: {
      paths: ['*.password', '*.token', '*.apiKey', '*.secret'],
      censor: '[REDACTED]',
    },
  });
}
EOF

cat > packages/logging/src/index.ts << 'EOF'
export { createLogger, type Logger } from './logger';
EOF
```

### 4.7 packages/validation

```bash
mkdir -p packages/validation/src

cat > packages/validation/package.json << 'EOF'
{
  "name": "@edunexus/validation",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "catalog:"
  },
  "devDependencies": {
    "@edunexus/typescript-config": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
EOF

cat > packages/validation/src/teacher.ts << 'EOF'
import { z } from 'zod';

export const TeacherSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  school: z.string().min(1).max(200),
  subjects: z.array(z.string()),
  grades: z.array(z.number().int().min(7).max(12)),
  curriculumType: z.enum(['cbc-junior', 'cbc-senior', '8-4-4', 'igcse']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Teacher = z.infer<typeof TeacherSchema>;
EOF

cat > packages/validation/src/lesson-plan.ts << 'EOF'
import { z } from 'zod';

export const LessonPlanGenerateRequestSchema = z.object({
  subject: z.string().min(1).max(100),
  topic: z.string().min(1).max(200),
  grade: z.number().int().min(7).max(12),
  duration: z.number().int().min(20).max(120),
  curriculumType: z.enum(['cbc-junior', 'cbc-senior', '8-4-4', 'igcse']),
  specificObjectives: z.array(z.string()).optional(),
  learnerLevel: z.enum(['below-expected', 'at-expected', 'above-expected']).optional(),
});

export type LessonPlanGenerateRequest = z.infer<typeof LessonPlanGenerateRequestSchema>;

export const LessonPlanSchema = z.object({
  id: z.string().uuid(),
  teacherId: z.string().uuid(),
  subject: z.string(),
  topic: z.string(),
  grade: z.number().int(),
  duration: z.number().int(),
  curriculumType: z.enum(['cbc-junior', 'cbc-senior', '8-4-4', 'igcse']),
  content: z.string(),
  tokensUsed: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LessonPlan = z.infer<typeof LessonPlanSchema>;
EOF

cat > packages/validation/src/index.ts << 'EOF'
export {
  TeacherSchema,
  type Teacher,
} from './teacher';

export {
  LessonPlanGenerateRequestSchema,
  LessonPlanSchema,
  type LessonPlanGenerateRequest,
  type LessonPlan,
} from './lesson-plan';
EOF
```

### 4.8 packages/ui

```bash
mkdir -p packages/ui/src/primitives
mkdir -p packages/ui/src/layout
mkdir -p packages/ui/src/feedback

cat > packages/ui/package.json << 'EOF'
{
  "name": "@edunexus/ui",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./tailwind.config": "./tailwind.config.ts"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "storybook": "storybook dev -p 6006",
    "build:storybook": "storybook build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist storybook-static"
  },
  "dependencies": {
    "@edunexus/icons": "workspace:*",
    "@edunexus/utils": "workspace:*",
    "@radix-ui/react-dialog": "catalog:",
    "@radix-ui/react-dropdown-menu": "catalog:",
    "@radix-ui/react-label": "catalog:",
    "@radix-ui/react-select": "catalog:",
    "@radix-ui/react-slot": "catalog:",
    "@radix-ui/react-tabs": "catalog:",
    "@radix-ui/react-tooltip": "catalog:",
    "class-variance-authority": "catalog:",
    "clsx": "catalog:",
    "tailwind-merge": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@edunexus/typescript-config": "workspace:*",
    "@storybook/react": "^8.0.0",
    "@storybook/nextjs": "^8.0.0",
    "@testing-library/react": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "tailwindcss": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
EOF

cat > packages/ui/src/primitives/button.tsx << 'EOF'
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '../utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
EOF

cat > packages/ui/src/utils.ts << 'EOF'
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
EOF

cat > packages/ui/src/index.ts << 'EOF'
export { Button, type ButtonProps } from './primitives/button';
export { cn } from './utils';
EOF

cat > packages/ui/tailwind.config.ts << 'EOF'
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#16A34A',     // EduNexus green
          foreground: '#FFFFFF',
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          700: '#15803D',
          900: '#14532D',
        },
        background: '#FFFFFF',
        foreground: '#09090B',
        accent: '#F4F4F5',
        'accent-foreground': '#18181B',
        destructive: '#EF4444',
        'destructive-foreground': '#FAFAFA',
        border: '#E4E4E7',
        input: '#E4E4E7',
        ring: '#16A34A',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
EOF

cat > packages/ui/tsconfig.json << 'EOF'
{
  "extends": "@edunexus/typescript-config/react-library.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src", "tailwind.config.ts"]
}
EOF
```

### 4.9 packages/utils

```bash
mkdir -p packages/utils/src

cat > packages/utils/package.json << 'EOF'
{
  "name": "@edunexus/utils",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@edunexus/typescript-config": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
EOF

cat > packages/utils/src/format.ts << 'EOF'
export function formatDate(date: Date | string, locale = 'en-KE'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatShortDate(date: Date | string, locale = 'en-KE'): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatCurrency(amountKes: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amountKes);
}
EOF

cat > packages/utils/src/strings.ts << 'EOF'
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 3)}...`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
EOF

cat > packages/utils/src/ids.ts << 'EOF'
import { randomUUID } from 'crypto';

export function generateId(): string {
  return randomUUID();
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function generateCorrelationId(): string {
  return `corr_${randomUUID()}`;
}
EOF

cat > packages/utils/src/index.ts << 'EOF'
export { formatDate, formatShortDate, formatCurrency } from './format';
export { slugify, truncate, capitalize } from './strings';
export { generateId, generateRequestId, generateCorrelationId } from './ids';
EOF

cat > packages/utils/tsconfig.json << 'EOF'
{
  "extends": "@edunexus/typescript-config/node.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
EOF
```

---

# Part III — Infrastructure Bootstrap

---

## Chapter 5 — Docker

### 5.1 Docker Compose Architecture

```bash
mkdir -p docker
```

The local development stack has these containers:

| Container | Port | Purpose |
|-----------|------|---------|
| `redis` | 6379 | BullMQ queues, caching, rate limiting |
| `clickhouse` | 8123, 9000 | Analytics database |
| `mailpit` | 1025, 8025 | Email testing (SMTP + Web UI) |
| `minio` | 9000, 9001 | Object storage (S3-compatible) |
| `prometheus` | 9090 | Metrics collection |
| `grafana` | 3030 | Dashboards |
| `tempo` | 4317 | Distributed tracing |
| `loki` | 3100 | Log aggregation |

Note: Supabase runs via `supabase start` (separate from Docker Compose), which manages its own container stack.

```bash
cat > docker/docker-compose.yml << 'EOF'
version: '3.9'

networks:
  edunexus:
    driver: bridge

volumes:
  redis-data:
  clickhouse-data:
  minio-data:
  prometheus-data:
  grafana-data:
  tempo-data:
  loki-data:

services:
  # ── Redis ──────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: edunexus-redis
    networks: [edunexus]
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf
    command: redis-server /usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── Redis Commander (UI) ────────────────────────────────
  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: edunexus-redis-ui
    networks: [edunexus]
    ports:
      - "8081:8081"
    environment:
      - REDIS_HOSTS=local:redis:6379
    depends_on:
      redis:
        condition: service_healthy
    profiles: [tools]

  # ── ClickHouse ──────────────────────────────────────────
  clickhouse:
    image: clickhouse/clickhouse-server:24.8-alpine
    container_name: edunexus-clickhouse
    networks: [edunexus]
    ports:
      - "8123:8123"   # HTTP interface
      - "9001:9000"   # Native protocol (avoid conflict with MinIO)
    volumes:
      - clickhouse-data:/var/lib/clickhouse
      - ../infra/clickhouse/init:/docker-entrypoint-initdb.d
    environment:
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: ""
      CLICKHOUSE_DB: edunexus_analytics
    healthcheck:
      test: ["CMD", "clickhouse-client", "--query", "SELECT 1"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # ── Mailpit (Email Testing) ─────────────────────────────
  mailpit:
    image: axllent/mailpit:latest
    container_name: edunexus-mailpit
    networks: [edunexus]
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      MP_MAX_MESSAGES: 500
      MP_DATABASE: /data/mailpit.db
    volumes:
      - ./mailpit-data:/data
    restart: unless-stopped

  # ── MinIO (Object Storage) ──────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: edunexus-minio
    networks: [edunexus]
    ports:
      - "9000:9000"   # API
      - "9090:9090"   # Console
    volumes:
      - minio-data:/data
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    command: server /data --console-address ":9090"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
    profiles: [storage]

  # ── Prometheus ──────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    container_name: edunexus-prometheus
    networks: [edunexus]
    ports:
      - "9091:9090"
    volumes:
      - prometheus-data:/prometheus
      - ../infra/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'
    profiles: [monitoring]
    restart: unless-stopped

  # ── Grafana ─────────────────────────────────────────────
  grafana:
    image: grafana/grafana:latest
    container_name: edunexus-grafana
    networks: [edunexus]
    ports:
      - "3030:3000"
    volumes:
      - grafana-data:/var/lib/grafana
      - ../infra/grafana/provisioning:/etc/grafana/provisioning
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: edunexus
      GF_USERS_ALLOW_SIGN_UP: "false"
    depends_on:
      - prometheus
    profiles: [monitoring]
    restart: unless-stopped

  # ── Grafana Tempo (Tracing) ─────────────────────────────
  tempo:
    image: grafana/tempo:latest
    container_name: edunexus-tempo
    networks: [edunexus]
    ports:
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
      - "3200:3200"   # Tempo UI
    volumes:
      - tempo-data:/var/tempo
      - ../infra/tempo/tempo.yml:/etc/tempo.yml
    command: ["-config.file=/etc/tempo.yml"]
    profiles: [monitoring]
    restart: unless-stopped

  # ── Grafana Loki (Logging) ──────────────────────────────
  loki:
    image: grafana/loki:latest
    container_name: edunexus-loki
    networks: [edunexus]
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki
      - ../infra/loki/loki.yml:/etc/loki/local-config.yml
    command: -config.file=/etc/loki/local-config.yml
    profiles: [monitoring]
    restart: unless-stopped
EOF
```

### 5.2 Redis Configuration

```bash
mkdir -p docker/redis

cat > docker/redis/redis.conf << 'EOF'
# Redis configuration for local development
bind 0.0.0.0
port 6379

# Persistence
appendonly yes
appendfsync everysec

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Logging
loglevel notice

# BullMQ compatibility
notify-keyspace-events ""
EOF
```

### 5.3 ClickHouse Initialization

```bash
mkdir -p infra/clickhouse/init

cat > infra/clickhouse/init/001_create_analytics.sql << 'EOF'
-- Analytics events table
CREATE TABLE IF NOT EXISTS edunexus_analytics.analytics_events (
  event_id UUID DEFAULT generateUUIDv4(),
  event_type LowCardinality(String),
  user_id UUID,
  user_role LowCardinality(String),
  session_id String,
  timestamp DateTime64(3, 'Africa/Nairobi') DEFAULT now64(),
  properties Map(String, String),
  app_name LowCardinality(String),
  app_version LowCardinality(String),
  INDEX idx_event_type event_type TYPE bloom_filter GRANULARITY 1,
  INDEX idx_user_id user_id TYPE bloom_filter GRANULARITY 1
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (user_id, event_type, timestamp)
TTL timestamp + INTERVAL 2 YEAR
SETTINGS index_granularity = 8192;

-- Daily active users materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS edunexus_analytics.daily_active_users
ENGINE = AggregatingMergeTree()
ORDER BY (date, user_role)
AS SELECT
  toDate(timestamp) as date,
  user_role,
  uniqState(user_id) as dau_state
FROM edunexus_analytics.analytics_events
GROUP BY date, user_role;
EOF
```

---

## Chapter 6 — Local Infrastructure

### 6.1 Supabase Configuration

```bash
# Initialize Supabase project
supabase init

# The supabase/ directory is now created. Configure it:
cat > supabase/config.toml << 'EOF'
project_id = "edunexus-local"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323
api_url = "http://127.0.0.1"

[inbucket]
enabled = false  # Using Mailpit instead

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = [
  "http://localhost:3001/auth/callback",
  "http://localhost:3002/auth/callback",
  "http://localhost:3003/auth/callback",
  "http://localhost:3004/auth/callback",
]
jwt_expiry = 3600
refresh_token_rotation_enabled = true

[auth.email]
enable_signup = true
enable_confirmations = false  # Disabled for local dev

[auth.external.google]
enabled = false  # Enable with real credentials

[analytics]
enabled = false  # Using ClickHouse instead
EOF
```

### 6.2 Initial Database Migration

```bash
mkdir -p supabase/migrations
mkdir -p supabase/seed

cat > supabase/migrations/20240101000000_initial_schema.sql << 'EOF'
-- EduNexus Initial Schema
-- Run: supabase db reset

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search
CREATE EXTENSION IF NOT EXISTS "vector";   -- For semantic search (pgvector)

-- ── User Profiles ──────────────────────────────────────────
CREATE TABLE public.user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('teacher', 'learner', 'parent', 'admin')),
  full_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid());

-- ── Teachers ───────────────────────────────────────────────
CREATE TABLE public.teachers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  school            TEXT NOT NULL,
  subjects          TEXT[] NOT NULL DEFAULT '{}',
  grades            INT[] NOT NULL DEFAULT '{}',
  curriculum_type   TEXT NOT NULL DEFAULT 'cbc-junior'
                    CHECK (curriculum_type IN ('cbc-junior', 'cbc-senior', '8-4-4', 'igcse')),
  onboarded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX teachers_user_id_idx ON public.teachers (user_id);
CREATE INDEX teachers_school_idx ON public.teachers (school);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers can view own record"
  ON public.teachers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "teachers can update own record"
  ON public.teachers FOR UPDATE
  USING (user_id = auth.uid());

-- ── Token Balances ────────────────────────────────────────
CREATE TABLE public.token_balances (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance     INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX token_balances_user_id_idx ON public.token_balances (user_id);

ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can view own token balance"
  ON public.token_balances FOR SELECT
  USING (user_id = auth.uid());

-- ── Lesson Plans ──────────────────────────────────────────
CREATE TABLE public.lesson_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id       UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL,
  topic            TEXT NOT NULL,
  grade            INT NOT NULL CHECK (grade BETWEEN 1 AND 12),
  duration         INT NOT NULL CHECK (duration BETWEEN 10 AND 180),
  curriculum_type  TEXT NOT NULL
                   CHECK (curriculum_type IN ('cbc-junior', 'cbc-senior', '8-4-4', 'igcse')),
  content          JSONB NOT NULL DEFAULT '{}',
  tokens_used      INT NOT NULL DEFAULT 0,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX lesson_plans_teacher_id_idx ON public.lesson_plans (teacher_id);
CREATE INDEX lesson_plans_subject_idx ON public.lesson_plans (subject);
CREATE INDEX lesson_plans_created_at_idx ON public.lesson_plans (created_at DESC);

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teachers can manage own lesson plans"
  ON public.lesson_plans FOR ALL
  USING (
    teacher_id IN (
      SELECT id FROM public.teachers WHERE user_id = auth.uid()
    )
  );

-- ── Updated At Trigger ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.token_balances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── New User Handler ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Create token balance
  INSERT INTO public.token_balances (user_id, balance)
  VALUES (NEW.id, 20);  -- 20 free tokens on signup

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EOF
```

### 6.3 Seed Data

```bash
cat > supabase/seed/001_demo_data.sql << 'EOF'
-- Demo data for local development
-- Run automatically by: supabase db reset

-- Create demo teacher user (password: Demo1234!)
-- Note: In local dev, auth.users must be created via the Supabase Auth API
-- This seed creates the teacher profile assuming the user exists

-- Demo subjects reference
INSERT INTO public.teachers (user_id, full_name, school, subjects, grades, curriculum_type)
SELECT
  id,
  'Demo Teacher',
  'Nairobi School',
  ARRAY['Mathematics', 'Physics'],
  ARRAY[10, 11, 12],
  'cbc-senior'
FROM auth.users
WHERE email = 'demo@edunexus.co.ke'
ON CONFLICT DO NOTHING;
EOF
```

### 6.4 One-Command Platform Start

```bash
cat > scripts/setup.sh << 'SCRIPT'
#!/bin/bash
# EduNexus Local Development Setup
# Run once after cloning the repository

set -e

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   EduNexus — Development Environment      ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Check prerequisites
check_command() {
  if ! command -v "$1" &> /dev/null; then
    echo "❌ Required: $1 is not installed"
    echo "   Install it: $2"
    exit 1
  fi
  echo "✓ $1 $(command -v $1)"
}

echo "→ Checking prerequisites..."
check_command "node" "https://nodejs.org"
check_command "pnpm" "npm install -g pnpm@9"
check_command "docker" "https://docker.com"
check_command "supabase" "brew install supabase/tap/supabase"

# Check Node version
REQUIRED_NODE="22"
CURRENT_NODE=$(node --version | cut -d'.' -f1 | tr -d 'v')
if [ "$CURRENT_NODE" -lt "$REQUIRED_NODE" ]; then
  echo "❌ Node.js $REQUIRED_NODE+ required (found v$CURRENT_NODE)"
  echo "   Use nvm: nvm install 22 && nvm use 22"
  exit 1
fi
echo "✓ Node.js $(node --version)"

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
  echo ""
  echo "→ Creating .env.local from .env.example..."
  cp .env.example .env.local
  echo "⚠️  Edit .env.local and fill in your Supabase credentials"
  echo "   Then run this script again."
  echo ""
  echo "   Required for basic dev:"
  echo "   - NEXT_PUBLIC_SUPABASE_URL"
  echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "   - SUPABASE_SERVICE_ROLE_KEY"
  exit 0
fi

# Install dependencies
echo ""
echo "→ Installing dependencies..."
pnpm install

# Start Docker services
echo ""
echo "→ Starting Docker services..."
docker compose -f docker/docker-compose.yml up -d redis mailpit

# Start Supabase
echo ""
echo "→ Starting Supabase..."
supabase start

# Apply migrations and seed
echo ""
echo "→ Setting up database..."
supabase db reset

# Generate TypeScript types
echo ""
echo "→ Generating TypeScript types..."
supabase gen types typescript --local > packages/database/src/types/supabase.ts
echo "✓ Types generated at packages/database/src/types/supabase.ts"

# Build all packages
echo ""
echo "→ Building shared packages..."
pnpm turbo build --filter='./packages/*'

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   Setup Complete! 🎉                       ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  Start development:  pnpm dev"
echo ""
echo "  Applications:"
echo "  → Web:      http://localhost:3000"
echo "  → Teacher:  http://localhost:3001"
echo "  → Learner:  http://localhost:3002"
echo "  → Parent:   http://localhost:3003"
echo "  → Admin:    http://localhost:3004"
echo ""
echo "  Infrastructure:"
echo "  → Supabase: http://localhost:54323"
echo "  → Email:    http://localhost:8025"
echo "  → Redis UI: docker compose --profile tools up -d"
echo ""
SCRIPT

chmod +x scripts/setup.sh
```

---

# Part IV — Engineering Tooling

---

## Chapter 7 — Git Hooks

### 7.1 Install Husky

```bash
# Install Husky and lint-staged at the root
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional -w

# Initialize Husky
pnpm exec husky init
```

### 7.2 Pre-commit Hook

```bash
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
# Run lint-staged for fast targeted linting

pnpm exec lint-staged
EOF

chmod +x .husky/pre-commit
```

### 7.3 Commit Message Hook

```bash
cat > .husky/commit-msg << 'EOF'
#!/bin/sh
# Validate commit message format

pnpm exec commitlint --edit "$1"
EOF

chmod +x .husky/commit-msg
```

### 7.4 Pre-push Hook

```bash
cat > .husky/pre-push << 'EOF'
#!/bin/sh
# Run typecheck before push (fast with Turborepo cache)

echo "Running typecheck..."
pnpm turbo typecheck
EOF

chmod +x .husky/pre-push
```

### 7.5 commitlint Configuration

```bash
cat > commitlint.config.js << 'EOF'
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'perf', 'security', 'chore', 'test', 'ci'],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-max-length': [2, 'always', 100],
    'body-max-line-length': [1, 'always', 200],
    'header-max-length': [2, 'always', 110],
  },
};
EOF
```

### 7.6 lint-staged Configuration

Add to `package.json`:

```bash
# Add lint-staged config to root package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg['lint-staged'] = {
  '*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.{js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],
  '*.{json,md,yaml,yml,css}': [
    'prettier --write',
  ],
};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✓ lint-staged added to package.json');
"
```

### 7.7 Secret Scanning Hook

```bash
cat > .husky/pre-commit-secrets << 'EOF'
#!/bin/sh
# Scan staged files for common secret patterns

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

SECRETS_FOUND=0

# Patterns that indicate secrets
PATTERNS=(
  'sk_live_[a-zA-Z0-9]+'       # Paystack live key
  'sk_test_[a-zA-Z0-9]+'       # Paystack test key
  'SUPABASE_SERVICE_ROLE_KEY=[a-zA-Z0-9]+'  # Supabase service key
  'eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+'  # JWT
  'AIza[a-zA-Z0-9_-]+'         # Google API key
  'sk-[a-zA-Z0-9]+'            # OpenAI/DeepSeek API key
)

for FILE in $STAGED_FILES; do
  if [ -f "$FILE" ]; then
    for PATTERN in "${PATTERNS[@]}"; do
      if git show ":$FILE" | grep -qE "$PATTERN" 2>/dev/null; then
        echo "❌ Potential secret found in $FILE (pattern: $PATTERN)"
        SECRETS_FOUND=1
      fi
    done
  fi
done

if [ "$SECRETS_FOUND" -eq 1 ]; then
  echo ""
  echo "Remove the secret from the file before committing."
  echo "If it was already committed, rotate it immediately."
  exit 1
fi
EOF

# Add to pre-commit
echo "" >> .husky/pre-commit
echo "bash .husky/pre-commit-secrets" >> .husky/pre-commit
```

---

## Chapter 8 — Code Generation

### 8.1 Database Type Generation Script

```bash
cat > scripts/generate-types.sh << 'SCRIPT'
#!/bin/bash
# Generates TypeScript types from the local Supabase schema

set -e

echo "→ Generating database types..."

# Check Supabase is running
if ! supabase status &> /dev/null; then
  echo "❌ Supabase is not running. Run: supabase start"
  exit 1
fi

OUTPUT="packages/database/src/types/supabase.ts"

supabase gen types typescript --local > "$OUTPUT"

echo "✓ Types written to $OUTPUT"
echo ""

# Verify the file compiled
cd packages/database
pnpm exec tsc --noEmit
echo "✓ Types compile successfully"
SCRIPT

chmod +x scripts/generate-types.sh
```

### 8.2 Complete Generation Pipeline

```bash
cat > scripts/generate-all.sh << 'SCRIPT'
#!/bin/bash
# Runs all code generation tasks

set -e

echo "→ Running all code generators..."

# 1. Database types
echo "  1/3 Database types..."
bash scripts/generate-types.sh

# 2. Icons (from SVG files)
echo "  2/3 Icons..."
if [ -d "design/icons" ]; then
  pnpm --filter @edunexus/icons generate
else
  echo "     Skipping icons (design/icons directory not found)"
fi

# 3. Validate all generated files compile
echo "  3/3 Typecheck..."
pnpm turbo typecheck --filter='./packages/*'

echo ""
echo "✓ All generators complete"
SCRIPT

chmod +x scripts/generate-all.sh
```

---

# Part V — Developer Experience

---

## Chapter 9 — VS Code

### 9.1 Workspace Settings

```bash
mkdir -p .vscode

cat > .vscode/settings.json << 'EOF'
{
  // Format on save
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },

  // ESLint
  "eslint.validate": ["javascript", "javascriptreact", "typescript", "typescriptreact"],
  "eslint.useFlatConfig": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.addMissingImports": "explicit"
  },

  // TypeScript
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "shortest",

  // Tailwind
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },

  // Files
  "files.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/.turbo": true,
    "**/dist": true
  },
  "search.exclude": {
    "**/.next": true,
    "**/node_modules": true,
    "**/.turbo": true,
    "**/dist": true,
    "**/pnpm-lock.yaml": true,
    "**/coverage": true
  },

  // Explorer
  "explorer.fileNesting.enabled": true,
  "explorer.fileNesting.patterns": {
    "*.ts": "${capture}.test.ts, ${capture}.spec.ts",
    "*.tsx": "${capture}.test.tsx, ${capture}.spec.tsx, ${capture}.stories.tsx",
    "package.json": "pnpm-lock.yaml, package-lock.json, .npmrc, tsconfig.json, tsconfig.*.json",
    "turbo.json": "pnpm-workspace.yaml",
    ".env.example": ".env, .env.local, .env.*.local"
  },

  // Terminal
  "terminal.integrated.defaultProfile.linux": "bash",

  // Git
  "git.enableSmartCommit": true,
  "git.confirmSync": false,

  // Vitest
  "vitest.enable": true,
  "vitest.commandLine": "pnpm exec vitest"
}
EOF
```

### 9.2 Extensions

```bash
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    // TypeScript
    "ms-vscode.vscode-typescript-next",

    // Formatting
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "EditorConfig.EditorConfig",

    // Tailwind
    "bradlc.vscode-tailwindcss",

    // React
    "dsznajder.es7-react-js-snippets",

    // Testing
    "ZixuanChen.vitest-explorer",
    "ms-playwright.playwright",

    // Database
    "supabase.vscode-supabase-cli",

    // Git
    "eamodio.gitlens",
    "mhutchie.git-graph",

    // Utilities
    "christian-kohler.path-intellisense",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker",

    // AI
    "github.copilot",
    "github.copilot-chat",

    // Docker
    "ms-azuretools.vscode-docker",

    // Markdown
    "yzhang.markdown-all-in-one"
  ]
}
EOF
```

### 9.3 Debug Launch Configurations

```bash
cat > .vscode/launch.json << 'EOF'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug: Teacher App",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@edunexus/app-teacher", "dev"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_OPTIONS": "--inspect"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug: Learner App",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["--filter", "@edunexus/app-learner", "dev"],
      "cwd": "${workspaceFolder}",
      "env": {
        "NODE_OPTIONS": "--inspect=9229"
      },
      "console": "integratedTerminal"
    },
    {
      "name": "Attach: Node Process",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "."
    },
    {
      "name": "Debug: Vitest (current file)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": [
        "exec",
        "vitest",
        "--reporter=verbose",
        "${file}"
      ],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ],
  "compounds": [
    {
      "name": "Debug: All Apps",
      "configurations": ["Debug: Teacher App", "Debug: Learner App"]
    }
  ]
}
EOF
```

### 9.4 VS Code Tasks

```bash
cat > .vscode/tasks.json << 'EOF'
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Dev: All Apps",
      "type": "shell",
      "command": "pnpm dev",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new",
        "group": "dev"
      },
      "problemMatcher": "$tsc-watch"
    },
    {
      "label": "Dev: Teacher App",
      "type": "shell",
      "command": "pnpm --filter @edunexus/app-teacher dev",
      "group": "build",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    },
    {
      "label": "Test: All",
      "type": "shell",
      "command": "pnpm test",
      "group": "test",
      "presentation": { "reveal": "always", "panel": "new" }
    },
    {
      "label": "Typecheck: All",
      "type": "shell",
      "command": "pnpm typecheck",
      "group": "build",
      "problemMatcher": "$tsc"
    },
    {
      "label": "DB: Reset",
      "type": "shell",
      "command": "supabase db reset && pnpm db:types",
      "group": "none",
      "presentation": { "reveal": "always", "panel": "shared" }
    },
    {
      "label": "Infra: Start",
      "type": "shell",
      "command": "docker compose -f docker/docker-compose.yml up -d && supabase start",
      "group": "none"
    },
    {
      "label": "Infra: Stop",
      "type": "shell",
      "command": "docker compose -f docker/docker-compose.yml down && supabase stop",
      "group": "none"
    },
    {
      "label": "Generate: All Types",
      "type": "shell",
      "command": "bash scripts/generate-all.sh",
      "group": "none"
    }
  ]
}
EOF
```

---

## Chapter 10 — Cursor & Claude Code

### 10.1 CLAUDE.md (Already Exists)

The `CLAUDE.md` at the repository root is already established in the project. Verify it exists and is complete:

```bash
# Verify CLAUDE.md covers all standards
grep -l "No any types" CLAUDE.md && echo "✓ CLAUDE.md present and covers key rules"
```

### 10.2 .cursor/rules

For Cursor users, create a project rules file:

```bash
mkdir -p .cursor

cat > .cursor/rules << 'EOF'
# EduNexus Cursor Rules

You are an expert TypeScript/Next.js engineer working on the EduNexus Kenya CBC/CBE AI education platform.

## Core Rules

1. NEVER use `any` TypeScript types. If you don't know the type, derive it or use `unknown`.
2. NEVER use `select('*')` in Supabase queries. Always list specific columns.
3. NEVER import `createClient` from `@supabase/supabase-js` directly. Use `@edunexus/database`.
4. NEVER put business logic in API routes or components. API routes call `lib/` functions only.
5. NEVER use `console.log`. Use `createLogger` from `@edunexus/logging`.
6. ALWAYS check `auth.getUser()` first in every API route and return 401 if no user.
7. ALWAYS verify `user.id === requestedUserId` and return 403 if they don't match.
8. ALWAYS use `zod` for validation in API routes. Parse request body before using it.
9. ALWAYS use `createServiceClient()` for server-side DB operations.
10. ALWAYS use `createBrowserSupabaseClient()` in client components.

## Architecture

- DB calls go through `lib/` functions or `packages/database/` functions only
- Components are UI only — zero business logic
- API routes are thin — call lib functions, return JSON
- Workers handle all async operations (never block HTTP with slow AI calls for non-interactive flows)

## File Naming

- Files: kebab-case
- Components: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Types: PascalCase
- DB columns: snake_case

## When Creating Features

1. Plan: What tables, what lib functions, what API routes, what components?
2. Migration first if DB schema changes
3. Lib functions with explicit return types
4. API route with Zod validation
5. Component with proper types
6. Tests

## CBC Curriculum

- Junior: Grade 7–9
- Senior: Grade 10–12
- 8-4-4: Form 3–4 (equivalent to Grade 11–12)
- All curriculum data lives in `packages/curriculum/`
EOF
```

### 10.3 AI Workflow Scripts

```bash
mkdir -p .claude

cat > .claude/project-context.md << 'EOF'
# EduNexus Project Context

## What We're Building

EduNexus is a Kenya CBC/CBE AI education platform. We serve:
- Teachers who plan lessons and track learning
- Students who learn and prepare for assessments
- Parents who monitor their children's progress

## Current Phase

50 pioneer beta teachers. Building the core teacher experience.

## Most Important Files

- `CLAUDE.md` — Engineering standards (READ THIS FIRST)
- `docs/monorepo-foundation-specification.md` — Full architecture
- `docs/repository-bootstrap-guide.md` — This setup guide
- `packages/database/src/types/supabase.ts` — Database schema (auto-generated)
- `packages/validation/src/` — All domain types (Zod schemas)
- `infra/supabase/migrations/` — Database migration history

## Active Work

Currently: Repository initialization and first working platform.

## Quick Reference

Database client factories (server): `import { createServerSupabaseClient } from '@edunexus/database'`
Database client factories (client): `import { createBrowserSupabaseClient } from '@edunexus/database'`
Service client (bypasses RLS): `import { createServiceClient } from '@edunexus/database'`
Env variables: `import { getEnv } from '@edunexus/config'`
Token costs: `import { TOKEN_COSTS } from '@edunexus/config'`
Logger: `import { createLogger } from '@edunexus/logging'`
EOF
```

---

# Part VI — Testing Bootstrap

---

## Chapter 11 — Test Infrastructure

### 11.1 Vitest Configuration

Create a shared Vitest config:

```bash
cat > vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.next/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types/**',
        'packages/database/src/types/supabase.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 80,
        statements: 80,
      },
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
EOF
```

Add package-level Vitest configs:

```bash
# For Node-only packages
cat > packages/utils/vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json'],
    },
  },
});
EOF

# For React packages
cat > packages/ui/vitest.config.ts << 'EOF'
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'json'],
    },
  },
});
EOF

cat > packages/ui/src/test-setup.ts << 'EOF'
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
EOF
```

### 11.2 Test Factories

```bash
mkdir -p packages/database/src/testing

cat > packages/database/src/testing/factories.ts << 'EOF'
import { randomUUID } from 'crypto';

export function buildTeacher(overrides: Partial<{
  id: string;
  userId: string;
  fullName: string;
  school: string;
  subjects: string[];
  grades: number[];
  curriculumType: string;
}> = {}) {
  return {
    id: randomUUID(),
    userId: randomUUID(),
    fullName: 'Test Teacher',
    school: 'Test School',
    subjects: ['Mathematics'],
    grades: [10, 11],
    curriculumType: 'cbc-senior' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildLessonPlan(overrides: Partial<{
  id: string;
  teacherId: string;
  subject: string;
  topic: string;
  grade: number;
  duration: number;
  curriculumType: string;
  content: Record<string, unknown>;
  tokensUsed: number;
}> = {}) {
  return {
    id: randomUUID(),
    teacherId: randomUUID(),
    subject: 'Mathematics',
    topic: 'Quadratic Equations',
    grade: 10,
    duration: 40,
    curriculumType: 'cbc-senior' as const,
    content: {},
    tokensUsed: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
EOF
```

### 11.3 Example Unit Tests

```bash
# Example test for utils package
cat > packages/utils/src/format.test.ts << 'EOF'
import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats KES amounts', () => {
    expect(formatCurrency(1000)).toBe('KES 1,000');
    expect(formatCurrency(500)).toBe('KES 500');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('KES 0');
  });
});

describe('formatDate', () => {
  it('formats dates for Kenya locale', () => {
    const date = new Date('2024-03-15');
    const formatted = formatDate(date, 'en-KE');
    expect(formatted).toContain('2024');
    expect(formatted).toContain('March');
  });
});
EOF

# Example test for validation package
cat > packages/validation/src/lesson-plan.test.ts << 'EOF'
import { describe, expect, it } from 'vitest';
import { LessonPlanGenerateRequestSchema } from './lesson-plan';

describe('LessonPlanGenerateRequestSchema', () => {
  it('validates a valid request', () => {
    const result = LessonPlanGenerateRequestSchema.safeParse({
      subject: 'Mathematics',
      topic: 'Quadratic Equations',
      grade: 10,
      duration: 40,
      curriculumType: 'cbc-senior',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid grade', () => {
    const result = LessonPlanGenerateRequestSchema.safeParse({
      subject: 'Mathematics',
      topic: 'Algebra',
      grade: 5,  // Invalid: below 7
      duration: 40,
      curriculumType: 'cbc-senior',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown curriculum type', () => {
    const result = LessonPlanGenerateRequestSchema.safeParse({
      subject: 'Mathematics',
      topic: 'Algebra',
      grade: 10,
      duration: 40,
      curriculumType: 'unknown-curriculum',
    });
    expect(result.success).toBe(false);
  });
});
EOF
```

### 11.4 Playwright Setup

```bash
pnpm add -D @playwright/test -w

cat > playwright.config.ts << 'EOF'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    process.env['CI'] ? ['github'] : ['list'],
  ],
  use: {
    baseURL: process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: process.env['CI'] ? undefined : {
    command: 'pnpm --filter @edunexus/app-teacher dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
  },
});
EOF

mkdir -p tests/e2e

cat > tests/e2e/auth.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in/);
  });

  test('shows sign-in page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
EOF
```

---

## Chapter 12 — GitHub Actions

### 12.1 Main CI Pipeline

```bash
mkdir -p .github/workflows

cat > .github/workflows/ci.yml << 'EOF'
name: CI

on:
  pull_request:
    branches: [main, staging]
    types: [opened, synchronize, reopened]
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}

env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}
  TURBO_REMOTE_ONLY: true
  NODE_ENV: test

jobs:
  # ── Validate (lint + typecheck) ──────────────────────────
  validate:
    name: Validate
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo lint

      - name: Typecheck
        run: pnpm turbo typecheck

  # ── Unit Tests ───────────────────────────────────────────
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm turbo test
        env:
          NODE_ENV: test

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: always()
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          directory: coverage
          flags: unit

  # ── Build ────────────────────────────────────────────────
  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [validate]
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm turbo build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.STAGING_SUPABASE_ANON_KEY }}
          NEXT_PUBLIC_WEB_URL: https://staging.edunexus.co.ke
          NEXT_PUBLIC_TEACHER_URL: https://teacher-staging.edunexus.co.ke

  # ── Integration Tests ─────────────────────────────────────
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20
    needs: [build]
    services:
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - run: pnpm install --frozen-lockfile

      - name: Start Supabase
        run: supabase start --exclude storage,imgproxy,realtime,edge-runtime,logflare

      - name: Run integration tests
        run: pnpm turbo test:integration
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ env.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ env.SUPABASE_SERVICE_ROLE }}
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

  # ── Architecture Tests ────────────────────────────────────
  arch-test:
    name: Architecture Tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: [validate]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Check dependency rules
        run: |
          # Check that no package imports from apps
          if grep -r "from '.*apps/" packages/ 2>/dev/null | grep -v ".test." | grep -v ".spec."; then
            echo "❌ Package imports from apps directory (forbidden)"
            exit 1
          fi
          # Check no direct supabase-js imports in apps
          if grep -r "from '@supabase/supabase-js'" apps/ 2>/dev/null | grep -v ".test."; then
            echo "❌ Direct @supabase/supabase-js import found in apps (use @edunexus/database)"
            exit 1
          fi
          echo "✓ Architecture tests passed"

  # ── Security Scan ─────────────────────────────────────────
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Dependency audit
        run: pnpm audit --audit-level high

      - name: Secret scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified

  # ── Final Gate ────────────────────────────────────────────
  ci-success:
    name: CI Success
    runs-on: ubuntu-latest
    needs: [validate, test, build, test-integration, arch-test]
    if: always()
    steps:
      - name: Check all jobs passed
        run: |
          results='${{ toJSON(needs) }}'
          if echo "$results" | grep -q '"result":"failure"'; then
            echo "❌ One or more CI jobs failed"
            exit 1
          fi
          if echo "$results" | grep -q '"result":"cancelled"'; then
            echo "❌ One or more CI jobs were cancelled"
            exit 1
          fi
          echo "✓ All CI jobs passed"
EOF
```

### 12.2 Preview Deployments

```bash
cat > .github/workflows/preview.yml << 'EOF'
name: Preview

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize]

jobs:
  deploy-preview:
    name: Deploy Preview
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Deploy teacher app preview
      - name: Deploy teacher app
        uses: amondnet/vercel-action@v25
        id: teacher-preview
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_TEACHER }}
          working-directory: apps/teacher
          scope: ${{ secrets.VERCEL_ORG_ID }}

      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Preview Deployments\n\n| App | URL |\n|-----|-----|\n| Teacher | ${{ steps.teacher-preview.outputs.preview-url }} |`
            })
EOF
```

### 12.3 Security Workflow

```bash
cat > .github/workflows/security.yml << 'EOF'
name: Security

on:
  schedule:
    - cron: '0 8 * * 1'  # Every Monday at 8am UTC
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  codeql:
    name: CodeQL Analysis
    runs-on: ubuntu-latest
    permissions:
      actions: read
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v4

      - uses: github/codeql-action/init@v3
        with:
          languages: typescript, javascript
          queries: security-and-quality

      - uses: github/codeql-action/autobuild@v3

      - uses: github/codeql-action/analyze@v3
        with:
          category: /language:typescript

  dependency-audit:
    name: Dependency Audit
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level critical
EOF
```

### 12.4 Dependabot Configuration

```bash
cat > .github/dependabot.yml << 'EOF'
version: 2
updates:
  # npm packages
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
      day: monday
      time: "09:00"
      timezone: "Africa/Nairobi"
    open-pull-requests-limit: 10
    groups:
      radix-ui:
        patterns:
          - "@radix-ui/*"
      next-ecosystem:
        patterns:
          - "next"
          - "react"
          - "react-dom"
          - "@types/react"
      testing:
        patterns:
          - "vitest"
          - "@vitest/*"
          - "@testing-library/*"
          - "playwright"
          - "@playwright/*"
    ignore:
      # Major version bumps require manual review
      - dependency-name: "*"
        update-types: ["version-update:semver-major"]

  # GitHub Actions
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
      day: monday
    groups:
      github-actions:
        patterns:
          - "*"
EOF
```

---

# Part VII — First Working Platform

---

## Chapter 13 — Green Platform Milestone

### 13.1 The Milestone Definition

The Green Platform milestone is reached when:

```bash
pnpm install   # exits 0
pnpm dev       # starts all applications
```

And a developer can open:

| URL | Expected Result |
|-----|----------------|
| `http://localhost:3000` | EduNexus web homepage placeholder |
| `http://localhost:3001` | Teacher app — either sign-in redirect or placeholder |
| `http://localhost:3002` | Learner app placeholder |
| `http://localhost:3003` | Parent app placeholder |
| `http://localhost:3004` | Admin app placeholder |
| `http://localhost:54323` | Supabase Studio |
| `http://localhost:8025` | Mailpit email inbox |

### 13.2 Verification Script

```bash
cat > scripts/verify-platform.sh << 'SCRIPT'
#!/bin/bash
# Verifies that all applications are running and responding

set -e

echo ""
echo "EduNexus Platform Verification"
echo "================================"
echo ""

check_url() {
  local name=$1
  local url=$2
  local expected_status=${3:-200}

  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

  if [ "$status" = "$expected_status" ] || [ "$status" = "200" ] || [ "$status" = "307" ] || [ "$status" = "308" ]; then
    echo "✓ $name ($url) → $status"
  else
    echo "❌ $name ($url) → $status (expected $expected_status)"
    FAILED=1
  fi
}

FAILED=0

echo "Applications:"
check_url "Web App"       "http://localhost:3000"
check_url "Teacher App"   "http://localhost:3001"
check_url "Learner App"   "http://localhost:3002"
check_url "Parent App"    "http://localhost:3003"
check_url "Admin App"     "http://localhost:3004"

echo ""
echo "Infrastructure:"
check_url "Supabase"      "http://localhost:54323" "200"
check_url "Mailpit"       "http://localhost:8025"
check_url "Redis"         "http://localhost:6379" "000"  # Redis doesn't respond to HTTP

# Test Redis directly
if redis-cli ping | grep -q PONG; then
  echo "✓ Redis (localhost:6379) → PONG"
else
  echo "❌ Redis (localhost:6379) → not responding"
  FAILED=1
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "✓ All systems operational"
  echo ""
  echo "The EduNexus platform is running. 🚀"
else
  echo "❌ Some systems failed. Check above for details."
  exit 1
fi
SCRIPT

chmod +x scripts/verify-platform.sh
```

### 13.3 Complete Install & Dev Sequence

Run these commands in order. By the end, all applications are running:

```bash
# Step 1: Clone (if not done)
git clone git@github.com:edunexus/edunexus.git
cd edunexus

# Step 2: Install dependencies
pnpm install

# Step 3: Start infrastructure
docker compose -f docker/docker-compose.yml up -d
supabase start

# Step 4: Set up database
supabase db reset

# Step 5: Generate types
pnpm db:types

# Step 6: Build shared packages (required before apps can start)
pnpm turbo build --filter='./packages/*'

# Step 7: Start everything
pnpm dev

# Step 8: Verify (in a second terminal)
bash scripts/verify-platform.sh
```

### 13.4 Port Conflict Resolution

If ports are in use:

```bash
# Find what's using a port
lsof -i :3001

# Kill the process
kill -9 $(lsof -t -i:3001)

# Or change app ports in their package.json
# apps/teacher/package.json → "dev": "next dev --port 3011"
```

### 13.5 Environment Checklist

Before running `pnpm dev`, verify `.env.local` contains at minimum:

```bash
cat > scripts/check-env.sh << 'SCRIPT'
#!/bin/bash
# Check that required env vars are set

REQUIRED=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)

MISSING=0

for VAR in "${REQUIRED[@]}"; do
  if [ -z "${!VAR}" ] && ! grep -q "^$VAR=" .env.local 2>/dev/null; then
    echo "❌ Missing: $VAR"
    MISSING=1
  else
    echo "✓ $VAR"
  fi
done

if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "Set missing variables in .env.local"
  echo "Get values from: supabase status"
  exit 1
fi

echo ""
echo "✓ Required environment variables present"
SCRIPT

chmod +x scripts/check-env.sh
```

Get Supabase local credentials:

```bash
# After supabase start, these values are printed:
supabase status

# API URL:      http://127.0.0.1:54321
# anon key:     eyJ...
# service_role key: eyJ...
```

---

# Final Chapter — The First Week

---

## The First Week

The founding engineering team has seven working days to go from empty repository to a running platform with automated CI. Here is the day-by-day implementation plan.

---

### Day 1 — Foundation

**Goal:** Repository is initialized, protected, and the root configuration is committed.

**Morning:**

```bash
# 1. Create GitHub organization and repository
gh repo create edunexus/edunexus --private

# 2. Clone and initialize
git clone git@github.com:edunexus/edunexus.git
cd edunexus

# 3. Create root structure
mkdir -p apps packages services workers tooling infra docker docs examples scripts .github/workflows .github/ISSUE_TEMPLATE .vscode
```

**Afternoon:**

Create all root configuration files from Chapter 2:
- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- `eslint.config.js`
- `prettier.config.js`
- `.editorconfig`
- `.nvmrc`
- `.gitignore`
- `.gitattributes`
- `.env.example`
- `README.md`
- `CODEOWNERS`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `ARCHITECTURE.md`
- `CLAUDE.md`

**End of Day 1 Checklist:**
- [ ] Repository exists on GitHub
- [ ] Branch protection on `main` is configured
- [ ] Root configuration files are committed
- [ ] `pnpm install` completes without errors
- [ ] Labels, issue templates, and PR template are created

```bash
git add .
git commit -m "chore: initialize repository with root configuration 🎯"
git push origin main
```

---

### Day 2 — Shared Packages

**Goal:** All `packages/*` are scaffolded with their structure, types, and entry points.

**Morning:**

```bash
# Create all packages from Chapter 4
bash scripts/scaffold-packages.sh  # or create manually

# Priority order (dependencies first):
# 1. packages/typescript-config
# 2. packages/eslint-config
# 3. packages/utils
# 4. packages/config
# 5. packages/validation
# 6. packages/logging
```

**Afternoon:**

```bash
# 7. packages/database (depends on config)
# 8. packages/auth (depends on database)
# 9. packages/ui (depends on utils, icons)
# 10. All remaining packages (empty stubs with README)

# Install dependencies
pnpm install

# Verify packages build
pnpm turbo build --filter='./packages/*'
pnpm turbo typecheck --filter='./packages/*'
pnpm turbo test --filter='./packages/*'
```

**End of Day 2 Checklist:**
- [ ] All 22 packages exist in `packages/`
- [ ] `pnpm turbo build --filter='./packages/*'` exits 0
- [ ] `pnpm turbo typecheck --filter='./packages/*'` exits 0
- [ ] `pnpm turbo test --filter='./packages/*'` exits 0 (unit tests passing)
- [ ] Each package has a README

```bash
git add .
git commit -m "feat: scaffold all shared packages 🎯"
git push origin main
```

---

### Day 3 — Applications

**Goal:** All 10 applications are scaffolded and can run individually.

**Morning:**

```bash
# Bootstrap all applications from Chapter 3
bash scripts/scaffold-app.sh web 3000
bash scripts/scaffold-app.sh teacher 3001
bash scripts/scaffold-app.sh learner 3002
bash scripts/scaffold-app.sh parent 3003
bash scripts/scaffold-app.sh admin 3004
bash scripts/scaffold-app.sh analytics 3005
bash scripts/scaffold-app.sh developers 3006
bash scripts/scaffold-app.sh studio 3007
bash scripts/scaffold-app.sh docs 3008
bash scripts/scaffold-app.sh marketing 3009

pnpm install
```

**Afternoon:**

Apply teacher-specific configuration from section 3.4:
- Middleware for auth protection
- Protected layout
- Auth callback route
- Dashboard placeholder

Test that individual apps run:

```bash
# Test each app individually
pnpm --filter @edunexus/app-web dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
kill %1

pnpm --filter @edunexus/app-teacher dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
kill %1
```

**End of Day 3 Checklist:**
- [ ] All 10 apps exist in `apps/`
- [ ] Each app has `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- [ ] Each app has `app/layout.tsx` and `app/page.tsx`
- [ ] `pnpm turbo typecheck --filter='./apps/*'` exits 0

```bash
git add .
git commit -m "feat: scaffold all applications 🎯"
git push origin main
```

---

### Day 4 — Infrastructure & Database

**Goal:** Docker is running, Supabase is initialized, and the database has its initial schema.

**Morning:**

```bash
# Set up Docker Compose
# Create docker/docker-compose.yml (Chapter 5)
# Create docker/redis/redis.conf
# Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# Initialize Supabase
supabase init
# Configure supabase/config.toml (Chapter 6)
supabase start
```

**Afternoon:**

```bash
# Create initial migration
# supabase/migrations/20240101000000_initial_schema.sql
# (Chapter 6.2)

# Apply migration
supabase db reset

# Generate TypeScript types
supabase gen types typescript --local > packages/database/src/types/supabase.ts

# Verify types compile
pnpm --filter @edunexus/database typecheck

# Create seed data
# supabase/seed/001_demo_data.sql
```

**End of Day 4 Checklist:**
- [ ] `docker compose -f docker/docker-compose.yml up -d` starts Redis and Mailpit
- [ ] `supabase start` starts the local Supabase stack
- [ ] `supabase db reset` applies migration and seed without errors
- [ ] `packages/database/src/types/supabase.ts` is generated and compiles
- [ ] Tables `user_profiles`, `teachers`, `token_balances`, `lesson_plans` exist
- [ ] RLS is enabled on all tables

```bash
git add .
git commit -m "feat: Docker infrastructure and initial database schema 🎯"
git push origin main
```

---

### Day 5 — Developer Tooling

**Goal:** Git hooks, code generation, VS Code configuration, and the first CI pipeline are all running.

**Morning:**

```bash
# Install and configure Husky
pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional -w
pnpm exec husky init

# Create hooks (Chapter 7)
# .husky/pre-commit
# .husky/commit-msg
# .husky/pre-push
# .husky/pre-commit-secrets

# Configure commitlint
# commitlint.config.js

# Configure lint-staged in package.json
```

**Afternoon:**

```bash
# VS Code configuration (Chapter 9)
# .vscode/settings.json
# .vscode/extensions.json
# .vscode/launch.json
# .vscode/tasks.json

# Claude Code configuration (Chapter 10)
# CLAUDE.md (already exists — verify)
# .cursor/rules
# .claude/project-context.md

# Create generation scripts (Chapter 8)
# scripts/generate-types.sh
# scripts/generate-all.sh

# Push GitHub Actions (Chapter 12)
# .github/workflows/ci.yml
# .github/workflows/preview.yml
# .github/workflows/security.yml
# .github/dependabot.yml

# Verify hooks work
echo "test: verify commit hook" | pnpm exec commitlint
```

**End of Day 5 Checklist:**
- [ ] Pre-commit hook runs `lint-staged` on staged files
- [ ] Commit-msg hook validates commit format
- [ ] Pre-push hook runs typecheck
- [ ] `.vscode/` configuration committed
- [ ] `.github/workflows/ci.yml` committed and runs on push
- [ ] First CI run completes (green or shows expected failures to fix)

```bash
git add .
git commit -m "feat: developer tooling — git hooks, VS Code, CI pipeline 🎯"
git push origin main
```

---

### Day 6 — Testing Infrastructure & Full Build

**Goal:** Full test suite runs, CI is green, all packages build.

**Morning:**

```bash
# Vitest configuration (Chapter 11)
cat > vitest.config.ts  # (Chapter 11.1)

# Add vitest configs to each package
# Add test-setup files
# Write initial tests for packages/utils
# Write initial tests for packages/validation

# Run tests
pnpm test
```

**Afternoon:**

```bash
# Playwright setup
pnpm add -D @playwright/test -w
cat > playwright.config.ts  # (Chapter 11.4)
mkdir -p tests/e2e
cat > tests/e2e/auth.spec.ts

# Install Playwright browsers
pnpm exec playwright install chromium

# Full build verification
pnpm build

# Run full verification
pnpm lint
pnpm typecheck
pnpm test
bash scripts/verify-platform.sh
```

**End of Day 6 Checklist:**
- [ ] `pnpm test` passes for all packages
- [ ] `pnpm lint` passes for all packages
- [ ] `pnpm typecheck` passes for all apps and packages
- [ ] `pnpm build` completes without errors
- [ ] CI pipeline is green on GitHub
- [ ] Code coverage report is generated
- [ ] Playwright smoke tests pass for at least the teacher app

```bash
git add .
git commit -m "feat: complete testing infrastructure — vitest, playwright, coverage 🎯"
git push origin main
```

---

### Day 7 — Green Platform Verification

**Goal:** `pnpm dev` starts every application. The platform is operational.

**Morning:**

```bash
# Verify the complete dev startup
pnpm install                           # Clean install
docker compose -f docker/docker-compose.yml up -d  # Start Docker services
supabase start                         # Start Supabase
pnpm dev                               # Start all applications
```

In a second terminal:

```bash
# Run the verification script
bash scripts/verify-platform.sh
```

Expected output:
```
EduNexus Platform Verification
================================

Applications:
✓ Web App (http://localhost:3000) → 200
✓ Teacher App (http://localhost:3001) → 200
✓ Learner App (http://localhost:3002) → 200
✓ Parent App (http://localhost:3003) → 200
✓ Admin App (http://localhost:3004) → 200

Infrastructure:
✓ Supabase (http://localhost:54323) → 200
✓ Mailpit (http://localhost:8025) → 200
✓ Redis (localhost:6379) → PONG

✓ All systems operational

The EduNexus platform is running. 🚀
```

**Afternoon:**

Onboarding verification — an engineer who was not part of Day 1–6 should be able to follow these exact steps and reach the Green Platform state:

```bash
git clone git@github.com:edunexus/edunexus.git
cd edunexus
bash scripts/setup.sh
pnpm dev
```

If this does not work, Day 7 is not complete. Fix the setup script until it does.

**End of Day 7 Checklist — The Complete First Week:**

- [ ] Repository initialized on GitHub with branch protection
- [ ] All root configuration files committed and working
- [ ] All 22 packages scaffolded, built, and tested
- [ ] All 10 applications scaffolded and running
- [ ] Docker Compose starts Redis and Mailpit
- [ ] Supabase starts with initial schema and seed data
- [ ] TypeScript types generated from database schema
- [ ] Git hooks enforcing commit format, linting, and secret scanning
- [ ] VS Code workspace configured with extensions and debug configs
- [ ] CI pipeline green on GitHub (validate, test, build, integration tests, arch tests)
- [ ] Preview deployments working for pull requests
- [ ] `bash scripts/setup.sh` takes a fresh engineer from clone to running platform
- [ ] `bash scripts/verify-platform.sh` exits 0
- [ ] `pnpm dev` starts all applications at their designated ports

---

### What Exists at the End of the First Week

```
edunexus/
├── apps/ (10 applications — all running)
├── packages/ (22 packages — all building and tested)
├── services/ (9 service stubs)
├── workers/ (10 worker stubs)
├── infra/
│   └── supabase/
│       ├── migrations/20240101000000_initial_schema.sql
│       └── seed/001_demo_data.sql
├── docker/
│   └── docker-compose.yml
├── .github/
│   ├── workflows/ci.yml
│   ├── workflows/preview.yml
│   ├── workflows/security.yml
│   └── dependabot.yml
├── scripts/
│   ├── setup.sh
│   ├── verify-platform.sh
│   ├── generate-types.sh
│   └── generate-all.sh
├── .vscode/ (settings, extensions, launch, tasks)
├── .cursor/ (rules)
├── .husky/ (pre-commit, commit-msg, pre-push)
├── tests/e2e/ (smoke tests)
├── CLAUDE.md
├── CODEOWNERS
├── CONTRIBUTING.md
├── SECURITY.md
├── ARCHITECTURE.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── eslint.config.js
└── prettier.config.js
```

**First Week CI Status:** Green ✓

**First Week Test Coverage:** > 80% for `packages/utils`, `packages/validation`, `packages/config`

**First Week Build Time:** < 3 minutes (Turborepo remote cache warm)

---

### The Statement

The repository is no longer an architectural vision.

It is now an operational engineering platform from which EduNexus will be built.

---

*EduNexus Repository Bootstrap Guide*
*Version 1.0.0 | Implementation Guide*
*Kenya CBC/CBE AI Education Platform*

---

**Document Information**

| Field | Value |
|-------|-------|
| Document ID | ENG-IMPL-001 |
| Version | 1.0.0 |
| Status | Canonical |
| Precedes | Feature Development |
| Follows | Monorepo Foundation Specification (ENG-SPEC-001) |
| Last Updated | 2026-06-30 |

**Related Documents**

- Monorepo Foundation Specification (`docs/monorepo-foundation-specification.md`)
- Platform Implementation Guide (`docs/platform-implementation-guide.md`)
- Engineering Handbook (`docs/engineering/`)
