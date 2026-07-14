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

      // Hii ndiyo imekuletea hiyo message
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
];

export default config;

