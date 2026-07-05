# EduNexus Standards Series

## Volume 6 — Plugin Development Guide

### Extending Educational Intelligence Platforms

**Edition 1.0 — June 2026**

---

## Preface

A plugin system allows an educational intelligence platform to grow beyond what any single team can build. Plugins extend the platform with new capabilities — new AI skills, new curriculum content, new assessment types, new analytics — without requiring changes to the platform itself.

This volume defines the standards for educational platform plugin systems. It covers the plugin lifecycle, permission model, capability APIs, security requirements, and marketplace publication process.

These standards are designed to be adopted by any educational intelligence platform, not only EduNexus.

---

## Chapter 1 — Plugin Concepts

### 1.1 What Is a Plugin?

A plugin is a packaged extension that executes inside the platform's plugin runtime environment. It has access to controlled platform capabilities through an extension API and can extend the platform's behaviour in defined extension points.

A plugin is different from an external application:

| Dimension | Application | Plugin |
|---|---|---|
| Runs on | Partner infrastructure | Platform Plugin Runtime |
| Data access | Via public APIs | Via Extension APIs (more privileged) |
| User experience | Partner's own UI | Platform's UI (via extension points) |
| Lifecycle | Partner-managed | Platform-managed |
| Trust level | External | Internal (after certification) |

### 1.2 Plugin Categories

**AI Skill plugins** extend the AI generation capabilities of the platform. An AI skill plugin defines:
- A new generation task
- The curriculum context requirements for that task
- The prompt template
- The output schema
- The validation logic

**Curriculum Pack plugins** add curriculum data for additional curriculum systems, grades, or subjects not built into the platform core.

**Assessment Extension plugins** add new assessment item types, rubric formats, or marking algorithms.

**Analytics Extension plugins** add new computed metrics, aggregations, or visualizations to the analytics layer.

**Workflow Extension plugins** add new automated workflow triggers and actions.

**UI Extension plugins** add new components to platform-provided user interfaces at designated extension points.

### 1.3 Plugin Manifest

Every plugin is described by a manifest file:

```json
{
  "manifest_version": "1.0",
  "id": "com.example.numeracy-assessment-plus",
  "name": "Numeracy Assessment Plus",
  "description": "Extends CBC assessment with adaptive numeracy diagnostic items for Grade 7–9.",
  "version": "1.2.0",
  "author": {
    "name": "Example Education Ltd",
    "email": "plugins@example.co.ke",
    "url": "https://example.co.ke"
  },
  "categories": ["assessment_extension", "ai_skill"],
  "minimum_platform_version": "2.0.0",
  "permissions": [
    "learner.competencies:read",
    "assessment.items:write",
    "ai.generate:assessment",
    "curriculum:read"
  ],
  "extension_points": [
    {
      "id": "assessment.item_types.numeracy_diagnostic",
      "type": "assessment_item_type",
      "handler": "./handlers/numeracy-item.js"
    }
  ],
  "ai_skills": [
    {
      "id": "adaptive_numeracy_assessment",
      "name": "Adaptive Numeracy Assessment Generator",
      "handler": "./skills/adaptive-numeracy.js"
    }
  ],
  "privacy_policy_url": "https://example.co.ke/privacy",
  "support_url": "https://example.co.ke/support",
  "documentation_url": "https://docs.example.co.ke/plugins/numeracy"
}
```

---

## Chapter 2 — Plugin Lifecycle

### 2.1 Development Phase

The development phase uses the Plugin SDK and CLI:

```bash
# Initialize a new plugin project
edunexus plugin init my-plugin --category ai_skill

# Start the local development environment
edunexus plugin dev

# Run plugin tests
edunexus plugin test

# Validate manifest and code against platform standards
edunexus plugin validate
```

The local development environment provides:
- A mock Plugin Runtime that simulates the production environment
- Sandbox platform data for testing
- A mock Extension API that responds with realistic data
- Hot reload for rapid development

### 2.2 Testing Phase

Plugins must pass a comprehensive test suite before submission:

**Unit tests.** Every handler function must have unit tests that cover happy path and error cases.

**Integration tests.** The plugin must be tested against the mock Platform Runtime, verifying that it correctly uses the Extension API.

**Security tests.** The plugin must pass automated security scanning (dependency vulnerabilities, code injection patterns, unsafe eval usage).

**Performance tests.** Handler functions must complete within defined timeouts when tested with realistic data volumes.

### 2.3 Submission Phase

```bash
# Package the plugin
edunexus plugin package

# Submit for review
edunexus plugin submit --marketplace
```

The submission process:
1. Automated manifest validation
2. Automated security scanning
3. Automated functional testing in a review environment
4. Human review (technical + educational quality)
5. Approval or rejection with feedback

### 2.4 Publication Phase

After approval, the plugin is published to the marketplace. Publishers can:
- Set pricing and trial periods
- Configure which markets the plugin is available in
- Set compatible platform version ranges
- Schedule release dates

### 2.5 Installation Phase

When a school administrator installs a plugin:
1. The platform displays the plugin's requested permissions
2. The administrator reviews and approves permissions
3. The platform loads the plugin into the Plugin Runtime for that tenant
4. The plugin is initialized with tenant-specific configuration
5. Extension points are registered

### 2.6 Update Phase

When a plugin update is published:
- Tenants are notified of the update
- Updates that do not change permissions are applied automatically (with a configurable opt-out)
- Updates that change permissions require re-approval from the administrator
- Emergency security updates are applied automatically with notification

### 2.7 Deactivation and Uninstallation

```
Deactivation: Plugin handlers stop executing. Extension points are unregistered.
              Plugin configuration and tenant-specific data are retained.

Uninstallation: Plugin is removed from the tenant. Platform-side tenant data
                associated with the plugin is retained for the configured retention period.
                Plugin's own data stores (if any) are deleted.
```

---

## Chapter 3 — Permissions

### 3.1 Permission Model

Plugins operate under the principle of least privilege. A plugin may only access resources and capabilities explicitly declared in its manifest and approved by the installing tenant administrator.

Permission scopes follow the format `resource.operation`:

```
learner.profile:read          — read basic learner profile data
learner.competencies:read     — read learner competency states
learner.risk:read             — read learner risk scores
learner.progress:write        — record progress events

teacher.profile:read          — read teacher profile
teacher.plans:read            — read lesson plans
teacher.plans:write           — create/update lesson plans

assessment.items:read         — read assessment items from bank
assessment.items:write        — create assessment items
assessment.results:read       — read assessment results
assessment.results:write      — submit assessment results

curriculum:read               — read curriculum structure and content

ai.generate:lesson_plan       — use AI to generate lesson plans
ai.generate:assessment        — use AI to generate assessments
ai.generate:custom            — use custom AI skills

events.subscribe:learner.*    — subscribe to all learner events
events.subscribe:assessment.* — subscribe to all assessment events
events.emit:custom            — emit custom platform events

analytics:read                — read analytics aggregates

notifications.send:teacher    — send notifications to teachers
notifications.send:parent     — send notifications to parents
```

### 3.2 Permission Tiers

Permissions are grouped into tiers based on sensitivity:

**Tier 1 — Standard (automatically approvable by any tenant administrator):**
- curriculum:read
- ai.generate:lesson_plan
- ai.generate:assessment
- teacher.plans:read/write
- assessment.items:read/write

**Tier 2 — Sensitive (requires explicit awareness from administrator):**
- learner.profile:read
- learner.competencies:read
- learner.progress:write
- assessment.results:read

**Tier 3 — Privileged (requires additional justification and governance review):**
- learner.risk:read
- notifications.send:parent
- events.subscribe:*
- analytics:read

**Tier 4 — Restricted (requires platform-level approval beyond marketplace certification):**
- learner.profile:write
- Custom data export permissions

### 3.3 Permission Enforcement

Permissions are enforced at the Extension API layer, not at the plugin code layer. A plugin handler that calls `context.learners.get(id)` without the `learner.profile:read` permission will receive an `InsufficientPermissions` error. The enforcement cannot be bypassed.

---

## Chapter 4 — Capabilities

### 4.1 Extension API

The Extension API is the interface between plugin code and platform capabilities. It is accessed through the `PluginContext` object injected into every plugin handler.

```typescript
import { PluginContext } from '@edunexus/plugin-sdk';

export async function handler(context: PluginContext, event: unknown): Promise<void> {
  // Learner operations
  const learner = await context.learners.get(learnerId);
  const competencies = await context.learners.getCompetencies(learnerId);
  await context.learners.recordProgress({ learnerId, ...progressData });

  // Curriculum operations
  const subStrand = await context.curriculum.getNode('CBC_G8_MATHS_S3_SS2');
  const outcomes = await context.curriculum.getLearningOutcomes(subStrandId);

  // Assessment operations
  const item = await context.assessments.createItem(itemData);
  const results = await context.assessments.getResults(assessmentId);

  // AI operations
  const plan = await context.ai.generate({
    skill: 'lesson_plan',
    context: { curriculumRef, classId },
  });

  // Notification operations
  await context.notifications.send({
    to: { role: 'teacher', id: teacherId },
    template: 'my-plugin:alert',
    data: { ... },
  });

  // Event emission
  await context.events.emit({
    type: 'my-plugin:analysis-complete',
    data: { ... },
  });

  // Storage operations
  const stored = await context.storage.get('my-config-key');
  await context.storage.set('my-config-key', { ... });
}
```

### 4.2 Context Isolation

The `PluginContext` is automatically scoped to:
- The requesting tenant (a plugin cannot access data from other tenants)
- The approved permissions (operations beyond approved permissions throw immediately)
- The requesting user's authorization level (a plugin called by a teacher cannot access resources beyond the teacher's scope)

### 4.3 Storage API

Plugins can store tenant-specific data using the Platform Storage API. Storage is:
- Key-value with JSON values
- Scoped to the plugin + tenant (isolated from other plugins and other tenants)
- Subject to the plugin's data retention policy
- Backed up with the platform's standard backup regime
- Deleted on plugin uninstallation

Storage limits:
- 10 MB per plugin per tenant (Standard tier)
- 100 MB per plugin per tenant (Professional tier)
- Custom limits (Enterprise tier)

---

## Chapter 5 — Events

### 5.1 Event Subscription

Plugins subscribe to platform events through the manifest:

```json
{
  "event_subscriptions": [
    {
      "event_type": "learner.risk_score.elevated",
      "handler": "./handlers/risk-handler.js",
      "filter": {
        "risk_level": ["elevated", "critical"]
      }
    },
    {
      "event_type": "assessment.result.available",
      "handler": "./handlers/result-handler.js"
    }
  ]
}
```

### 5.2 Event Emission

Plugins can emit custom events that other components can subscribe to:

```typescript
await context.events.emit({
  type: 'my-plugin:custom-analysis-complete',
  data: {
    learnerId: 'abc',
    result: { ... }
  }
});
```

Custom events are namespaced to the plugin (`my-plugin:*`) to prevent collision with platform events.

### 5.3 Event Ordering and Reliability

Plugin event handlers must be idempotent. The Plugin Runtime delivers events at least once. A handler may be called multiple times with the same event in failure scenarios.

Event handlers must complete within 30 seconds. Long-running operations must be queued internally within the plugin.

---

## Chapter 6 — UI Extensions

### 6.1 Extension Points

Platform UIs expose designated extension points where plugins can inject custom UI components:

| Extension Point | Location | Purpose |
|---|---|---|
| `teacher.dashboard.panel` | Teacher dashboard | Custom information panel |
| `learner.profile.tab` | Learner profile page | Custom learner data tab |
| `assessment.result.annotation` | Assessment result view | Custom result annotations |
| `lesson_plan.section` | Lesson plan template | Custom plan sections |
| `class.analytics.widget` | Class analytics | Custom metric widgets |

### 6.2 UI Extension Security

UI extensions render inside sandboxed iframes. They cannot:
- Access the parent page's DOM
- Read cookies or localStorage from the parent context
- Make requests to domains not in the plugin's declared network allowlist
- Execute JavaScript outside the iframe sandbox

UI extensions communicate with the platform through a defined message-passing API.

### 6.3 UI Extension API

```typescript
import { UIExtensionContext } from '@edunexus/plugin-sdk/ui';

const extension = new UIExtension({
  extensionPoint: 'teacher.dashboard.panel',
  render: (context: UIExtensionContext) => {
    // React, Vue, Svelte, or vanilla JS components
    const learnerCount = context.data.learnerCount;
    return `<div class="my-plugin-panel">
      <h3>Numeracy Risk Overview</h3>
      <p>${learnerCount} learners assessed</p>
    </div>`;
  }
});

extension.on('data', (data) => {
  // Data passed from the platform to the extension
});

extension.send('request-detail', { learnerId: 'abc' });
```

---

## Chapter 7 — Backend Extensions

### 7.1 Capability Extension

Backend extensions add new computation or data processing capabilities to the platform:

**New competency model.** A plugin that implements a custom competency tracking algorithm alongside the platform's default model.

**New risk model.** A plugin that adds a domain-specific risk factor (e.g., socioeconomic risk based on external data) to the platform's risk calculation.

**New analytics metric.** A plugin that computes a custom metric (e.g., a composite "learning velocity" score) from platform data.

### 7.2 Scheduled Execution

Backend plugins can register scheduled tasks:

```json
{
  "scheduled_tasks": [
    {
      "id": "weekly-numeracy-analysis",
      "schedule": "0 6 * * 1",
      "handler": "./handlers/weekly-analysis.js",
      "description": "Weekly numeracy risk analysis"
    }
  ]
}
```

Scheduled tasks are subject to the same permission and timeout constraints as event-triggered tasks.

---

## Chapter 8 — AI Extensions

### 8.1 AI Skill Plugin

An AI skill plugin defines a new generation capability available in the AI Gateway:

```json
{
  "ai_skills": [
    {
      "id": "adaptive_numeracy_diagnostic",
      "name": "Adaptive Numeracy Diagnostic Generator",
      "description": "Generates adaptive diagnostic assessments for numeracy gaps",
      "input_schema": {
        "type": "object",
        "properties": {
          "learnerId": { "type": "string" },
          "targetSubStrand": { "type": "string" },
          "difficulty": { "type": "string", "enum": ["introductory", "standard", "challenging"] }
        },
        "required": ["learnerId", "targetSubStrand"]
      },
      "output_schema": { ... },
      "handler": "./skills/adaptive-numeracy.js"
    }
  ]
}
```

### 8.2 Prompt Composition

AI skill plugins compose prompts in collaboration with the platform's grounding system:

```typescript
export async function generateAdaptiveNumeracy(
  context: PluginContext,
  input: { learnerId: string; targetSubStrand: string }
): Promise<object> {
  const learner = await context.learners.getCompetencies(input.learnerId);
  const curriculumNode = await context.curriculum.getNode(input.targetSubStrand);

  const response = await context.ai.generate({
    systemPrompt: `You are generating adaptive diagnostic items for numeracy assessment.
    The learner's current competency state is: ${JSON.stringify(learner)}
    The target curriculum node is: ${JSON.stringify(curriculumNode)}
    
    CONSTRAINTS:
    - Only reference learning outcomes from the provided curriculum node.
    - Generate items that reveal whether the learner has specific prerequisite gaps.
    - Ensure items are at the appropriate difficulty level.`,
    task: `Generate 5 diagnostic items that identify numeracy gaps for Sub-Strand ${input.targetSubStrand}.`,
    outputSchema: AdaptiveAssessmentSchema,
  });

  return response;
}
```

AI skill plugins must comply with all standards in Volume 5 (Educational AI Standards).

---

## Chapter 9 — Plugin Security

### 9.1 Security Requirements

All plugins must meet these security requirements to pass certification:

**No supply chain vulnerabilities.** All dependencies must be scanned for known vulnerabilities. Dependencies with critical or high CVEs are not permitted.

**No unsafe code patterns.** Plugins must not use `eval()`, `Function()`, `innerHTML` assignment, or other code injection vectors.

**No network requests to unapproved domains.** All outbound network requests must be to domains declared in the manifest. The Plugin Runtime blocks all other network requests.

**No file system access.** Plugins have no access to the file system. Data is accessed through the Extension API.

**No secret embedding.** Credentials, API keys, or other secrets must not be embedded in plugin code. Secrets are managed through the Plugin Runtime's secrets management.

**Dependency lock files.** All dependencies must be pinned with exact versions and accompanied by a lock file.

### 9.2 Sandboxing Implementation

The Plugin Runtime sandboxes plugin code using:

- **Process isolation.** Each plugin handler executes in an isolated Node.js VM context.
- **Memory limits.** Handler execution is subject to a configurable memory limit.
- **CPU limits.** Handler execution is subject to a CPU time limit.
- **Network isolation.** Outbound network is filtered by the network allowlist in the manifest.
- **File system isolation.** No file system access is available.

### 9.3 Secrets Management

Plugins that require external API credentials use the Plugin Runtime's secrets management:

```typescript
// Access secrets via the context, never hardcode
const apiKey = await context.secrets.get('EXTERNAL_API_KEY');
```

Secrets are set by the tenant administrator at installation time. The plugin code never has access to the secret values — only to the resolved values at runtime.

### 9.4 Security Incident Response

If a security vulnerability is discovered in a production plugin:

1. **Immediate (0–4 hours).** If severity is critical: disable the plugin across all tenants. If severity is high: restrict the plugin's permissions to the minimum safe set.
2. **Short term (4–24 hours).** Notify affected tenants. Provide clear explanation of the vulnerability and its potential impact.
3. **Remediation.** Plugin publisher submits patched version with expedited review.
4. **Resolution.** Patched version deployed. Affected tenants notified of resolution.

---

## Chapter 10 — Version Compatibility

### 10.1 Platform Version Compatibility

Every plugin declares the minimum platform version it requires:

```json
{
  "minimum_platform_version": "2.0.0",
  "maximum_platform_version": null
}
```

The Plugin Runtime validates compatibility before installation and before each update.

### 10.2 Extension API Versioning

Extension API methods are versioned. A plugin compiled against Extension API v1 will continue to work when the platform upgrades to Extension API v2, because the Plugin Runtime maintains backwards compatibility layers.

Extension API methods that have been deprecated display a deprecation warning in the plugin development environment.

Extension API methods are removed after 24 months of deprecation. Plugins using removed methods are flagged as incompatible and blocked from installation.

### 10.3 Plugin Update Compatibility Contract

Plugin updates must maintain backwards compatibility:
- Existing stored data must remain readable after update
- Existing tenant configurations must remain valid after update
- Permission requests must not increase without tenant re-approval

---

## Chapter 11 — Marketplace Publication

### 11.1 Publication Requirements

To publish a plugin to the marketplace, a developer must:

1. **Complete Developer Certification** (Volume 9)
2. **Pass Technical Review** — automated and manual review of the plugin code and manifest
3. **Pass Security Review** — security scanning and sandbox verification
4. **Pass Educational Quality Review** (for AI skill plugins) — review by curriculum experts
5. **Provide Complete Documentation** — installation guide, configuration guide, usage guide
6. **Agree to Marketplace Terms** — data handling terms, revenue sharing terms, update obligations

### 11.2 Listing Requirements

A marketplace listing must include:

- Title and description in plain language (no technical jargon in the user-facing description)
- Clear statement of what the plugin does and what data it accesses
- Screenshots or video demonstration
- Pricing model
- Support contact
- Privacy policy URL
- Documentation URL
- Known limitations and incompatibilities

### 11.3 Update Obligations

Published plugins have ongoing obligations:

- Security vulnerabilities must be patched within 72 hours of disclosure
- Plugin must remain compatible with the current platform version
- If a plugin is discontinued, tenants must be given 90 days notice

Failure to meet update obligations results in removal from the marketplace.

---

*EduNexus Standards Series — Volume 6: Plugin Development Guide*

*Edition 1.0 — June 2026*
