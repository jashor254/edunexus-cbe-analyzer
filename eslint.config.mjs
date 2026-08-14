import js from "@eslint/js";
import globals from "globals";
import next from "eslint-config-next";

const config = [
  {
    ignores: [".claude/**", "node_modules/**", ".next/**"],
  },
  js.configs.recommended,
  ...next,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-undef": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",

      // React Compiler rules (eslint-plugin-react-hooks v7) are stricter than
      // this codebase's patterns — e.g. "reset state on prop change" and
      // "compute relative time in a helper" are idiomatic React, not bugs.
      // Downgraded to warn until each site gets a deliberate, tested rewrite.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",

      "import/no-anonymous-default-export": "off",
    },
  },

  // Read-path guardrail (Phase 0 — docs/architecture/learner-record-layer-decisions.md
  // Decision 5, docs/architecture/learner-record-layer-closure.md invariant 2).
  // The three learner-scoped bulk-read methods on the Evidence repository
  // (findByLearner, findConfirmedEvidenceForLearner, findPendingReview) are
  // reserved for lib/projection/ and lib/intelligence/ — nothing else may
  // call them. This targets those three specific methods only, not the
  // Evidence repository as a whole: every evidence-writer module (assessments,
  // compass, holiday, remedial, etc.) legitimately calls createIngestionRun/
  // completeIngestionRun on repos.evidence today, and must keep working.
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["lib/projection/**", "lib/intelligence/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.object.name='repos'][callee.object.property.name='evidence'][callee.property.name='findByLearner']",
          message:
            "repos.evidence.findByLearner() is reserved for lib/projection/ and lib/intelligence/. Learner intelligence state is read via lib/projection/recompute.ts (recomputeLearnerProjection) only. See docs/architecture/learner-record-layer-decisions.md Decision 5.",
        },
        {
          selector:
            "CallExpression[callee.object.object.name='repos'][callee.object.property.name='evidence'][callee.property.name='findConfirmedEvidenceForLearner']",
          message:
            "repos.evidence.findConfirmedEvidenceForLearner() is reserved for lib/projection/ and lib/intelligence/. Learner intelligence state is read via lib/projection/recompute.ts (recomputeLearnerProjection) only. See docs/architecture/learner-record-layer-decisions.md Decision 5.",
        },
        {
          selector:
            "CallExpression[callee.object.object.name='repos'][callee.object.property.name='evidence'][callee.property.name='findPendingReview']",
          message:
            "repos.evidence.findPendingReview() is reserved for lib/projection/ and lib/intelligence/. See docs/architecture/learner-record-layer-decisions.md Decision 5.",
        },
      ],
    },
  },

  // Identity constructor confinement (IDENTITY-1 Phase 2).
  //
  // `asLearnerId` / `asStudentId` assert an identity's DATABASE DOMAIN without
  // validating anything — they are compile-time claims about where a value came
  // from. That makes them exactly as dangerous as `as unknown as` if they spread
  // into ordinary domain logic, which is the failure this rule exists to prevent:
  // Phase 1's whole benefit disappears the moment a Blueprint or Compass module
  // can silence a type error by wrapping a string.
  //
  // The invariant: domain logic RECEIVES branded ids, it does not CONSTRUCT them.
  // Construction is legitimate only where a value's origin is directly visible —
  // a row read from `learners`/`students`, a resolver output, or a route
  // parameter about to be used against a known table.
  //
  // The allowlist below is derived from the actual Phase 2 usage audit, not
  // guessed: at the time of writing, ZERO construction sites existed outside it
  // (lib/core 8, lib/intelligence 4, lib/projection 1, app/** route boundaries,
  // scripts/** fixtures). The rule therefore starts green and stays a real
  // constraint rather than a backlog.
  //
  // The TYPES are deliberately not restricted — any module may freely import
  // `LearnerId` / `StudentId`. Only the construction helpers are confined.
  {
    files: ["lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: [
      // Identity resolvers and the Core<->legacy bridge live here.
      "lib/core/**",
      // Reads rows straight out of `students` / `learners`.
      "lib/repositories/**",
      // Matches an ingestion roster against the `students` table.
      "lib/intelligence/**",
      // Brands at the `learner_projections` write builder.
      "lib/projection/**",
      // The module that defines them.
      "lib/core/identityTypes.ts",
      "**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/core/identityTypes",
              importNames: ["asLearnerId", "asStudentId", "asLearnerIdOrNull", "asStudentIdOrNull"],
              message:
                "Construct LearnerId/StudentId only at an identity trust boundary (a repository read, an identity resolver, or a validated route parameter). Domain logic should RECEIVE branded ids — take one as a parameter instead of constructing it. Importing the LearnerId/StudentId TYPES here is fine. See IDENTITY-1 Phase 2.",
            },
          ],
        },
      ],
    },
  },
];

export default config;

