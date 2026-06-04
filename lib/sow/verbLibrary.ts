// lib/sow/verbLibrary.ts
// Curriculum-grade verb library for CBC, KCSE, and IGCSE schemes of work.
// Provides massively expanded verb pools, subject-specific extensions,
// stem normalization, and quality scoring.

// ─── Universal Verb Pools ─────────────────────────────────────────────────────

export const UNIVERSAL_L1: string[] = [
  // Core knowledge / recall verbs
  'identify', 'state', 'define', 'list', 'name', 'label', 'locate',
  'recognize', 'recall', 'observe', 'record', 'classify', 'collect',
  'count', 'draw', 'find', 'indicate', 'mention', 'mark', 'note',
  'read', 'select', 'trace', 'tabulate', 'write', 'match', 'sort',
  'describe', 'outline', 'show', 'give', 'tell', 'copy',
  // Extended recall
  'annotate', 'arrange', 'cite', 'compile', 'complete',
  'detect', 'diagram', 'discover', 'distinguish', 'enumerate',
  'examine', 'group', 'highlight', 'illustrate', 'include',
  'inspect', 'map', 'measure', 'memorize', 'order',
  'point out', 'quote', 'repeat', 'replicate', 'reproduce',
  'retell', 'review', 'sketch', 'specify', 'underline',
  'check', 'circle', 'fill', 'pick', 'place',
  'scan', 'signal', 'spot', 'tick', 'transcribe',
  // Discipline-agnostic additions
  'assemble', 'capture', 'chart', 'gather', 'index',
  'itemize', 'log', 'number', 'pin', 'position',
  'present', 'recite', 'register', 'report', 'sample',
  'sequence', 'tag', 'title', 'track', 'verify basic',
]

export const UNIVERSAL_L2: string[] = [
  // Core understanding / application verbs
  'explain', 'discuss', 'analyze', 'compare', 'contrast',
  'differentiate', 'interpret', 'summarize', 'calculate', 'solve',
  'apply', 'determine', 'investigate', 'formulate', 'construct',
  'develop', 'demonstrate', 'predict', 'justify', 'estimate',
  'infer', 'deduce', 'organize', 'experiment', 'verify',
  'manipulate', 'convert', 'perform', 'examine', 'explore',
  'model', 'test', 'measure', 'research', 'describe',
  // Extended application
  'adapt', 'adjust', 'assess data', 'break down', 'bridge',
  'categorize', 'clarify', 'classify data', 'compile data', 'connect',
  'contextualize', 'correlate', 'critique data', 'decode', 'derive',
  'design experiment', 'determine causes', 'diagnose', 'differentiate causes',
  'document', 'draft', 'elaborate', 'employ', 'evaluate data',
  'execute', 'extend', 'extract', 'generalize', 'generate hypotheses',
  'handle', 'hypothesize', 'illustrate process', 'implement plan',
  'incorporate', 'integrate data', 'interpret data', 'investigate causes',
  'justify approach', 'link', 'make connections', 'modify', 'narrate',
  'navigate', 'negotiate', 'observe patterns', 'operationalize',
  'outline process', 'pair', 'paraphrase', 'plan', 'plot',
  'prepare', 'probe', 'process', 'question', 'reason',
  'reconstruct', 'relate', 'represent', 'restate', 'restructure',
  'rewrite', 'select method', 'sequence events', 'simulate',
  'sketch process', 'solve problems', 'sort data', 'structure',
  'substitute', 'suggest', 'survey', 'tabulate data', 'trace causes',
  'transform', 'translate', 'troubleshoot', 'unpack', 'use evidence',
  'validate method', 'vary', 'work out',
]

export const UNIVERSAL_L3: string[] = [
  // Core values / creation / evaluation verbs
  'appreciate', 'value', 'advocate', 'evaluate', 'design',
  'create', 'synthesize', 'produce', 'propose', 'reflect',
  'review', 'critique', 'improve', 'innovate', 'invent',
  'recommend', 'support', 'organize', 'implement', 'coordinate',
  'mentor', 'guide', 'promote', 'influence', 'lead',
  'collaborate', 'revise', 'enhance', 'defend', 'generate',
  'justify approach', 'develop', 'integrate knowledge', 'plan',
  // Extended creation / evaluation
  'acknowledge', 'adapt approach', 'affirm', 'argue',
  'articulate', 'assemble solution', 'assess impact', 'build upon',
  'campaign', 'champion', 'change', 'choose approach',
  'combine', 'commit', 'communicate findings', 'compose',
  'construct solution', 'contribute', 'convince', 'debate',
  'decide', 'dedicate', 'demonstrate value', 'derive value',
  'determine impact', 'develop awareness', 'develop confidence',
  'develop interest', 'differentiate worth', 'disagree constructively',
  'display', 'distinguish merit', 'edit', 'empower',
  'engage', 'establish', 'estimate worth', 'exhibit',
  'express opinion', 'formulate position', 'frame', 'generalize',
  'honor', 'hypothesize solutions', 'implement solution', 'initiate',
  'inspect critically', 'internalize', 'judge', 'justify position',
  'manage', 'model behavior', 'modify approach', 'motivate',
  'negotiate solutions', 'observe critically', 'organize project',
  'originate', 'perform critically', 'persuade', 'plan project',
  'practice', 'preserve', 'prioritize', 'problem-solve creatively',
  'profess', 'project', 'protect', 'rank', 'reason critically',
  'recognize importance', 'recognize value', 'reconstruct argument',
  'refine', 'reform', 'reject', 'relate critically',
  'represent solution', 'research critically', 'resolve',
  'restructure thinking', 'rethink', 'select best', 'show initiative',
  'stand for', 'strive', 'sustain', 'take a position',
  'think critically', 'transform', 'uphold', 'validate',
  'verify solution', 'weigh', 'write critically',
]

// ─── Subject-Specific Extensions ─────────────────────────────────────────────
// Each entry adds discipline-specific verbs that supplement the universal pools.

export type SubjectExtension = [string[], string[], string[]]

export const SUBJECT_EXTENSIONS: Record<string, SubjectExtension> = {

  mathematics: [
    [
      'count', 'compute basic', 'copy figure', 'draw figure',
      'find value', 'give answer', 'label axis', 'list steps',
      'mark point', 'order numbers', 'read graph', 'round',
      'show working', 'sort numbers', 'substitute', 'tabulate',
      'trace curve', 'write equation',
    ],
    [
      'add', 'calculate', 'compute', 'construct', 'convert',
      'deduce', 'derive', 'divide', 'estimate', 'expand',
      'factorize', 'formulate', 'graph', 'integrate', 'justify',
      'measure', 'multiply', 'plot', 'prove', 'simplify',
      'sketch graph', 'solve equation', 'subtract', 'transform',
      'verify solution', 'visualize',
    ],
    [
      'advocate for precision', 'appreciate pattern', 'create model',
      'design solution', 'generalize formula', 'model situation',
      'propose method', 'reflect on approach', 'represent mathematically',
      'synthesize', 'validate answer', 'value accuracy',
    ],
  ],

  biology: [
    [
      'classify organism', 'collect specimen', 'detect change',
      'draw diagram', 'examine slide', 'identify structure',
      'label diagram', 'locate organ', 'name species',
      'note characteristic', 'observe specimen', 'record reading',
      'sort organisms', 'trace pathway',
    ],
    [
      'analyze results', 'calculate rate', 'compare organisms',
      'conclude experiment', 'design experiment', 'determine factor',
      'differentiate structures', 'estimate population', 'examine tissue',
      'experiment', 'explain process', 'formulate hypothesis',
      'hypothesize', 'illustrate cycle', 'infer relationship',
      'interpret data', 'investigate', 'justify conclusion',
      'measure growth', 'model system', 'predict outcome',
      'relate structure to function', 'research', 'simulate',
      'solve biological problem', 'summarize findings', 'test hypothesis',
      'verify result',
    ],
    [
      'acknowledge interdependence', 'advocate for conservation',
      'appreciate biodiversity', 'commit to sustainability',
      'defend environmental position', 'develop responsibility',
      'evaluate impact', 'generalize principle', 'implement conservation',
      'integrate knowledge', 'organize campaign', 'protect environment',
      'propose solution', 'reflect on ethics', 'support conservation',
      'synthesize understanding', 'validate experiment', 'value life',
    ],
  ],

  chemistry: [
    [
      'classify compound', 'collect sample', 'define element',
      'describe reaction', 'draw structure', 'give formula',
      'identify substance', 'label apparatus', 'list property',
      'locate element', 'name compound', 'note observation',
      'observe reaction', 'outline procedure', 'read scale',
      'recall formula', 'recognize hazard', 'record observation',
      'select reagent', 'state property', 'write equation',
    ],
    [
      'analyze composition', 'apply stoichiometry', 'balance equation',
      'calculate concentration', 'compare reactivity', 'conclude from data',
      'construct apparatus', 'contrast properties', 'deduce structure',
      'demonstrate reaction', 'design experiment', 'determine empirical',
      'differentiate compounds', 'estimate yield', 'examine evidence',
      'experiment', 'explain mechanism', 'formulate solution',
      'hypothesize', 'infer bonding', 'interpret spectrum',
      'investigate rate', 'justify safety', 'measure pH',
      'model molecule', 'predict product', 'prepare solution',
      'prove purity', 'relate structure to property', 'research',
      'solve calculation', 'summarize', 'test hypothesis', 'verify',
    ],
    [
      'acknowledge chemical responsibility', 'advocate green chemistry',
      'appreciate industrial application', 'communicate findings',
      'create awareness', 'critique chemical use', 'defend safety',
      'develop green awareness', 'evaluate chemical impact',
      'generalize reaction pattern', 'implement safe practice',
      'integrate chemistry knowledge', 'organize lab', 'produce report',
      'promote environmental chemistry', 'propose safe disposal',
      'protect against hazards', 'reflect on chemical ethics',
      'support green industry', 'synthesize knowledge',
      'validate experiment', 'value precision', 'write report',
    ],
  ],

  physics: [
    [
      'classify device', 'define quantity', 'describe phenomenon',
      'draw ray diagram', 'find reading', 'identify component',
      'label circuit', 'list force', 'locate position',
      'match symbol', 'measure length', 'name unit',
      'note observation', 'observe demonstration', 'outline law',
      'read instrument', 'recall law', 'recognize pattern',
      'record data', 'select equipment', 'show method',
      'sketch diagram', 'state law', 'trace ray', 'write formula',
    ],
    [
      'analyze motion', 'apply law', 'calculate force',
      'compare properties', 'conclude experiment', 'construct circuit',
      'contrast behavior', 'deduce formula', 'demonstrate principle',
      'design experiment', 'determine quantity', 'differentiate types',
      'estimate value', 'examine evidence', 'experiment',
      'explain phenomenon', 'formulate equation', 'hypothesize',
      'illustrate wave', 'infer conclusion', 'interpret data',
      'investigate relationship', 'justify answer', 'model system',
      'predict behavior', 'prove relationship', 'relate concept',
      'research', 'simulate', 'sketch graph', 'solve problem',
      'summarize', 'test prediction', 'trace electron', 'verify',
    ],
    [
      'acknowledge physics in nature', 'advocate for safety',
      'appreciate elegance of laws', 'apply physics to technology',
      'communicate discoveries', 'create device', 'critique application',
      'defend scientific position', 'design solution', 'evaluate technology',
      'generalize principle', 'implement technology', 'innovate',
      'integrate knowledge', 'model behavior', 'produce report',
      'promote safety', 'propose improvement', 'protect environment',
      'reflect on technology', 'represent relationship',
      'support renewable energy', 'synthesize', 'validate',
      'value precision', 'write technical report',
    ],
  ],

  geography: [
    [
      'annotate map', 'classify landform', 'define term',
      'describe feature', 'detect change', 'draw map',
      'find location', 'give example', 'identify region',
      'inspect aerial photo', 'label map', 'list factor',
      'locate place', 'map feature', 'match symbol',
      'name feature', 'note pattern', 'observe landscape',
      'outline process', 'read map', 'recall fact',
      'recognize landform', 'record data', 'select key',
      'show direction', 'sketch map', 'state fact', 'write',
    ],
    [
      'analyze distribution', 'apply skill', 'calculate distance',
      'classify climate', 'compare regions', 'construct graph',
      'contrast environments', 'deduce cause', 'demonstrate',
      'describe process', 'determine pattern', 'differentiate',
      'discuss impact', 'estimate population', 'examine evidence',
      'explain formation', 'explore relationship', 'formulate',
      'illustrate cycle', 'infer cause', 'interpret map',
      'investigate', 'justify', 'measure distance', 'model',
      'predict change', 'relate cause and effect', 'research',
      'sequence events', 'simulate', 'solve field problem',
      'summarize findings', 'survey area', 'trace route', 'verify',
    ],
    [
      'acknowledge interdependence', 'advocate for sustainability',
      'appreciate diversity', 'champion conservation', 'commit',
      'communicate findings', 'create awareness', 'critique development',
      'defend position', 'develop appreciation', 'evaluate policy',
      'generate solutions', 'guide community', 'implement plan',
      'integrate knowledge', 'judge impact', 'lead initiative',
      'organize community', 'plan project', 'promote sustainable use',
      'propose policy', 'protect resources', 'reflect on citizenship',
      'support conservation', 'sustain environment', 'synthesize',
      'uphold rights', 'validate approach', 'value environment',
    ],
  ],

  history: [
    [
      'cite source', 'define term', 'describe event',
      'give date', 'give example', 'identify period',
      'label timeline', 'list cause', 'locate event',
      'match event to date', 'name leader', 'note fact',
      'outline sequence', 'quote source', 'read source',
      'recall event', 'recognize period', 'record fact',
      'retell story', 'select evidence', 'show sequence',
      'state fact', 'trace development', 'write account',
    ],
    [
      'analyze cause', 'compare period', 'connect events',
      'contextualize event', 'contrast leader', 'deduce motive',
      'describe impact', 'differentiate perspective', 'discuss significance',
      'examine evidence', 'explain change', 'explore consequence',
      'formulate argument', 'identify bias', 'illustrate trend',
      'infer meaning', 'interpret source', 'investigate', 'justify claim',
      'narrate sequence', 'predict consequence', 'relate to present',
      'research', 'review source', 'sequence events',
      'summarize', 'trace impact',
    ],
    [
      'acknowledge legacy', 'advocate justice', 'appreciate heritage',
      'assess significance', 'champion rights', 'collaborate',
      'communicate historical understanding', 'compose narrative',
      'create timeline', 'critique source', 'defend position',
      'develop historical consciousness', 'evaluate impact',
      'generate historical argument', 'honor heritage',
      'integrate understanding', 'judge significance', 'lead discussion',
      'organize historical project', 'preserve heritage', 'produce essay',
      'promote rights', 'propose solution', 'protect heritage',
      'reflect on lessons', 'support justice', 'synthesize',
      'uphold heritage', 'validate argument', 'value history',
    ],
  ],

  english: [
    [
      'copy extract', 'define word', 'fill blank', 'find word',
      'give example', 'identify feature', 'label part', 'listen',
      'list word', 'locate phrase', 'match word', 'name device',
      'outline text', 'quote passage', 'read aloud', 'recall rule',
      'recognize device', 'record word', 'repeat phrase',
      'select word', 'show example', 'spell word', 'state rule',
      'underline phrase', 'write sentence',
    ],
    [
      'analyze text', 'arrange paragraph', 'classify text type',
      'compare texts', 'compose paragraph', 'construct argument',
      'contrast styles', 'decode message', 'describe character',
      'differentiate register', 'discuss theme', 'draft essay',
      'edit writing', 'examine structure', 'explain technique',
      'express opinion', 'extract information', 'formulate argument',
      'identify bias', 'illustrate technique', 'infer meaning',
      'interpret tone', 'narrate', 'paraphrase passage',
      'predict outcome', 'present argument', 'rewrite passage',
      'sequence events', 'summarize text', 'translate idiom',
    ],
    [
      'acknowledge perspective', 'advocate position', 'appreciate literature',
      'assess writer\'s craft', 'collaborate on project', 'communicate',
      'compose creative work', 'create', 'critique style',
      'design communication', 'develop argument', 'evaluate effectiveness',
      'generate ideas', 'guide discussion', 'inspire audience',
      'justify interpretation', 'mentor peer', 'organize argument',
      'perform reading', 'produce publication', 'promote literacy',
      'propose interpretation', 'publish work', 'reflect on language',
      'revise writing', 'support position', 'synthesize theme',
      'validate interpretation', 'value literature', 'write creatively',
    ],
  ],

  kiswahili: [
    [
      'andika', 'eleza kimsingi', 'fahamia', 'identify', 'label',
      'list', 'locate', 'match', 'name',
      'outline', 'read', 'recall', 'recognize',
      'record', 'repeat', 'select', 'show',
      'soma', 'state', 'taja', 'write',
      'nunua', 'orodhesha', 'angalia', 'jaza',
    ],
    [
      'analyze', 'compare', 'compose paragraph',
      'construct sentence', 'contrast', 'describe',
      'differentiate register', 'discuss theme', 'draft',
      'edit', 'examine', 'explain grammar',
      'express', 'extract', 'formulate',
      'illustrate', 'infer', 'interpret',
      'narrate story', 'paraphrase', 'predict',
      'rewrite', 'sequence', 'summarize',
      'translate', 'tunga sentensi',
    ],
    [
      'acknowledge', 'advocate', 'appreciate',
      'assess', 'collaborate', 'communicate',
      'create', 'critique', 'develop',
      'generate', 'honor heritage', 'organize',
      'perform', 'plan', 'produce',
      'promote Kiswahili', 'propose', 'publish',
      'reflect', 'revise', 'support',
      'synthesize', 'value heritage', 'write creatively',
    ],
  ],

  business: [
    [
      'cite regulation', 'define term', 'describe process',
      'give example', 'identify stakeholder', 'label diagram',
      'list advantage', 'locate office', 'match document',
      'name organization', 'note regulation', 'outline procedure',
      'read document', 'recall definition', 'recognize document',
      'record transaction', 'select method', 'show procedure',
      'state law', 'write letter',
    ],
    [
      'analyze market', 'apply principle', 'calculate profit',
      'classify business', 'compare systems', 'construct budget',
      'contrast methods', 'demonstrate', 'differentiate sectors',
      'discuss impact', 'estimate cost', 'examine document',
      'explain transaction', 'formulate strategy', 'illustrate process',
      'interpret financial statement', 'investigate', 'justify decision',
      'plan budget', 'predict trend', 'relate cause and effect',
      'research market', 'review account', 'solve business problem',
      'summarize', 'prepare document',
    ],
    [
      'advocate ethical practice', 'appreciate enterprise',
      'assess risk', 'collaborate in team', 'commit to ethics',
      'communicate professionally', 'create business plan',
      'critique policy', 'design strategy', 'develop enterprise',
      'evaluate business performance', 'generate ideas',
      'implement strategy', 'integrate knowledge', 'lead team',
      'manage resources', 'organize business', 'plan venture',
      'present business case', 'produce report', 'promote ethics',
      'propose strategy', 'reflect on practice', 'support enterprise',
      'synthesize knowledge', 'validate decision', 'value integrity',
    ],
  ],

  computer_studies: [
    [
      'define term', 'describe component', 'draw diagram',
      'find file', 'give command', 'identify hardware',
      'label diagram', 'list step', 'locate file',
      'match component', 'name device', 'outline algorithm',
      'read output', 'recall term', 'recognize interface',
      'record data', 'select option', 'show output',
      'state function', 'trace program', 'write code',
    ],
    [
      'analyze algorithm', 'apply formula', 'calculate output',
      'classify software', 'code solution', 'compile program',
      'compare systems', 'construct algorithm', 'convert format',
      'debug program', 'demonstrate', 'design database',
      'determine logic', 'differentiate systems', 'discuss security',
      'estimate complexity', 'examine code', 'explain network',
      'formulate query', 'illustrate process', 'implement solution',
      'interpret output', 'investigate bug', 'justify design',
      'model system', 'plan database', 'predict output',
      'program solution', 'simulate', 'solve coding problem',
      'summarize', 'test program', 'verify output',
    ],
    [
      'acknowledge digital rights', 'advocate data privacy',
      'appreciate innovation', 'assess security risk',
      'collaborate on project', 'communicate technically',
      'create application', 'critique system', 'design solution',
      'develop software', 'evaluate system', 'generate algorithm',
      'implement security', 'innovate', 'integrate system',
      'lead project', 'organize database', 'plan network',
      'present solution', 'produce application', 'promote digital safety',
      'propose upgrade', 'protect data', 'reflect on ethics',
      'support community with technology', 'synthesize',
      'validate program', 'value digital citizenship',
    ],
  ],

  agriculture: [
    [
      'classify crop', 'collect sample', 'describe soil',
      'detect pest', 'draw farm layout', 'give example',
      'identify crop', 'inspect plant', 'label diagram',
      'list practice', 'locate field', 'match tool',
      'name variety', 'note symptom', 'observe growth',
      'outline method', 'read scale', 'recall technique',
      'recognize pest', 'record yield', 'select seed',
      'show technique', 'sort seed', 'state method',
      'trace growth', 'write record',
    ],
    [
      'analyze soil', 'apply fertilizer', 'calculate yield',
      'classify soil', 'compare variety', 'construct compost',
      'contrast method', 'demonstrate technique', 'design farm',
      'determine quality', 'differentiate pest', 'discuss practice',
      'estimate cost', 'examine plant', 'experiment',
      'explain process', 'formulate plan', 'grow crop',
      'hypothesize', 'investigate', 'justify practice',
      'measure growth', 'model farm', 'plant seed',
      'predict yield', 'prepare land', 'relate to market',
      'research variety', 'solve farm problem', 'summarize',
      'test soil', 'verify result',
    ],
    [
      'acknowledge food security', 'advocate sustainable farming',
      'appreciate nature', 'commit to sustainable agriculture',
      'communicate findings', 'create awareness', 'critique practice',
      'defend farming', 'develop agribusiness', 'evaluate impact',
      'generate income', 'implement sustainable practice',
      'innovate in farming', 'integrate knowledge', 'lead cooperative',
      'manage farm', 'organize farming project', 'plan agribusiness',
      'produce food', 'promote food security', 'propose solution',
      'protect soil', 'reflect on practice', 'support farmers',
      'sustain environment', 'synthesize knowledge',
      'uphold farmers\' rights', 'validate practice', 'value farming',
    ],
  ],

  home_science: [
    [
      'classify food', 'collect material', 'define term',
      'describe method', 'draw diagram', 'give example',
      'identify nutrient', 'inspect garment', 'label garment',
      'list ingredient', 'locate kitchen tool', 'match material',
      'name nutrient', 'note change', 'observe process',
      'outline method', 'read recipe', 'recall technique',
      'recognize texture', 'record measurement', 'select material',
      'show technique', 'sort garment', 'state property', 'write recipe',
    ],
    [
      'analyze nutrition', 'apply technique', 'calculate cost',
      'classify fabric', 'compare method', 'construct garment',
      'contrast diet', 'demonstrate', 'design garment',
      'determine nutrient', 'differentiate fabric', 'discuss health',
      'estimate cost', 'examine garment', 'explain process',
      'formulate menu', 'illustrate', 'investigate',
      'justify choice', 'measure ingredient', 'model',
      'plan menu', 'predict outcome', 'prepare meal',
      'relate nutrition to health', 'research', 'solve problem',
      'summarize', 'test recipe',
    ],
    [
      'acknowledge health importance', 'advocate healthy living',
      'appreciate culture of food', 'assess nutritional value',
      'collaborate', 'commit to hygiene', 'communicate',
      'create meal plan', 'critique recipe', 'design menu',
      'develop health habits', 'evaluate diet', 'generate menu',
      'implement healthy practice', 'integrate knowledge',
      'manage household', 'organize project', 'plan budget',
      'produce garment', 'promote health', 'propose improvement',
      'protect family health', 'reflect on practice',
      'support household', 'sustain healthy habits',
      'synthesize knowledge', 'validate choice', 'value nutrition',
    ],
  ],

  cre_ire: [
    [
      'cite scripture', 'define term', 'describe event',
      'give example', 'identify teaching', 'label event',
      'list commandment', 'locate scripture', 'match verse',
      'name prophet', 'note teaching', 'outline story',
      'read scripture', 'recall teaching', 'recognize symbol',
      'record teaching', 'retell story', 'select verse',
      'show example', 'state teaching', 'write verse',
    ],
    [
      'analyze teaching', 'apply principle', 'classify belief',
      'compare religion', 'connect to life', 'contrast teaching',
      'deduce meaning', 'describe impact', 'differentiate belief',
      'discuss implication', 'distinguish teaching', 'examine text',
      'explain significance', 'express belief', 'formulate response',
      'illustrate moral', 'infer meaning', 'interpret scripture',
      'investigate practice', 'justify moral stand', 'narrate story',
      'predict consequence', 'relate to community', 'research',
      'review teaching', 'sequence event', 'summarize teaching',
    ],
    [
      'acknowledge God', 'advocate peace', 'appreciate creation',
      'assess moral stand', 'champion justice', 'commit to faith',
      'communicate belief', 'compose prayer', 'create awareness',
      'critique moral issue', 'defend faith', 'develop spiritual life',
      'evaluate moral decision', 'honor God', 'internalize teaching',
      'judge moral issue', 'lead worship', 'organize community service',
      'perform worship', 'practice virtue', 'promote peace',
      'propose moral solution', 'protect dignity', 'reflect spiritually',
      'support community', 'synthesize faith and life',
      'uphold moral principle', 'validate moral stand', 'value creation',
    ],
  ],

  art_design: [
    [
      'copy design', 'describe color', 'detect pattern',
      'draw sketch', 'give name', 'identify element',
      'inspect artwork', 'label design', 'list principle',
      'locate form', 'match color', 'name artist',
      'note technique', 'observe texture', 'outline form',
      'read artwork', 'recall technique', 'recognize style',
      'record observation', 'select material', 'show technique',
      'sketch form', 'sort element', 'trace outline', 'write description',
    ],
    [
      'analyze composition', 'apply technique', 'compare style',
      'compose design', 'construct artwork', 'contrast element',
      'demonstrate', 'describe technique', 'design layout',
      'differentiate style', 'discuss influence', 'examine artwork',
      'experiment with medium', 'explain technique', 'explore style',
      'formulate design', 'illustrate concept', 'interpret artwork',
      'investigate artist', 'justify choice', 'manipulate material',
      'model form', 'organize composition', 'produce artwork',
      'relate to culture', 'research', 'sketch concept',
      'summarize', 'test technique',
    ],
    [
      'appreciate artistic heritage', 'advocate for arts',
      'create original work', 'critique artwork',
      'design for purpose', 'develop aesthetic sense',
      'evaluate artistic merit', 'express creatively',
      'generate original idea', 'honor artistic heritage',
      'implement design', 'innovate in art', 'inspire audience',
      'integrate art and life', 'lead creative project',
      'perform artistically', 'produce portfolio', 'promote arts',
      'propose artistic solution', 'protect artistic heritage',
      'reflect on creativity', 'support artistic community',
      'synthesize artistic knowledge', 'value artistic expression',
    ],
  ],

  music: [
    [
      'clap rhythm', 'describe pitch', 'draw staff',
      'give note name', 'hum melody', 'identify note',
      'label staff', 'listen to piece', 'list instrument',
      'locate note', 'match pitch', 'name composer',
      'note tempo', 'outline form', 'read score',
      'recall rhythm', 'recognize instrument', 'record rhythm',
      'select tempo', 'show technique', 'sing melody',
      'state dynamics', 'write note',
    ],
    [
      'analyze melody', 'apply technique', 'arrange piece',
      'compare style', 'compose rhythm', 'conduct ensemble',
      'contrast genre', 'demonstrate technique', 'describe harmony',
      'differentiate style', 'discuss influence', 'examine score',
      'explain technique', 'explore genre', 'formulate arrangement',
      'illustrate form', 'interpret piece', 'investigate',
      'justify choice', 'model technique', 'perform piece',
      'predict resolution', 'relate to culture', 'research',
      'sequence phrase', 'summarize', 'test arrangement',
    ],
    [
      'appreciate musical heritage', 'advocate for music',
      'collaborate in ensemble', 'compose original', 'create composition',
      'critique performance', 'design performance', 'develop musicianship',
      'evaluate performance', 'generate original melody',
      'honor musical heritage', 'innovate musically',
      'inspire audience', 'integrate music into life', 'lead ensemble',
      'perform expressively', 'produce musical work', 'promote music',
      'propose interpretation', 'protect musical heritage',
      'reflect on musicianship', 'support musical community',
      'synthesize musical knowledge', 'value music',
    ],
  ],

  social_studies: [
    [
      'define term', 'describe community', 'give example',
      'identify right', 'label map', 'list responsibility',
      'locate country', 'match event', 'name leader',
      'note fact', 'outline process', 'read map',
      'recall fact', 'recognize symbol', 'record event',
      'retell story', 'select example', 'show location',
      'state right', 'trace boundary', 'write account',
    ],
    [
      'analyze issue', 'apply principle', 'compare government',
      'connect events', 'contrast culture', 'describe impact',
      'differentiate right', 'discuss issue', 'examine evidence',
      'explain law', 'explore culture', 'formulate argument',
      'investigate', 'justify stand', 'narrate event',
      'predict consequence', 'relate event to present', 'research',
      'review event', 'sequence event', 'summarize',
    ],
    [
      'acknowledge diversity', 'advocate for rights', 'appreciate culture',
      'assess civic responsibility', 'champion justice', 'collaborate',
      'commit to citizenship', 'communicate', 'create awareness',
      'critique policy', 'defend rights', 'develop civic sense',
      'evaluate policy', 'generate solutions', 'guide community',
      'honor diversity', 'integrate citizenship', 'lead community',
      'organize civic project', 'promote unity', 'propose policy',
      'protect rights', 'reflect on citizenship', 'support community',
      'synthesize civic knowledge', 'uphold rights', 'value diversity',
    ],
  ],

  pre_technical: [
    [
      'classify material', 'describe property', 'draw diagram',
      'give name', 'identify tool', 'inspect material',
      'label diagram', 'list property', 'locate part',
      'match tool', 'name material', 'note measurement',
      'observe process', 'outline method', 'read measurement',
      'recall safety rule', 'recognize material', 'record measurement',
      'select tool', 'show technique', 'sketch design',
      'sort material', 'state rule', 'trace design', 'write plan',
    ],
    [
      'analyze design', 'apply technique', 'calculate measurement',
      'classify joint', 'compare material', 'construct project',
      'contrast property', 'demonstrate', 'design project',
      'determine strength', 'differentiate joint', 'discuss application',
      'estimate cost', 'examine product', 'explain process',
      'formulate design', 'improve design', 'investigate',
      'justify choice', 'measure', 'model design',
      'plan project', 'predict failure', 'prepare material',
      'research material', 'solve design problem',
      'summarize', 'test design', 'verify strength',
    ],
    [
      'advocate for safety', 'appreciate craftsmanship',
      'assess quality', 'commit to safety', 'create product',
      'critique design', 'design solution', 'develop skills',
      'evaluate product', 'generate design', 'implement safety',
      'innovate in design', 'integrate knowledge', 'lead project',
      'organize workshop', 'plan production', 'produce artefact',
      'promote safety', 'propose improvement', 'protect environment',
      'reflect on practice', 'support enterprise', 'synthesize',
      'validate design', 'value craftsmanship',
    ],
  ],

  integrated_science: [
    [
      'classify living thing', 'collect sample', 'define term',
      'describe change', 'detect change', 'draw diagram',
      'examine specimen', 'find example', 'give name',
      'identify material', 'inspect specimen', 'label diagram',
      'list property', 'locate organ', 'match property',
      'measure', 'name organism', 'note observation',
      'observe phenomenon', 'outline process', 'read scale',
      'recall fact', 'recognize change', 'record data',
      'select example', 'show method', 'sort specimen',
      'state property', 'trace process', 'write observation',
    ],
    [
      'analyze data', 'apply principle', 'calculate result',
      'classify organism', 'compare property', 'construct model',
      'contrast behavior', 'demonstrate', 'design investigation',
      'determine relationship', 'differentiate property',
      'discuss application', 'estimate', 'examine evidence',
      'experiment', 'explain process', 'formulate hypothesis',
      'hypothesize', 'illustrate cycle', 'investigate',
      'justify conclusion', 'measure change', 'model system',
      'predict outcome', 'relate to environment', 'research',
      'solve problem', 'summarize findings', 'test hypothesis', 'verify',
    ],
    [
      'acknowledge scientific method', 'advocate sustainability',
      'appreciate nature', 'commit to environment', 'communicate findings',
      'create awareness', 'critique practice', 'defend position',
      'develop curiosity', 'evaluate impact', 'generate solutions',
      'implement sustainable practice', 'innovate', 'integrate',
      'organize project', 'produce report', 'promote health',
      'propose solution', 'protect environment', 'reflect on science',
      'support conservation', 'sustain environment', 'synthesize',
      'validate findings', 'value scientific inquiry',
    ],
  ],
}

// ─── Verb Stem Normalization Map ──────────────────────────────────────────────
// Maps inflected forms → canonical base form for validation matching.

export const VERB_STEMS: Record<string, string> = {
  // -ing forms
  'identifying': 'identify', 'stating': 'state', 'defining': 'define',
  'listing': 'list', 'naming': 'name', 'labeling': 'label', 'labelling': 'label',
  'locating': 'locate', 'recognizing': 'recognize', 'recognising': 'recognize',
  'recalling': 'recall', 'observing': 'observe', 'recording': 'record',
  'classifying': 'classify', 'collecting': 'collect', 'counting': 'count',
  'drawing': 'draw', 'finding': 'find', 'noting': 'note',
  'reading': 'read', 'selecting': 'select', 'tracing': 'trace',
  'writing': 'write', 'matching': 'match', 'sorting': 'sort',
  'describing': 'describe', 'outlining': 'outline', 'showing': 'show',
  'giving': 'give', 'telling': 'tell', 'copying': 'copy',
  'annotating': 'annotate', 'arranging': 'arrange', 'citing': 'cite',
  'compiling': 'compile', 'completing': 'complete', 'detecting': 'detect',
  'diagramming': 'diagram', 'discovering': 'discover',
  'distinguishing': 'distinguish', 'enumerating': 'enumerate',
  'examining': 'examine', 'grouping': 'group', 'highlighting': 'highlight',
  'illustrating': 'illustrate', 'including': 'include', 'inspecting': 'inspect',
  'mapping': 'map', 'measuring': 'measure', 'memorizing': 'memorize',
  'ordering': 'order', 'quoting': 'quote', 'repeating': 'repeat',
  'reviewing': 'review', 'sketching': 'sketch', 'specifying': 'specify',
  'underlining': 'underline', 'checking': 'check', 'circling': 'circle',
  'filling': 'fill', 'picking': 'pick', 'placing': 'place',
  'scanning': 'scan', 'spotting': 'spot', 'ticking': 'tick',
  'transcribing': 'transcribe', 'assembling': 'assemble',
  'capturing': 'capture', 'charting': 'chart', 'gathering': 'gather',
  'indexing': 'index', 'itemizing': 'itemize', 'logging': 'log',
  'numbering': 'number', 'pinning': 'pin', 'positioning': 'position',
  'presenting': 'present', 'reciting': 'recite', 'registering': 'register',
  'reporting': 'report', 'sampling': 'sample', 'sequencing': 'sequence',
  'tagging': 'tag', 'titling': 'title', 'tracking': 'track',
  // L2 -ing forms
  'explaining': 'explain', 'discussing': 'discuss', 'analyzing': 'analyze',
  'analysing': 'analyze', 'comparing': 'compare', 'contrasting': 'contrast',
  'differentiating': 'differentiate', 'interpreting': 'interpret',
  'summarizing': 'summarize', 'summarising': 'summarize',
  'calculating': 'calculate', 'solving': 'solve', 'applying': 'apply',
  'determining': 'determine', 'investigating': 'investigate',
  'formulating': 'formulate', 'constructing': 'construct',
  'developing': 'develop', 'demonstrating': 'demonstrate',
  'predicting': 'predict', 'justifying': 'justify', 'estimating': 'estimate',
  'inferring': 'infer', 'deducing': 'deduce', 'organizing': 'organize',
  'organising': 'organize', 'experimenting': 'experiment',
  'verifying': 'verify', 'manipulating': 'manipulate',
  'converting': 'convert', 'performing': 'perform',
  'exploring': 'explore', 'modeling': 'model', 'modelling': 'model',
  'testing': 'test', 'researching': 'research',
  'adapting': 'adapt', 'adjusting': 'adjust', 'bridging': 'bridge',
  'categorizing': 'categorize', 'categorising': 'categorize',
  'clarifying': 'clarify', 'connecting': 'connect', 'contextualizing': 'contextualize',
  'correlating': 'correlate', 'decoding': 'decode', 'deriving': 'derive',
  'diagnosing': 'diagnose', 'documenting': 'document', 'drafting': 'draft',
  'elaborating': 'elaborate', 'employing': 'employ', 'executing': 'execute',
  'extending': 'extend', 'extracting': 'extract', 'generalizing': 'generalize',
  'generalising': 'generalize', 'handling': 'handle', 'hypothesizing': 'hypothesize',
  'hypothesising': 'hypothesize', 'implementing': 'implement',
  'incorporating': 'incorporate', 'integrating': 'integrate',
  'linking': 'link', 'modifying': 'modify', 'navigating': 'navigate',
  'negotiating': 'negotiate', 'operationalizing': 'operationalize',
  'paraphrasing': 'paraphrase', 'planning': 'plan', 'plotting': 'plot',
  'preparing': 'prepare', 'probing': 'probe', 'processing': 'process',
  'questioning': 'question', 'reasoning': 'reason', 'reconstructing': 'reconstruct',
  'relating': 'relate', 'representing': 'represent', 'restating': 'restate',
  'restructuring': 'restructure', 'rewriting': 'rewrite',
  'simulating': 'simulate', 'structuring': 'structure',
  'substituting': 'substitute', 'suggesting': 'suggest',
  'surveying': 'survey', 'transforming': 'transform', 'translating': 'translate',
  'troubleshooting': 'troubleshoot', 'unpacking': 'unpack',
  'validating': 'validate', 'varying': 'vary', 'working': 'work',
  // L3 -ing forms
  'appreciating': 'appreciate', 'valuing': 'value', 'advocating': 'advocate',
  'evaluating': 'evaluate', 'designing': 'design', 'creating': 'create',
  'synthesizing': 'synthesize', 'synthesising': 'synthesize',
  'producing': 'produce', 'proposing': 'propose', 'reflecting': 'reflect',
  'improving': 'improve', 'innovating': 'innovate', 'inventing': 'invent',
  'recommending': 'recommend', 'supporting': 'support',
  'coordinating': 'coordinate', 'mentoring': 'mentor', 'guiding': 'guide',
  'promoting': 'promote', 'influencing': 'influence', 'leading': 'lead',
  'collaborating': 'collaborate', 'revising': 'revise', 'enhancing': 'enhance',
  'defending': 'defend', 'generating': 'generate', 'acknowledging': 'acknowledge',
  'affirming': 'affirm', 'arguing': 'argue', 'articulating': 'articulate',
  'campaigning': 'campaign', 'championing': 'champion',
  'choosing': 'choose', 'combining': 'combine', 'committing': 'commit',
  'communicating': 'communicate', 'composing': 'compose',
  'contributing': 'contribute', 'convincing': 'convince', 'debating': 'debate',
  'deciding': 'decide', 'dedicating': 'dedicate', 'disagreeing': 'disagree',
  'displaying': 'display', 'editing': 'edit', 'empowering': 'empower',
  'engaging': 'engage', 'establishing': 'establish', 'exhibiting': 'exhibit',
  'expressing': 'express', 'framing': 'frame', 'honoring': 'honor',
  'initiating': 'initiate', 'internalizing': 'internalize',
  'judging': 'judge', 'managing': 'manage', 'motivating': 'motivate',
  'originating': 'originate', 'persuading': 'persuade',
  'practicing': 'practice', 'preserving': 'preserve',
  'prioritizing': 'prioritize', 'professing': 'profess',
  'projecting': 'project', 'protecting': 'protect', 'ranking': 'rank',
  'recognizing importance': 'recognize importance',
  'refining': 'refine', 'reforming': 'reform', 'rejecting': 'reject',
  'resolving': 'resolve', 'rethinking': 'rethink', 'striving': 'strive',
  'sustaining': 'sustain', 'thinking': 'think',
  'upholding': 'uphold', 'weighing': 'weigh',
  // Nominalizations (noun forms that appear in outcomes)
  'analysis': 'analyze', 'evaluation': 'evaluate', 'investigation': 'investigate',
  'identification': 'identify', 'classification': 'classify',
  'observation': 'observe', 'description': 'describe', 'explanation': 'explain',
  'demonstration': 'demonstrate', 'construction': 'construct',
  'formulation': 'formulate', 'calculation': 'calculate',
  'estimation': 'estimate', 'prediction': 'predict',
  'justification': 'justify', 'comparison': 'compare',
  'interpretation': 'interpret', 'design': 'design',
  'creation': 'create', 'synthesis': 'synthesize', 'reflection': 'reflect',
  'recommendation': 'recommend', 'collaboration': 'collaborate',
  'communication': 'communicate',
}

// ─── Verb Quality Scores ──────────────────────────────────────────────────────
// Higher = more authentic teacher language / KICD wording.
// Lower = generic AI language.

export const VERB_SCORES: Record<string, number> = {
  // Premium KICD verbs (teachers use these naturally)
  'identify': 10, 'observe': 10, 'describe': 10, 'explain': 10,
  'demonstrate': 10, 'investigate': 10, 'appreciate': 10, 'value': 10,
  'compare': 9, 'contrast': 9, 'classify': 9, 'analyze': 9,
  'evaluate': 9, 'design': 9, 'create': 9, 'construct': 9,
  'apply': 9, 'solve': 9, 'predict': 9, 'justify': 9,
  'advocate': 9, 'reflect': 9, 'collaborate': 9,
  // Good curriculum verbs
  'label': 8, 'name': 8, 'list': 8, 'draw': 8, 'sketch': 8,
  'measure': 8, 'calculate': 8, 'formulate': 8, 'hypothesize': 8,
  'infer': 8, 'deduce': 8, 'differentiate': 8, 'interpret': 8,
  'summarize': 8, 'research': 8, 'propose': 8, 'synthesize': 8,
  'defend': 8, 'develop': 8, 'generate': 8, 'implement': 8,
  'organize': 8, 'produce': 8, 'promote': 8, 'support': 8,
  // Standard verbs
  'state': 7, 'define': 7, 'recall': 7, 'record': 7,
  'collect': 7, 'select': 7, 'match': 7, 'locate': 7,
  'trace': 7, 'note': 7, 'show': 7, 'give': 7,
  'examine': 7, 'explore': 7, 'determine': 7, 'estimate': 7,
  'verify': 7, 'test': 7, 'plan': 7, 'model': 7,
  'present': 7, 'communicate': 7, 'acknowledge': 7, 'critique': 7,
  // Acceptable but lower authenticity
  'find': 6, 'read': 6, 'write': 6, 'copy': 6,
  'complete': 6, 'discuss': 6, 'prepare': 6, 'relate': 6,
  'guide': 6, 'lead': 6, 'integrate': 6, 'validate': 6,
  // Lower-priority (acceptable but less KICD-typical)
  'indicate': 5, 'mention': 5, 'assemble': 5, 'compile': 5,
  'enumerate': 5, 'specify': 5, 'arrange': 5, 'annotate': 5,
  'manipulate': 5, 'convert': 5, 'improve': 5, 'innovate': 5,
  'enhance': 5, 'revise': 5, 'coordinate': 5, 'mentor': 5,
  // Generic / lower authenticity
  'do': 2, 'make': 2, 'get': 2, 'use': 3, 'try': 2,
  'look at': 2, 'think about': 2, 'work on': 2,
}

// ─── Utility: Get combined verb pool for a level + subject ────────────────────

export function getVerbPool(
  level: 0 | 1 | 2,
  subjectType: string
): string[] {
  const universal = [UNIVERSAL_L1, UNIVERSAL_L2, UNIVERSAL_L3][level]
  const extension = SUBJECT_EXTENSIONS[subjectType]
  if (!extension) return universal
  // Subject-specific verbs come first (higher priority for selection)
  return [...new Set([...extension[level], ...universal])]
}

// ─── Utility: Normalize a word to its base verb form ─────────────────────────

export function normalizeVerb(word: string): string {
  const w = word.toLowerCase().trim()
  if (VERB_STEMS[w]) return VERB_STEMS[w]
  // Simple rule-based fallback
  if (w.endsWith('ation') || w.endsWith('ition')) return w  // keep nominalization
  if (w.endsWith('ised') || w.endsWith('ized')) return w.slice(0, -2) + 'e'
  if (w.endsWith('ising') || w.endsWith('izing')) return w.slice(0, -3) + 'e'
  if (w.endsWith('ing') && w.length > 5) {
    const base = w.slice(0, -3)
    // Double consonant: running → run
    if (base.length >= 3 && base[base.length - 1] === base[base.length - 2]) {
      return base.slice(0, -1)
    }
    return base
  }
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2)
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -1)
  if (w.endsWith('s') && w.length > 4) return w.slice(0, -1)
  return w
}

// ─── Utility: Score an outcome for curriculum quality ─────────────────────────

export function scoreOutcome(outcome: string): number {
  const words = outcome.toLowerCase().split(/\s+/)
  for (const word of words.slice(0, 3)) {  // check first 3 words for the verb
    const normalized = normalizeVerb(word)
    if (VERB_SCORES[normalized] !== undefined) return VERB_SCORES[normalized]
    if (VERB_SCORES[word] !== undefined) return VERB_SCORES[word]
  }
  return 5  // default middle score
}
