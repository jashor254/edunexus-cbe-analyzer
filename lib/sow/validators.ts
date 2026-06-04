// lib/sow/validators.ts

import {
  UNIVERSAL_L1, UNIVERSAL_L2, UNIVERSAL_L3,
  SUBJECT_EXTENSIONS, VERB_STEMS, normalizeVerb, scoreOutcome,
} from './verbLibrary'

// ================= VERB HIERARCHY (CBC) =================
// Subject-aware verb orders. 'solve'/'calculate' are L1 for Maths; L2 for default.
// These per-subject lists are merged with the universal pools at lookup time.
const VERB_ORDERS: Record<string, string[][]> = {
  default: [
    // Level 1 — Knowledge & Recall
    [
      'state', 'identify', 'describe', 'outline',
      'define', 'list', 'name', 'label', 'match',
      'recall', 'recognize', 'select', 'locate',
      'collect', 'count', 'draw', 'find', 'give',
      'make', 'note', 'observe', 'read', 'record',
      'show', 'tell', 'trace', 'use', 'write',
    ],
    // Level 2 — Understanding & Application
    [
      'explain', 'discuss', 'analyze', 'examine',
      'compare', 'contrast', 'classify', 'interpret',
      'summarize', 'distinguish', 'illustrate',
      'connect', 'convert', 'determine', 'differentiate',
      'express', 'formulate', 'infer', 'justify',
      'predict', 'relate', 'research', 'review',
      'sequence', 'solve', 'apply', 'calculate',
      'demonstrate', 'investigate', 'measure',
      'construct', 'develop', 'design', 'use',
    ],
    // Level 3 — Values & Attitudes
    [
      'appreciate', 'value', 'acknowledge',
      'advocate', 'champion', 'commit', 'compose',
      'communicate', 'create', 'critique', 'edit',
      'evaluate', 'generate', 'implement', 'integrate',
      'model', 'organize', 'plan', 'present',
      'produce', 'propose', 'reflect', 'revise',
      'show', 'synthesize', 'support', 'promote',
    ],
  ],

  mathematics: [
    // Level 1 — Knowledge + primary Maths action verbs (solve/find are L1 here)
    [
      'identify', 'state', 'define', 'describe',
      'list', 'name', 'recognize', 'recall',
      'write', 'count', 'draw', 'find', 'solve',
      'read', 'label', 'match', 'select', 'locate',
      'give', 'show', 'record',
    ],
    // Level 2 — Computation & Application
    [
      'explain', 'calculate', 'apply', 'compute',
      'determine', 'evaluate', 'analyze', 'compare',
      'differentiate', 'justify', 'verify', 'prove',
      'simplify', 'expand', 'factorize', 'plot',
      'construct', 'measure', 'investigate', 'convert',
      'formulate', 'deduce', 'derive', 'demonstrate',
    ],
    // Level 3 — Values & Real-life connections
    [
      'appreciate', 'value', 'develop', 'create',
      'model', 'design', 'generalize', 'promote',
      'reflect', 'advocate', 'synthesize', 'evaluate',
    ],
  ],

  science: [
    // Level 1 — Observation & Knowledge
    [
      'identify', 'state', 'define', 'describe',
      'list', 'name', 'observe', 'classify',
      'record', 'collect', 'label', 'draw',
      'recognize', 'recall', 'select', 'locate',
      'note', 'give', 'show',
    ],
    // Level 2 — Investigation & Application
    [
      'explain', 'analyze', 'compare', 'examine',
      'investigate', 'predict', 'hypothesize',
      'experiment', 'measure', 'calculate', 'test',
      'determine', 'differentiate', 'interpret',
      'construct', 'design', 'apply', 'solve',
      'formulate', 'demonstrate',
    ],
    // Level 3 — Values & Real-world connections
    [
      'appreciate', 'value', 'evaluate', 'create',
      'develop', 'model', 'advocate', 'promote',
      'reflect', 'synthesize', 'generalize',
    ],
  ],

  // ── CBC SENIOR: MATHEMATICS (Grade 10-12) ────────────────────────────────
  cbc_senior_mathematics: [
    [
      'count', 'define', 'draw', 'find',
      'identify', 'label', 'list', 'locate',
      'match', 'name', 'read', 'recall',
      'recognize', 'record', 'select', 'show',
      'state', 'write', 'arrange', 'complete',
      'copy', 'give', 'mark', 'order',
      'sort', 'substitute', 'tabulate', 'trace',
    ],
    [
      'add', 'analyze', 'apply', 'calculate',
      'classify', 'compare', 'compute',
      'construct', 'convert', 'deduce',
      'demonstrate', 'derive', 'determine',
      'differentiate', 'divide', 'estimate',
      'evaluate', 'expand', 'explain',
      'factorize', 'formulate', 'graph',
      'illustrate', 'integrate', 'investigate',
      'justify', 'measure', 'multiply',
      'plot', 'predict', 'prove',
      'round', 'simplify', 'sketch',
      'solve', 'subtract', 'transform',
      'verify', 'visualize',
    ],
    [
      'advocate', 'appreciate', 'assess',
      'collaborate', 'communicate', 'compose',
      'create', 'critique', 'design',
      'develop', 'generalize', 'implement',
      'model', 'organize', 'plan',
      'present', 'produce', 'promote',
      'propose', 'reflect', 'represent',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── CBC SENIOR: ENGLISH (Grade 10-12) ────────────────────────────────────
  cbc_senior_english: [
    [
      'copy', 'define', 'fill', 'find',
      'identify', 'label', 'list', 'listen',
      'locate', 'match', 'name', 'outline',
      'quote', 'read', 'recall', 'recognize',
      'record', 'repeat', 'select', 'show',
      'spell', 'state', 'underline', 'write',
    ],
    [
      'analyze', 'arrange', 'classify',
      'compare', 'compose', 'construct',
      'contrast', 'decode', 'describe',
      'differentiate', 'discuss', 'draft',
      'edit', 'examine', 'explain',
      'express', 'extract', 'formulate',
      'illustrate', 'infer', 'interpret',
      'narrate', 'paraphrase', 'predict',
      'present', 'rewrite', 'sequence',
      'summarize', 'translate',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'design',
      'develop', 'generate', 'justify',
      'organize', 'perform', 'plan',
      'produce', 'promote', 'propose',
      'publish', 'reflect', 'revise',
      'support', 'synthesize', 'validate',
      'value',
    ],
  ],

  // ── CBC SENIOR: KISWAHILI (Grade 10-12) ──────────────────────────────────
  cbc_senior_kiswahili: [
    [
      'andika', 'eleza', 'fahamia',
      'identify', 'label', 'list',
      'locate', 'match', 'name',
      'outline', 'read', 'recall',
      'recognize', 'record', 'repeat',
      'select', 'show', 'soma',
      'state', 'taja', 'write',
    ],
    [
      'analyze', 'compare', 'compose',
      'construct', 'contrast', 'describe',
      'differentiate', 'discuss', 'draft',
      'edit', 'examine', 'explain',
      'express', 'extract', 'formulate',
      'illustrate', 'infer', 'interpret',
      'narrate', 'paraphrase', 'predict',
      'rewrite', 'sequence', 'summarize',
      'translate',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'develop',
      'generate', 'organize', 'perform',
      'plan', 'produce', 'promote',
      'propose', 'publish', 'reflect',
      'revise', 'support', 'synthesize',
      'value',
    ],
  ],

  // ── CBC SENIOR: BIOLOGY (Grade 10-12) ────────────────────────────────────
  cbc_senior_biology: [
    [
      'classify', 'collect', 'define',
      'describe', 'draw', 'find',
      'give', 'identify', 'label',
      'list', 'locate', 'match',
      'name', 'note', 'observe',
      'outline', 'read', 'recall',
      'recognize', 'record', 'select',
      'show', 'sort', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'compare', 'conclude',
      'construct', 'contrast', 'demonstrate',
      'design', 'determine', 'differentiate',
      'discuss', 'estimate', 'examine',
      'experiment', 'explain', 'formulate',
      'hypothesize', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'measure', 'model', 'predict',
      'relate', 'research', 'simulate',
      'solve', 'summarize', 'test', 'verify',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'communicate', 'create',
      'critique', 'defend', 'develop',
      'generalize', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'produce', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── CBC SENIOR: CHEMISTRY (Grade 10-12) ──────────────────────────────────
  cbc_senior_chemistry: [
    [
      'classify', 'collect', 'define',
      'describe', 'draw', 'find',
      'give', 'identify', 'label',
      'list', 'locate', 'match',
      'name', 'note', 'observe',
      'outline', 'read', 'recall',
      'recognize', 'record', 'select',
      'show', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'balance',
      'calculate', 'compare', 'conclude',
      'construct', 'contrast', 'deduce',
      'demonstrate', 'design', 'determine',
      'differentiate', 'discuss', 'estimate',
      'examine', 'experiment', 'explain',
      'formulate', 'hypothesize', 'infer',
      'interpret', 'investigate', 'justify',
      'measure', 'model', 'predict',
      'prepare', 'prove', 'relate',
      'research', 'solve', 'summarize',
      'test', 'verify',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'communicate', 'create',
      'critique', 'defend', 'develop',
      'generalize', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'produce', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── CBC SENIOR: PHYSICS (Grade 10-12) ────────────────────────────────────
  cbc_senior_physics: [
    [
      'classify', 'define', 'describe',
      'draw', 'find', 'identify',
      'label', 'list', 'locate',
      'match', 'measure', 'name',
      'note', 'observe', 'outline',
      'read', 'recall', 'recognize',
      'record', 'select', 'show',
      'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'compare', 'conclude', 'construct',
      'contrast', 'deduce', 'demonstrate',
      'design', 'determine', 'differentiate',
      'discuss', 'estimate', 'examine',
      'experiment', 'explain', 'formulate',
      'hypothesize', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'model', 'predict', 'prove',
      'relate', 'research', 'simulate',
      'sketch', 'solve', 'summarize',
      'test', 'verify',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'communicate', 'create',
      'critique', 'defend', 'develop',
      'generalize', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'produce', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── CBC SENIOR: HISTORY (Grade 10-12) ────────────────────────────────────
  cbc_senior_history: [
    [
      'define', 'describe', 'give',
      'identify', 'label', 'list',
      'locate', 'match', 'name',
      'outline', 'read', 'recall',
      'recognize', 'record', 'retell',
      'select', 'show', 'state',
      'trace', 'write',
    ],
    [
      'analyze', 'classify', 'compare',
      'connect', 'contextualize', 'contrast',
      'deduce', 'describe', 'differentiate',
      'discuss', 'examine', 'explain',
      'explore', 'formulate', 'illustrate',
      'infer', 'interpret', 'investigate',
      'justify', 'narrate', 'predict',
      'relate', 'research', 'review',
      'sequence', 'summarize', 'trace',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'defend',
      'develop', 'generate', 'integrate',
      'judge', 'organize', 'plan',
      'present', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'uphold', 'validate',
      'value',
    ],
  ],

  // ── CBC SENIOR: GEOGRAPHY (Grade 10-12) ──────────────────────────────────
  cbc_senior_geography: [
    [
      'define', 'describe', 'draw',
      'find', 'give', 'identify',
      'label', 'list', 'locate',
      'map', 'match', 'name',
      'note', 'observe', 'outline',
      'read', 'recall', 'recognize',
      'record', 'select', 'show',
      'sketch', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'compare', 'construct',
      'contrast', 'deduce', 'demonstrate',
      'differentiate', 'discuss', 'estimate',
      'examine', 'explain', 'explore',
      'formulate', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'measure', 'model', 'predict',
      'relate', 'research', 'sequence',
      'summarize', 'survey',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'develop',
      'generate', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'promote', 'propose', 'protect',
      'reflect', 'support', 'synthesize',
      'validate', 'value',
    ],
  ],

  // ── CBC SENIOR: BUSINESS STUDIES (Grade 10-12) ───────────────────────────
  cbc_senior_business: [
    [
      'define', 'describe', 'give',
      'identify', 'label', 'list',
      'locate', 'match', 'name',
      'outline', 'read', 'recall',
      'recognize', 'record', 'select',
      'show', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'compare', 'construct',
      'contrast', 'demonstrate', 'differentiate',
      'discuss', 'estimate', 'examine',
      'explain', 'formulate', 'illustrate',
      'interpret', 'investigate', 'justify',
      'plan', 'predict', 'relate',
      'research', 'review', 'solve',
      'summarize',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'design',
      'develop', 'generate', 'implement',
      'integrate', 'manage', 'organize',
      'plan', 'present', 'produce',
      'promote', 'propose', 'reflect',
      'support', 'synthesize', 'validate',
      'value',
    ],
  ],

  // ── CBC SENIOR: COMPUTER SCIENCE (Grade 10-12) ───────────────────────────
  cbc_senior_computer: [
    [
      'define', 'describe', 'draw',
      'find', 'identify', 'label',
      'list', 'locate', 'match',
      'name', 'outline', 'read',
      'recall', 'recognize', 'record',
      'select', 'show', 'state',
      'trace', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'code', 'compare',
      'compile', 'construct', 'convert',
      'debug', 'demonstrate', 'design',
      'determine', 'differentiate', 'discuss',
      'estimate', 'examine', 'explain',
      'formulate', 'illustrate', 'implement',
      'interpret', 'investigate', 'justify',
      'model', 'plan', 'predict',
      'program', 'simulate', 'solve',
      'summarize', 'test', 'verify',
    ],
    [
      'advocate', 'appreciate', 'assess',
      'collaborate', 'communicate', 'create',
      'critique', 'design', 'develop',
      'generate', 'implement', 'innovate',
      'integrate', 'organize', 'plan',
      'present', 'produce', 'promote',
      'propose', 'protect', 'reflect',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── KCSE: MATHEMATICS ────────────────────────────────────────────────────
  kcse_mathematics: [
    [
      'count', 'define', 'draw', 'find',
      'identify', 'label', 'list', 'locate',
      'match', 'name', 'read', 'recall',
      'recognize', 'record', 'select', 'show',
      'state', 'write', 'arrange', 'complete',
      'copy', 'give', 'mark', 'order',
      'sort', 'substitute', 'tabulate',
    ],
    [
      'add', 'analyze', 'apply', 'calculate',
      'classify', 'compare', 'compute',
      'construct', 'convert', 'deduce',
      'demonstrate', 'derive', 'determine',
      'differentiate', 'divide', 'estimate',
      'evaluate', 'expand', 'explain',
      'factorize', 'formulate', 'graph',
      'integrate', 'investigate', 'justify',
      'measure', 'multiply', 'plot',
      'prove', 'round', 'simplify',
      'sketch', 'solve', 'subtract',
      'transform', 'verify', 'visualize',
    ],
    [
      'advocate', 'appreciate', 'assess',
      'collaborate', 'communicate', 'create',
      'critique', 'design', 'develop',
      'generalize', 'implement', 'model',
      'organize', 'plan', 'present',
      'produce', 'promote', 'propose',
      'reflect', 'represent', 'synthesize',
      'validate', 'value',
    ],
  ],

  // ── KCSE: ENGLISH ────────────────────────────────────────────────────────
  kcse_english: [
    [
      'copy', 'define', 'fill', 'find',
      'identify', 'label', 'list', 'listen',
      'locate', 'match', 'name', 'outline',
      'quote', 'read', 'recall', 'recognize',
      'record', 'repeat', 'select', 'show',
      'spell', 'state', 'underline', 'write',
    ],
    [
      'analyze', 'arrange', 'classify',
      'compare', 'compose', 'contrast',
      'decode', 'describe', 'differentiate',
      'discuss', 'draft', 'edit',
      'examine', 'explain', 'express',
      'extract', 'formulate', 'illustrate',
      'infer', 'interpret', 'narrate',
      'paraphrase', 'predict', 'present',
      'rewrite', 'sequence', 'summarize',
      'translate',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'design',
      'develop', 'generate', 'organize',
      'perform', 'plan', 'produce',
      'promote', 'propose', 'publish',
      'reflect', 'revise', 'support',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── KCSE: KISWAHILI ──────────────────────────────────────────────────────
  kcse_kiswahili: [
    [
      'andika', 'eleza', 'find',
      'identify', 'label', 'list',
      'locate', 'match', 'name',
      'outline', 'read', 'recall',
      'recognize', 'record', 'repeat',
      'select', 'show', 'soma',
      'state', 'taja', 'write',
    ],
    [
      'analyze', 'compare', 'compose',
      'construct', 'contrast', 'describe',
      'differentiate', 'discuss', 'draft',
      'edit', 'examine', 'explain',
      'express', 'extract', 'formulate',
      'illustrate', 'infer', 'interpret',
      'narrate', 'paraphrase', 'predict',
      'rewrite', 'sequence', 'summarize',
      'translate',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'develop',
      'generate', 'organize', 'perform',
      'plan', 'produce', 'promote',
      'propose', 'publish', 'reflect',
      'revise', 'support', 'synthesize',
      'value',
    ],
  ],

  // ── KCSE: BIOLOGY ────────────────────────────────────────────────────────
  kcse_biology: [
    [
      'classify', 'collect', 'define',
      'describe', 'draw', 'find',
      'give', 'identify', 'label',
      'list', 'locate', 'match',
      'name', 'note', 'observe',
      'outline', 'read', 'recall',
      'recognize', 'record', 'select',
      'show', 'sort', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'compare', 'conclude', 'construct',
      'contrast', 'deduce', 'demonstrate',
      'design', 'determine', 'differentiate',
      'discuss', 'estimate', 'examine',
      'experiment', 'explain', 'formulate',
      'hypothesize', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'measure', 'model', 'predict',
      'relate', 'research', 'simulate',
      'solve', 'summarize', 'test', 'verify',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'communicate', 'create',
      'critique', 'defend', 'develop',
      'generalize', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'produce', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── KCSE: CHEMISTRY ──────────────────────────────────────────────────────
  kcse_chemistry: [
    [
      'classify', 'collect', 'define',
      'describe', 'draw', 'find',
      'give', 'identify', 'label',
      'list', 'locate', 'match',
      'name', 'note', 'observe',
      'outline', 'read', 'recall',
      'recognize', 'record', 'select',
      'show', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'balance',
      'calculate', 'compare', 'conclude',
      'construct', 'contrast', 'deduce',
      'demonstrate', 'design', 'determine',
      'differentiate', 'discuss', 'estimate',
      'examine', 'experiment', 'explain',
      'formulate', 'hypothesize', 'infer',
      'interpret', 'investigate', 'justify',
      'measure', 'model', 'predict',
      'prepare', 'prove', 'relate',
      'research', 'solve', 'summarize',
      'test', 'verify',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'communicate', 'create',
      'critique', 'defend', 'develop',
      'generalize', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'produce', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── KCSE: PHYSICS ────────────────────────────────────────────────────────
  kcse_physics: [
    [
      'classify', 'define', 'describe',
      'draw', 'find', 'identify',
      'label', 'list', 'locate',
      'match', 'measure', 'name',
      'note', 'observe', 'outline',
      'read', 'recall', 'recognize',
      'record', 'select', 'show',
      'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'compare', 'conclude', 'construct',
      'contrast', 'deduce', 'demonstrate',
      'design', 'determine', 'differentiate',
      'discuss', 'estimate', 'examine',
      'experiment', 'explain', 'formulate',
      'hypothesize', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'model', 'predict', 'prove',
      'relate', 'research', 'simulate',
      'sketch', 'solve', 'summarize',
      'test', 'verify',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'communicate', 'create',
      'critique', 'defend', 'develop',
      'generalize', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'produce', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── KCSE: HISTORY & GOVERNMENT ───────────────────────────────────────────
  kcse_history: [
    [
      'define', 'describe', 'give',
      'identify', 'label', 'list',
      'locate', 'match', 'name',
      'outline', 'read', 'recall',
      'recognize', 'record', 'retell',
      'select', 'show', 'state',
      'trace', 'write',
    ],
    [
      'analyze', 'classify', 'compare',
      'connect', 'contextualize', 'contrast',
      'deduce', 'differentiate', 'discuss',
      'examine', 'explain', 'explore',
      'formulate', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'narrate', 'predict', 'relate',
      'research', 'review', 'sequence',
      'summarize', 'trace',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'defend',
      'develop', 'generate', 'integrate',
      'judge', 'organize', 'plan',
      'present', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'uphold', 'validate',
      'value',
    ],
  ],

  // ── KCSE: GEOGRAPHY ──────────────────────────────────────────────────────
  kcse_geography: [
    [
      'define', 'describe', 'draw',
      'find', 'give', 'identify',
      'label', 'list', 'locate',
      'map', 'match', 'name',
      'note', 'observe', 'outline',
      'read', 'recall', 'recognize',
      'record', 'select', 'show',
      'sketch', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'compare', 'construct',
      'contrast', 'deduce', 'demonstrate',
      'differentiate', 'discuss', 'estimate',
      'examine', 'explain', 'explore',
      'formulate', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'measure', 'model', 'predict',
      'relate', 'research', 'sequence',
      'summarize', 'survey',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'develop',
      'generate', 'implement', 'integrate',
      'organize', 'plan', 'present',
      'promote', 'propose', 'protect',
      'reflect', 'support', 'synthesize',
      'validate', 'value',
    ],
  ],

  // ── KCSE: BUSINESS STUDIES ───────────────────────────────────────────────
  kcse_business: [
    [
      'define', 'describe', 'give',
      'identify', 'label', 'list',
      'locate', 'match', 'name',
      'outline', 'read', 'recall',
      'recognize', 'record', 'select',
      'show', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'compare', 'construct',
      'contrast', 'demonstrate', 'differentiate',
      'discuss', 'estimate', 'examine',
      'explain', 'formulate', 'illustrate',
      'interpret', 'investigate', 'justify',
      'plan', 'predict', 'relate',
      'research', 'review', 'solve',
      'summarize',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'design',
      'develop', 'generate', 'implement',
      'integrate', 'manage', 'organize',
      'plan', 'present', 'produce',
      'promote', 'propose', 'reflect',
      'support', 'synthesize', 'validate',
      'value',
    ],
  ],

  // ── KCSE: AGRICULTURE ────────────────────────────────────────────────────
  kcse_agriculture: [
    [
      'collect', 'define', 'describe',
      'draw', 'find', 'identify',
      'label', 'list', 'locate',
      'match', 'name', 'note',
      'observe', 'outline', 'read',
      'recall', 'recognize', 'record',
      'select', 'show', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'compare', 'construct',
      'contrast', 'demonstrate', 'design',
      'determine', 'differentiate', 'discuss',
      'estimate', 'examine', 'experiment',
      'explain', 'formulate', 'grow',
      'investigate', 'justify', 'measure',
      'model', 'plan', 'plant',
      'predict', 'prepare', 'relate',
      'research', 'solve', 'summarize',
      'test',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'commit',
      'communicate', 'create', 'critique',
      'develop', 'generate', 'implement',
      'innovate', 'integrate', 'organize',
      'plan', 'present', 'produce',
      'promote', 'propose', 'protect',
      'reflect', 'support', 'sustain',
      'synthesize', 'validate', 'value',
    ],
  ],

  // ── KCSE: CRE / IRE ──────────────────────────────────────────────────────
  kcse_religion: [
    [
      'define', 'describe', 'give',
      'identify', 'label', 'list',
      'locate', 'match', 'name',
      'outline', 'read', 'recall',
      'recognize', 'record', 'retell',
      'select', 'show', 'state', 'write',
    ],
    [
      'analyze', 'classify', 'compare',
      'connect', 'contrast', 'deduce',
      'differentiate', 'discuss', 'distinguish',
      'examine', 'explain', 'express',
      'formulate', 'illustrate', 'infer',
      'interpret', 'investigate', 'justify',
      'narrate', 'predict', 'relate',
      'research', 'review', 'sequence',
      'summarize',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'commit', 'communicate',
      'create', 'critique', 'defend',
      'develop', 'integrate', 'internalize',
      'judge', 'organize', 'plan',
      'practice', 'promote', 'propose',
      'protect', 'reflect', 'support',
      'synthesize', 'uphold', 'validate',
      'value',
    ],
  ],

  // ── KCSE: HOME SCIENCE ───────────────────────────────────────────────────
  kcse_home_science: [
    [
      'collect', 'define', 'describe',
      'draw', 'find', 'identify',
      'label', 'list', 'locate',
      'match', 'name', 'note',
      'observe', 'outline', 'read',
      'recall', 'recognize', 'record',
      'select', 'show', 'state', 'write',
    ],
    [
      'analyze', 'apply', 'calculate',
      'classify', 'compare', 'construct',
      'contrast', 'demonstrate', 'design',
      'determine', 'differentiate', 'discuss',
      'estimate', 'examine', 'explain',
      'formulate', 'illustrate', 'investigate',
      'justify', 'measure', 'model',
      'plan', 'predict', 'prepare',
      'relate', 'research', 'solve',
      'summarize', 'test',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'commit',
      'communicate', 'create', 'critique',
      'develop', 'generate', 'implement',
      'integrate', 'manage', 'organize',
      'plan', 'present', 'produce',
      'promote', 'propose', 'protect',
      'reflect', 'support', 'synthesize',
      'validate', 'value',
    ],
  ],
}

// Synonym map for skill-based substrands — DeepSeek uses academic equivalents
const SKILL_SYNONYMS: Record<string, string[]> = {
  'previewing': ['preview', 'pre-read', 'prereading', 'survey', 'surveying', 'overview', 'before reading', 'prior'],
  'predicting': ['predict', 'prediction', 'anticipat', 'forecast', 'expect', 'prior knowledge'],
  'skimming': ['skim', 'rapid read', 'quick read', 'overview', 'gist', 'general idea', 'fast read'],
  'scanning': ['scan', 'locate', 'search', 'find specific', 'look for', 'specific information'],
  'vocabulary': ['vocab', 'word', 'lexis', 'lexical', 'terminology', 'terms', 'meaning', 'dictionary', 'glossary'],
  'selecting': ['select', 'choose', 'pick', 'identify', 'determine', 'decide'],
  'distractions': ['distract', 'focus', 'concentrat', 'attention', 'relevant', 'irrelevant'],
  'inferring': ['infer', 'inference', 'implied', 'implicit', 'deduce', 'conclude', 'read between'],
  'collocations': ['collocat', 'word pair', 'word combination', 'phrases', 'go together'],
  'cohesion': ['cohes', 'linking', 'connect', 'transition', 'flow', 'coherent'],
  'fluency': ['fluent', 'smooth', 'natural', 'flow', 'pace', 'rhythm'],
  'acronyms': ['acronym', 'abbreviat', 'short form', 'initials', 'letters'],
  'affixes': ['affix', 'prefix', 'suffix', 'root word', 'word formation', 'morphology'],
  // Maths / Science
  'indices': ['index', 'power', 'exponent', 'base'],
  'quadratic': ['equation', 'factor', 'quadrat', 'polynomial'],
  'trigonometry': ['trig', 'sine', 'cosine', 'tangent', 'angle'],
  'similarity': ['similar', 'scale', 'enlarge', 'proportion'],
  'statistics': ['data', 'mean', 'median', 'mode', 'frequency'],
  'probability': ['chance', 'likelihood', 'outcome', 'event'],
  'algebra': ['equation', 'expression', 'variable', 'formula'],
  'geometry': ['angle', 'shape', 'triangle', 'circle', 'polygon'],
  'vectors': ['vector', 'scalar', 'magnitude', 'direction'],
  'logarithm': ['log', 'logarithm', 'antilog', 'index'],
  'fraction': ['numerator', 'denominator', 'rational', 'divide'],
}

// Multi-word Level 3 phrases — checked BEFORE single-word scan so their
// component words ('recognize', 'develop') don't map to a lower level.
const MULTI_WORD_L3 = [
  'recognize the importance',
  'develop interest',
  'develop awareness',
  'develop confidence',
]

// ================= HELPERS =================

// Merge a per-subject VERB_ORDERS entry with the universal pools.
// Subject-specific verbs are kept; universal pools fill remaining slots.
function getMergedVerbOrder(subjectType: string): string[][] {
  const base = VERB_ORDERS[subjectType] ?? VERB_ORDERS.default
  const ext  = SUBJECT_EXTENSIONS[subjectType]

  return [0, 1, 2].map(level => {
    const baseSet = new Set(base[level])
    const universal = [UNIVERSAL_L1, UNIVERSAL_L2, UNIVERSAL_L3][level]
    const extVerbs = ext ? ext[level] : []
    return [...new Set([...baseSet, ...extVerbs, ...universal])]
  })
}

// Returns 0 (Level 1) / 1 (Level 2) / 2 (Level 3) or -1 if no verb found.
// Stem-aware: tries both raw word and normalized base form.
// Scans L1 → L2 → L3 so shared verbs resolve to their LOWEST level.
function getVerbLevel(sentence = '', verbOrder: string[][]): number {
  if (!sentence) return -1
  const lower = sentence.toLowerCase()

  // Multi-word phrases override single-word extraction
  if (MULTI_WORD_L3.some(phrase => lower.includes(phrase))) return 2

  // Strip preamble patterns teachers sometimes prepend
  const cleaned = lower
    .replace(/^by the end of (this )?lesson[,\s]+/i, '')
    .replace(/^learners? (will )?(be able to )?/i, '')
    .trim()

  const words = cleaned.replace(/[^a-z\s]/g, '').split(/\s+/)

  for (let level = 0; level < verbOrder.length; level++) {
    const pool = new Set(verbOrder[level])
    for (const w of words.slice(0, 4)) {  // check first 4 words
      if (!w || w.length < 2) continue
      // Exact match
      if (pool.has(w)) return level
      // Stem match via VERB_STEMS table
      const stemmed = normalizeVerb(w)
      if (pool.has(stemmed)) return level
      // Partial stem: try stripping common endings
      if (w.endsWith('ing') && pool.has(w.slice(0, -3))) return level
      if (w.endsWith('ed')  && pool.has(w.slice(0, -2))) return level
      if (w.endsWith('es')  && pool.has(w.slice(0, -1))) return level
      if (w.endsWith('s')   && pool.has(w.slice(0, -1))) return level
    }
  }
  return -1
}

// ================= VALIDATORS =================
function validateLearningOutcomes(
  outcomes: string[] = [],
  verbOrder: string[][],
  subjectType = 'default',
): { valid: boolean; reason?: string } {
  if (!Array.isArray(outcomes) || outcomes.length < 3) {
    return { valid: false, reason: 'At least 3 learning outcomes required' }
  }

  // Use merged verb order (subject-specific + universal pools)
  const mergedOrder = getMergedVerbOrder(subjectType)
  const verbLevels = outcomes.map(o => getVerbLevel(o, mergedOrder))

  // Score-based tolerance: if an outcome has a high curriculum quality score
  // but failed verb detection, give it a pass on level classification.
  const resolvedLevels = verbLevels.map((lvl, i) => {
    if (lvl !== -1) return lvl
    const score = scoreOutcome(outcomes[i])
    // High-quality outcome (score ≥ 7) that our stemmer missed — don't fail it
    if (score >= 7) return i === 0 ? 0 : i === 1 ? 1 : 2  // assign level by position
    return -1
  })

  if (resolvedLevels.includes(-1)) {
    return { valid: false, reason: 'One or more outcomes use unrecognized verbs' }
  }

  // TSC requirement: outcomes must progress from lower to higher cognitive order.
  // Allow same-level outcomes (flat is OK, regression is not).
  for (let i = 1; i < resolvedLevels.length; i++) {
    if (resolvedLevels[i] < resolvedLevels[i - 1]) {
      return {
        valid: false,
        reason: 'Learning outcomes must progress from lower to higher cognitive order',
      }
    }
  }

  return { valid: true }
}

function validateLearningExperiences(experiences: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(experiences) || experiences.length === 0) {
    return { valid: false, reason: 'Learning experiences missing' }
  }

  const learnerKeywords = [
    'learner', 'student', 'group', 'discuss', 'perform', 'participate', 'work',
  ]

  const combined = experiences.join(' ').toLowerCase()

  if (!learnerKeywords.some(k => combined.includes(k))) {
    return { valid: false, reason: 'Learning experiences must be learner-centered' }
  }

  return { valid: true }
}

function validateInquiryQuestions(questions: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { valid: false, reason: 'Inquiry questions missing' }
  }

  const combined = questions.join(' ').toLowerCase()

  if (!combined.includes('?')) {
    return { valid: false, reason: 'Inquiry questions must be in question form' }
  }

  const higherOrderStarters = ['how', 'why', 'in what ways', 'to what extent']

  if (!higherOrderStarters.some(q => combined.includes(q))) {
    return { valid: false, reason: 'Inquiry questions lack higher-order thinking' }
  }

  return { valid: true }
}

function validateAssessmentMethods(methods: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(methods) || methods.length === 0) {
    return { valid: false, reason: 'Assessment methods missing' }
  }

  // 'test' alone is valid (written test = CBC formative); only full summative phrases forbidden
  const forbidden = [
    'end of term exam',
    'final examination',
    'kcse exam',
    'marks out of',
    'grade out of',
    'summative exam',
    'terminal exam',
  ]

  const combined = methods.join(' ').toLowerCase()

  if (forbidden.some(phrase => combined.includes(phrase))) {
    return { valid: false, reason: 'Summative assessment not allowed in lesson SOW' }
  }

  return { valid: true }
}

function validateLearningResources(resources: string[] = []): { valid: boolean; reason?: string } {
  if (!Array.isArray(resources) || resources.length === 0) {
    return { valid: false, reason: 'Learning resources missing' }
  }

  const forbidden = ['hologram', 'vr lab', 'ai lab']

  const combined = resources.join(' ').toLowerCase()

  if (forbidden.some(word => combined.includes(word))) {
    return { valid: false, reason: 'Unrealistic learning resources detected' }
  }

  return { valid: true }
}

// Prevent hallucination drift
function validateSubstrandAlignment(
  lesson: Record<string, any>,
  substrandTitle = ''
): { valid: boolean; reason?: string } {
  if (!substrandTitle ||
      substrandTitle === 'ai-generated' ||
      substrandTitle.includes('Full Syllabus')) {
    return { valid: true }
  }

  const combined = [
    ...(lesson.learning_outcomes || []),
    ...(lesson.learning_experiences || []),
    ...(lesson.key_inquiry_questions || []),
  ].join(' ').toLowerCase()

  const stopWords = new Set([
    'and', 'or', 'the', 'of', 'in', 'a', 'an', 'to', 'for',
    'with', 'on', 'at', 'from', 'by', 'its', 'their', 'use',
    'using', 'used', 'through', 'skills', 'ability', 'main',
  ])

  // Extract words from the substrand title itself
  const titleWords = substrandTitle
    .toLowerCase()
    .split(/[\s\-:,\/()]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))

  // Also flatten any " - " separated parts (e.g. "Reading - Fluency - Scanning and Skimming")
  const partWords = substrandTitle
    .split(' - ')
    .join(' ')
    .toLowerCase()
    .split(/[\s\-:,\/()]+/)
    .filter(w => w.length >= 3 && !stopWords.has(w))

  const keywords = [...new Set([...titleWords, ...partWords])]

  if (keywords.length === 0) return { valid: true }

  const expandedKeywords: string[] = []
  for (const kw of keywords) {
    expandedKeywords.push(kw)
    for (const [skill, synonyms] of Object.entries(SKILL_SYNONYMS)) {
      if (skill.includes(kw) || kw.includes(skill)) {
        expandedKeywords.push(...synonyms)
      }
    }
  }

  const anyMatch = expandedKeywords.some(kw => combined.includes(kw.toLowerCase()))

  if (!anyMatch) {
    return { valid: false, reason: 'Lesson content not aligned to substrand focus' }
  }

  return { valid: true }
}

// ================= MAIN EXPORT =================
export function validateLesson(
  lesson: Record<string, any>,
  substrandTitle = '',
  subjectType = 'default'
): { isValid: boolean; issues: string[] } {
  const verbOrder = VERB_ORDERS[subjectType] ?? VERB_ORDERS.default
  const checks = [
    validateLearningOutcomes(lesson.learning_outcomes, verbOrder, subjectType),
    validateLearningExperiences(lesson.learning_experiences),
    validateInquiryQuestions(lesson.key_inquiry_questions),
    validateAssessmentMethods(lesson.assessment_methods),
    validateLearningResources(lesson.learning_resources),
    validateSubstrandAlignment(lesson, substrandTitle),
  ]

  const failed = checks.filter(c => !c.valid)

  return {
    isValid: failed.length === 0,
    issues: failed.map(f => f.reason || 'Unknown validation error'),
  }
}
