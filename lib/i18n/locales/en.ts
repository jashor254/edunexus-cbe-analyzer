// lib/i18n/locales/en.ts
// English message catalog (base — all other locales extend this)

const en = {
  // ── Common ────────────────────────────────────────────────────────────────────
  common: {
    save:         'Save',
    cancel:       'Cancel',
    delete:       'Delete',
    edit:         'Edit',
    view:         'View',
    loading:      'Loading…',
    saving:       'Saving…',
    success:      'Success',
    error:        'Error',
    back:         'Back',
    next:         'Next',
    done:         'Done',
    search:       'Search',
    filter:       'Filter',
    export:       'Export',
    import:       'Import',
    generate:     'Generate',
    download:     'Download',
    copy:         'Copy',
    copied:       'Copied!',
    close:        'Close',
    confirm:      'Confirm',
    yes:          'Yes',
    no:           'No',
    or:           'or',
    and:          'and',
    of:           'of',
    by:           'by',
    in:           'in',
    on:           'on',
    at:           'at',
    none:         'None',
    all:          'All',
    unknown:      'Unknown',
    required:     'Required',
    optional:     'Optional',
    new:          'New',
    active:       'Active',
    inactive:     'Inactive',
    enabled:      'Enabled',
    disabled:     'Disabled',
  },

  // ── Auth ──────────────────────────────────────────────────────────────────────
  auth: {
    login:              'Log in',
    logout:             'Log out',
    signup:             'Sign up',
    email:              'Email address',
    password:           'Password',
    forgotPassword:     'Forgot password?',
    resetPassword:      'Reset password',
    loginRequired:      'You must be logged in to continue',
    sessionExpired:     'Your session has expired. Please log in again.',
  },

  // ── Navigation ────────────────────────────────────────────────────────────────
  nav: {
    dashboard:      'Dashboard',
    classes:        'Classes',
    lessonPlans:    'Lesson Plans',
    assessments:    'Assessments',
    students:       'Students',
    analytics:      'Analytics',
    settings:       'Settings',
    academy:        'Academy',
    career:         'Career',
    organizations:  'Organizations',
    billing:        'Billing',
    apiKeys:        'API Keys',
    auditLog:       'Audit Log',
  },

  // ── Teacher ───────────────────────────────────────────────────────────────────
  teacher: {
    schemeOfWork:       'Scheme of Work',
    lessonPlan:         'Lesson Plan',
    recordOfWork:       'Record of Work',
    assessment:         'Assessment',
    generateSow:        'Generate Scheme of Work',
    generateLesson:     'Generate Lesson Plan',
    markBook:           'Mark Book',
    classInsights:      'Class Insights',
    mondayPanel:        'Monday Panel',
    interventionCheckin:'Intervention Check-in',
  },

  // ── Student ───────────────────────────────────────────────────────────────────
  student: {
    learningCompass:    'Learning Compass',
    myProgress:         'My Progress',
    studyGroups:        'Study Groups',
    careerIntelligence: 'Career Intelligence',
    assignments:        'Assignments',
  },

  // ── Curriculum ────────────────────────────────────────────────────────────────
  curriculum: {
    grade:         'Grade',
    subject:       'Subject',
    strand:        'Strand',
    subStrand:     'Sub-strand',
    term:          'Term',
    week:          'Week',
    topic:         'Topic',
    learningOutcome: 'Learning Outcome',
    assessment:    'Assessment',
    level: {
      be: 'Below Expectations',
      ae: 'Approaching Expectations',
      me: 'Meeting Expectations',
      ee: 'Exceeding Expectations',
    },
  },

  // ── Organizations ─────────────────────────────────────────────────────────────
  org: {
    organization:   'Organization',
    organizations:  'Organizations',
    members:        'Members',
    invite:         'Invite member',
    inviteEmail:    'Email address to invite',
    role:           'Role',
    roles: {
      owner:   'Owner',
      admin:   'Admin',
      member:  'Member',
      viewer:  'Viewer',
      billing: 'Billing',
    },
    transferOwnership:  'Transfer ownership',
    leaveOrg:           'Leave organization',
    deleteOrg:          'Delete organization',
    plan:               'Plan',
    usage:              'Usage',
    quota:              'Quota',
    trial:              'Trial',
    trialEnds:          'Trial ends {{date}}',
    upgradeRequired:    'Upgrade required',
  },

  // ── Billing ───────────────────────────────────────────────────────────────────
  billing: {
    currentPlan:    'Current plan',
    upgrade:        'Upgrade',
    downgrade:      'Downgrade',
    invoices:       'Invoices',
    usageSummary:   'Usage summary',
    tokens:         'tokens',
    apiCalls:       'API calls',
    storage:        'Storage',
    perMonth:       'per month',
    free:           'Free',
    pro:            'Pro',
    enterprise:     'Enterprise',
  },

  // ── Errors ────────────────────────────────────────────────────────────────────
  errors: {
    generic:            'Something went wrong. Please try again.',
    notFound:           'Not found.',
    unauthorized:       'You are not authorized to do this.',
    sessionExpired:     'Your session expired. Please log in again.',
    networkError:       'Network error. Check your connection and try again.',
    quotaExceeded:      'You have used your full quota for this feature.',
    aiUnavailable:      'AI generation is temporarily unavailable. Please try again.',
    invalidInput:       'Please check your input and try again.',
  },
}

export type Messages = typeof en
export default en
