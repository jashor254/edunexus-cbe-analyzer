import type { MessageTemplate } from './types'

/**
 * Sprint PE-8 Part 2 — the Founder Message Library. Fixed, hand-written
 * content (not AI-generated per send — Part 4's "generator" personalizes
 * these, it does not author new copy). School-type variants
 * (public/private/junior/mixed) only exist for the cold-intro step, where
 * the opening line genuinely differs by school type; every later stage of
 * the relationship (follow-up, confirmation, demo, pilot) is the same
 * template regardless of school type.
 */
export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'cold_intro_public_secondary',
    name: 'Cold Introduction — Public Secondary',
    category: 'cold_intro',
    schoolType: 'public_secondary',
    purpose: 'First outreach to a public secondary school with no prior relationship.',
    whenToUse: 'Pipeline stage is "research" and no activity has been logged for this school yet.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A reply expressing interest, or a referral to the right contact (DoS/Principal).',
    variables: ['school_name', 'contact_name', 'founder_name'],
    tone: 'Warm, respectful, brief — introduces EduNexus without overselling.',
    length: 'short',
    whatsappBody:
      'Good day{{contact_name_greeting}}, I\'m {{founder_name}} from EduNexus. We help CBC teachers at schools like {{school_name}} save time on lesson planning and track learner progress. Would you be open to a short call this week to see if it could help your teachers?',
    smsBody:
      'Hi{{contact_name_greeting}}, {{founder_name}} from EduNexus here. We help CBC teachers save planning time at schools like {{school_name}}. Open to a short call this week? Reply to this SMS.',
    emailSubject: 'A quick question for {{school_name}}',
    emailBody:
      'Dear{{contact_name_greeting}},\n\nMy name is {{founder_name}}, founder of EduNexus. We work with CBC teachers to cut down lesson-planning time and give a clearer picture of learner progress.\n\nI\'d value ten minutes of your time this week to hear about {{school_name}}\'s current approach and share what we\'ve built. Would a short call work?\n\nKind regards,\n{{founder_name}}',
    callOpeningScript:
      'Good day, may I speak with the Principal or Deputy? ... My name is {{founder_name}}, I work with EduNexus — we support CBC teachers with lesson planning and learner tracking. I wanted to ask if {{school_name}} would be open to a short conversation about it.',
  },
  {
    id: 'cold_intro_private',
    name: 'Cold Introduction — Private School',
    category: 'cold_intro',
    schoolType: 'private',
    purpose: 'First outreach to a private school, where fee-paying parents make outcomes visibility a stronger hook.',
    whenToUse: 'Pipeline stage is "research" and no activity has been logged for this school yet.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A reply expressing interest, or a referral to the right contact.',
    variables: ['school_name', 'contact_name', 'founder_name'],
    tone: 'Warm, professional, emphasizes accountability to parents.',
    length: 'short',
    whatsappBody:
      'Good day{{contact_name_greeting}}, I\'m {{founder_name}} from EduNexus. We help private schools like {{school_name}} give teachers back planning time and give parents a clearer picture of progress. Would you be open to a short call this week?',
    smsBody:
      'Hi{{contact_name_greeting}}, {{founder_name}} from EduNexus. We help schools like {{school_name}} show parents clearer progress with less teacher admin. Open to a short call?',
    emailSubject: 'A quick question for {{school_name}}',
    emailBody:
      'Dear{{contact_name_greeting}},\n\nMy name is {{founder_name}}, founder of EduNexus. We work with schools to reduce teacher admin time and give parents a clearer, evidence-based view of learner progress.\n\nWould you be open to a short call this week to see whether it fits {{school_name}}?\n\nKind regards,\n{{founder_name}}',
    callOpeningScript:
      'Good day, may I speak with the Principal or Director? ... My name is {{founder_name}} from EduNexus — we help schools reduce teacher admin and give parents clearer progress updates. Would {{school_name}} be open to a short conversation?',
  },
  {
    id: 'cold_intro_junior_secondary',
    name: 'Cold Introduction — Junior Secondary',
    category: 'cold_intro',
    schoolType: 'junior_secondary',
    purpose: 'First outreach to a Junior Secondary school (Grade 7-9), where CBC assessment load is the sharpest pain point.',
    whenToUse: 'Pipeline stage is "research" and no activity has been logged for this school yet.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A reply expressing interest, or a referral to the right contact.',
    variables: ['school_name', 'contact_name', 'founder_name'],
    tone: 'Warm, brief, speaks directly to CBC assessment workload.',
    length: 'short',
    whatsappBody:
      'Good day{{contact_name_greeting}}, I\'m {{founder_name}} from EduNexus. We help Junior Secondary teachers at schools like {{school_name}} manage CBC assessments and evidence with less paperwork. Open to a short call this week?',
    smsBody:
      'Hi{{contact_name_greeting}}, {{founder_name}} from EduNexus. We help JSS teachers at {{school_name}} manage CBC assessments with less paperwork. Open to a short call?',
    emailSubject: 'A quick question for {{school_name}}',
    emailBody:
      'Dear{{contact_name_greeting}},\n\nMy name is {{founder_name}}, founder of EduNexus. We work with Junior Secondary teachers to lighten the CBC assessment and evidence workload.\n\nWould you be open to a short call this week to see whether it fits {{school_name}}?\n\nKind regards,\n{{founder_name}}',
    callOpeningScript:
      'Good day, may I speak with the Principal or the Junior Secondary lead? ... My name is {{founder_name}} from EduNexus — we help JSS teachers manage CBC assessment workload. Would {{school_name}} be open to a short conversation?',
  },
  {
    id: 'cold_intro_mixed',
    name: 'Cold Introduction — Mixed School',
    category: 'cold_intro',
    schoolType: 'mixed',
    purpose: 'First outreach to a mixed-level school (multiple grade bands under one administration).',
    whenToUse: 'Pipeline stage is "research" and no activity has been logged for this school yet.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A reply expressing interest, or a referral to the right contact.',
    variables: ['school_name', 'contact_name', 'founder_name'],
    tone: 'Warm, brief, acknowledges the school spans multiple grade levels.',
    length: 'short',
    whatsappBody:
      'Good day{{contact_name_greeting}}, I\'m {{founder_name}} from EduNexus. We help teachers across grade levels at schools like {{school_name}} save planning time and track progress consistently. Open to a short call this week?',
    smsBody:
      'Hi{{contact_name_greeting}}, {{founder_name}} from EduNexus. We help teachers across all grades at {{school_name}} save planning time. Open to a short call?',
    emailSubject: 'A quick question for {{school_name}}',
    emailBody:
      'Dear{{contact_name_greeting}},\n\nMy name is {{founder_name}}, founder of EduNexus. We work with schools spanning multiple grade levels to keep lesson planning and progress tracking consistent across all of them.\n\nWould you be open to a short call this week to see whether it fits {{school_name}}?\n\nKind regards,\n{{founder_name}}',
    callOpeningScript:
      'Good day, may I speak with the Principal or Deputy? ... My name is {{founder_name}} from EduNexus — we help schools with multiple grade levels keep planning and progress tracking consistent. Would {{school_name}} be open to a short conversation?',
  },
  {
    id: 'warm_referral',
    name: 'Warm Referral',
    category: 'warm_referral',
    schoolType: null,
    purpose: 'First outreach when someone the contact trusts referred EduNexus to this school.',
    whenToUse: 'contact_source on the school indicates a referral, rather than cold discovery.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'Faster trust and a quicker yes to a call, since the introduction is not cold.',
    variables: ['school_name', 'contact_name', 'founder_name'],
    tone: 'Warm, references the referral early, brief.',
    length: 'short',
    whatsappBody:
      'Good day{{contact_name_greeting}}, I\'m {{founder_name}} from EduNexus — I was given your contact and asked to reach out about {{school_name}}. We help CBC teachers save planning time and track progress. Would you be open to a short call this week?',
    emailSubject: 'Introduction — EduNexus for {{school_name}}',
    emailBody:
      'Dear{{contact_name_greeting}},\n\nMy name is {{founder_name}}, founder of EduNexus. I was given your contact and encouraged to reach out about {{school_name}}.\n\nWe help CBC teachers save planning time and track learner progress more clearly. Would you be open to a short call this week?\n\nKind regards,\n{{founder_name}}',
    callOpeningScript:
      'Good day, my name is {{founder_name}} from EduNexus — I was given your contact and asked to reach out about {{school_name}}. Do you have a moment?',
  },
  {
    id: 'follow_up_1',
    name: 'Follow-up After No Response (first)',
    category: 'follow_up_1',
    schoolType: null,
    purpose: 'Gentle nudge after the first message got no reply.',
    whenToUse: 'No reply 3 days after the last outbound message.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A reply, even a "not now" — keeps the school from going silent.',
    variables: ['school_name', 'founder_name'],
    tone: 'Light, no pressure, easy to say no to.',
    length: 'short',
    whatsappBody:
      'Hi again, just following up in case my last message got buried — no pressure at all. Still happy to share how EduNexus could help {{school_name}}\'s teachers whenever suits you.',
    smsBody: 'Hi, following up on my earlier message re EduNexus for {{school_name}} — no pressure, whenever suits you. — {{founder_name}}',
    emailSubject: 'Following up — {{school_name}}',
    emailBody:
      'Dear colleague,\n\nJust a gentle follow-up in case my earlier note got buried in your inbox. I\'d still value a short conversation about how EduNexus could help {{school_name}}\'s teachers, whenever suits you.\n\nKind regards,\n{{founder_name}}',
  },
  {
    id: 'follow_up_2',
    name: 'Follow-up After No Response (second)',
    category: 'follow_up_2',
    schoolType: null,
    purpose: 'Second and final nudge before the school is set aside for now.',
    whenToUse: 'No reply 7 days after the last outbound message (and follow_up_1 already sent).',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A reply, or a clean signal to close the school for now rather than keep chasing.',
    variables: ['school_name', 'founder_name'],
    tone: 'Respectful, gives an easy exit, no guilt.',
    length: 'short',
    whatsappBody:
      'Hi, one last check-in from my side — totally understand if now isn\'t the right time for {{school_name}}. Just let me know either way and I won\'t follow up again unless you\'d like me to.',
    emailSubject: 'One last check-in — {{school_name}}',
    emailBody:
      'Dear colleague,\n\nOne last check-in from my side. If now isn\'t the right time for {{school_name}}, that\'s completely understood — just let me know and I\'ll step back. Otherwise I\'d still love to find ten minutes.\n\nKind regards,\n{{founder_name}}',
  },
  {
    id: 'discovery_meeting_confirmation',
    name: 'Discovery Meeting Confirmation',
    category: 'discovery_meeting_confirmation',
    schoolType: null,
    purpose: 'Confirm the date/time of an agreed discovery call or visit.',
    whenToUse: 'Right after a discovery meeting is scheduled, to lock it in writing.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A confirmed, remembered meeting — fewer no-shows.',
    variables: ['school_name', 'meeting_date', 'meeting_time', 'founder_name'],
    tone: 'Clear, confirms logistics, friendly.',
    length: 'short',
    whatsappBody:
      'Confirming our discovery call for {{school_name}} on {{meeting_date}} at {{meeting_time}}. Looking forward to it — let me know if anything changes on your side.',
    emailSubject: 'Confirmed — {{meeting_date}} at {{meeting_time}}',
    emailBody:
      'Dear colleague,\n\nConfirming our discovery meeting for {{school_name}} on {{meeting_date}} at {{meeting_time}}. Please let me know if anything changes.\n\nLooking forward to it,\n{{founder_name}}',
  },
  {
    id: 'demo_reminder',
    name: 'Demo Reminder',
    category: 'demo_reminder',
    schoolType: null,
    purpose: 'Reminder shortly before a scheduled product demo.',
    whenToUse: 'The day before (or morning of) a scheduled demo.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'The demo happens as scheduled, with the right people present.',
    variables: ['school_name', 'meeting_date', 'meeting_time', 'founder_name'],
    tone: 'Brief, friendly reminder, no new information.',
    length: 'short',
    whatsappBody:
      'Quick reminder — our EduNexus demo for {{school_name}} is on {{meeting_date}} at {{meeting_time}}. See you then!',
    emailSubject: 'Reminder — demo on {{meeting_date}}',
    emailBody:
      'Dear colleague,\n\nA quick reminder that our EduNexus demo for {{school_name}} is scheduled for {{meeting_date}} at {{meeting_time}}.\n\nSee you then,\n{{founder_name}}',
  },
  {
    id: 'thank_you_after_demo',
    name: 'Thank-you After Demo',
    category: 'thank_you_after_demo',
    schoolType: null,
    purpose: 'Thank the school for attending the demo and reiterate the next step.',
    whenToUse: 'Same day as a completed demo.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'Momentum carries into a pilot decision rather than going quiet.',
    variables: ['school_name', 'founder_name'],
    tone: 'Warm, appreciative, forward-looking.',
    length: 'short',
    whatsappBody:
      'Thank you for the time today — it was great walking {{school_name}} through EduNexus. Happy to answer any questions that come up as you discuss it internally.',
    emailSubject: 'Thank you — {{school_name}}',
    emailBody:
      'Dear colleague,\n\nThank you for the time today, and for letting me walk {{school_name}}\'s team through EduNexus. Please don\'t hesitate to reach out with any questions as you discuss it internally.\n\nKind regards,\n{{founder_name}}',
  },
  {
    id: 'pilot_invitation',
    name: 'Pilot Invitation',
    category: 'pilot_invitation',
    schoolType: null,
    purpose: 'Formally invite the school into the pilot programme.',
    whenToUse: 'After a positive demo, when the school is a good pilot fit.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A yes to joining the pilot, or specific concerns to address.',
    variables: ['school_name', 'pilot_slots_remaining', 'founder_name'],
    tone: 'Confident but not pushy, notes limited slots honestly (not as pressure tactic).',
    length: 'medium',
    whatsappBody:
      'I\'d like to formally invite {{school_name}} to join the EduNexus pilot programme. We have {{pilot_slots_remaining}} pilot slots remaining this term. There\'s no cost during the pilot — just your teachers\' honest feedback. Would you like to go ahead?',
    emailSubject: 'Pilot invitation — {{school_name}}',
    emailBody:
      'Dear colleague,\n\nI\'d like to formally invite {{school_name}} to join the EduNexus pilot programme. We currently have {{pilot_slots_remaining}} pilot slots remaining this term.\n\nThere is no cost during the pilot — only your teachers\' honest feedback in return. Would {{school_name}} like to go ahead?\n\nKind regards,\n{{founder_name}}',
    callOpeningScript:
      'Thanks for the time earlier — I\'d like to formally invite {{school_name}} into the EduNexus pilot programme. We have {{pilot_slots_remaining}} slots left this term. Would you like to go ahead?',
  },
  {
    id: 'pilot_accepted',
    name: 'Pilot Accepted',
    category: 'pilot_accepted',
    schoolType: null,
    purpose: 'Confirm acceptance into the pilot and set expectations for what happens next.',
    whenToUse: 'Immediately after a school agrees to the pilot.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'The school knows exactly what happens next — onboarding, no ambiguity.',
    variables: ['school_name', 'founder_name'],
    tone: 'Warm, welcoming, sets clear next steps.',
    length: 'short',
    whatsappBody:
      'Wonderful — welcome to the EduNexus pilot, {{school_name}}! I\'ll follow up shortly with onboarding details for your teachers. Excited to work with you.',
    emailSubject: 'Welcome to the pilot — {{school_name}}',
    emailBody:
      'Dear colleague,\n\nWonderful news — welcome to the EduNexus pilot, {{school_name}}! I\'ll follow up shortly with onboarding details for your teachers.\n\nExcited to work with you,\n{{founder_name}}',
  },
  {
    id: 'one_week_checkin',
    name: 'One Week Check-in',
    category: 'one_week_checkin',
    schoolType: null,
    purpose: 'Check how the first week of the pilot is going.',
    whenToUse: 'One week after a pilot starts running.',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'Early feedback and a chance to fix small problems before they become reasons to quit.',
    variables: ['school_name', 'founder_name'],
    tone: 'Genuinely curious, low-pressure, inviting honesty.',
    length: 'short',
    whatsappBody:
      'One week in — how has it been going for {{school_name}}\'s teachers? Happy to jump on a quick call if anything\'s been unclear or if you\'d like a hand with anything.',
    emailSubject: 'How is week one going, {{school_name}}?',
    emailBody:
      'Dear colleague,\n\nWe\'re one week into the pilot — I\'d love to hear how it\'s been going for {{school_name}}\'s teachers. Happy to jump on a quick call if anything has been unclear.\n\nKind regards,\n{{founder_name}}',
  },
  {
    id: 'referral_request',
    name: 'Referral Request',
    category: 'referral_request',
    schoolType: null,
    purpose: 'Ask a happy pilot school for an introduction to another school.',
    whenToUse: 'After a school has expressed satisfaction with the pilot (e.g. at the one-week check-in or later).',
    defaultChannel: 'whatsapp',
    expectedOutcome: 'A warm introduction to a new school, worth more than a cold approach.',
    variables: ['school_name', 'founder_name'],
    tone: 'Appreciative, asks a specific small favour, easy to decline.',
    length: 'short',
    whatsappBody:
      'Glad it\'s been useful for {{school_name}}! If you know another school that might benefit from EduNexus, I\'d really appreciate an introduction — no pressure if not.',
    emailSubject: 'A small favour, {{school_name}}',
    emailBody:
      'Dear colleague,\n\nI\'m glad EduNexus has been useful for {{school_name}}. If you know another school that might benefit, I\'d really appreciate an introduction — completely understand if nothing comes to mind.\n\nKind regards,\n{{founder_name}}',
  },
]

export function findTemplate(id: string): MessageTemplate | undefined {
  return MESSAGE_TEMPLATES.find((t) => t.id === id)
}

/** Cold-intro variant matching a school's category, falling back to the mixed-school phrasing when the category doesn't map cleanly. */
export function coldIntroTemplateForCategory(category: string | null): MessageTemplate {
  const normalized = (category ?? '').toLowerCase()
  if (normalized.includes('junior')) return findTemplate('cold_intro_junior_secondary')!
  if (normalized.includes('private')) return findTemplate('cold_intro_private')!
  if (normalized.includes('public') || normalized.includes('government')) return findTemplate('cold_intro_public_secondary')!
  return findTemplate('cold_intro_mixed')!
}
