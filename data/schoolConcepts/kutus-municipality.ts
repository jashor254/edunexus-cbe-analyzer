import type { SchoolConceptConfig } from './types'

export const kutusMunicipality: SchoolConceptConfig = {
  slug: 'kutus-municipality',
  schoolName: 'Kutus Municipality School',
  shortDescription:
    'Kutus Municipality School is one institution covering Pre-Primary, Primary School, and Junior School in the Kutus area.',
  heroTagline: 'Nurturing learners from early years to junior school.',
  nav: [
    { label: 'Home', href: '' },
    { label: 'About', href: '/about' },
    { label: 'Pre-Primary', href: '/pre-primary' },
    { label: 'Primary School', href: '/primary' },
    { label: 'Junior School', href: '/junior-school' },
    { label: 'Admissions', href: '/admissions' },
    { label: 'News & Events', href: '/news-events' },
    { label: 'Contact', href: '/contact' },
  ],
  levels: [
    {
      id: 'pre-primary',
      slug: 'pre-primary',
      name: 'Pre-Primary',
      tagline: 'A welcoming beginning',
      description:
        'A welcoming beginning focused on confidence, curiosity, play, and foundational development. This concept page describes the general shape of a Pre-Primary programme; specific class structures and daily routines will be confirmed with the school.',
      focusAreas: [
        'Confidence and social-emotional growth',
        'Curiosity-led, play-based learning',
        'Early language and number awareness',
        'Foundational motor and communication skills',
      ],
    },
    {
      id: 'primary',
      slug: 'primary',
      name: 'Primary School',
      tagline: 'Strong foundations',
      description:
        'Strong foundations in literacy, numeracy, creativity, values, and learner growth. This concept page outlines general Primary School goals; the school\'s actual grade structure and subject offering will be confirmed and added.',
      focusAreas: [
        'Literacy and numeracy foundations',
        'Creativity and self-expression',
        'Values and character development',
        'Steady, supported learner growth',
      ],
    },
    {
      id: 'junior-school',
      slug: 'junior-school',
      name: 'Junior School',
      tagline: 'Building readiness',
      description:
        'Supporting learners as they develop competencies, interests, responsibility, and pathway awareness. This concept page describes the general aims of Junior School under CBC; official programme details will be confirmed by the school.',
      focusAreas: [
        'Competency-based learning',
        'Growing interests and strengths',
        'Responsibility and independence',
        'Early pathway awareness',
      ],
    },
  ],
  contact: {
    phone: { label: 'Official telephone', value: 'To be provided', status: 'pending' },
    email: { label: 'Official email', value: 'To be provided', status: 'pending' },
    postalAddress: { label: 'Postal address', value: 'To be provided', status: 'pending' },
    physicalLocation: {
      label: 'Physical location',
      value: 'Kutus area — exact location to be confirmed',
      status: 'pending',
    },
  },
  sampleNews: [
    {
      title: 'Term Opening Information — Sample Announcement',
      category: 'Announcement',
      summary:
        'This is a placeholder for term opening details such as reporting dates and requirements. Official information will be added once confirmed by the school.',
    },
    {
      title: 'Parent Meeting — Sample Event',
      category: 'Event',
      summary:
        'This is a placeholder for a parent meeting notice, showing how upcoming events can appear on the school website.',
    },
    {
      title: 'School Activity Update — Sample Story',
      category: 'Story',
      summary:
        'This is a placeholder for a short update about school activities, showing how the news section can share everyday school life.',
    },
  ],
  parentInfo: [
    { label: 'Term dates', status: 'Pending official school content' },
    { label: 'Uniform information', status: 'Pending official school content' },
    { label: 'Required documents', status: 'Pending official school content' },
    { label: 'School notices', status: 'Pending official school content' },
  ],
  admissions: {
    documents: [
      'Sample structure — official requirements to be confirmed by the school.',
      'Learner\'s birth certificate (typical requirement, to be confirmed)',
      'Previous school report or transfer letter, where applicable (to be confirmed)',
      'Immunisation or medical record, where applicable (to be confirmed)',
      'Passport-size photographs (to be confirmed)',
    ],
    enquiryProcessSteps: [
      'Sample structure — official process to be confirmed by the school.',
      'Contact the school using the details on the Contact page',
      'Ask about available places for the relevant level',
      'Receive guidance on required documents and next steps',
      'Complete admission once confirmed by the school',
    ],
    faqs: [
      {
        question: 'Which levels does the school admit learners into?',
        answer:
          'Kutus Municipality School covers Pre-Primary, Primary School, and Junior School. Specific entry points and age guidance will be confirmed by the school.',
      },
      {
        question: 'What documents are usually needed?',
        answer:
          'A general sample list is shown above. The school will confirm its exact requirements.',
      },
      {
        question: 'How can a parent start an enquiry?',
        answer:
          'Use the Contact page for official channels once these are confirmed, or the demonstration enquiry form on this concept site to see how an enquiry flow could work.',
      },
    ],
  },
  websiteFunctions: [
    'Admissions information',
    'School announcements',
    'Academic programmes',
    'Parent information',
    'Events calendar',
    'Contact and location information',
  ],
  about: {
    intro:
      'Kutus Municipality School is one institution covering Pre-Primary, Primary School, and Junior School in the Kutus area.',
    storyNote: 'The school\'s story can be added here.',
    missionNote: 'Official mission and vision information will appear here once confirmed by the school.',
  },
  theme: {
    primary: '#2f5233',
    primaryDark: '#1f3823',
    cream: '#faf6ec',
    // Darkened from the original #b5654a — the Phase 6 audit measured that
    // value at 3.95:1 on cream and 3.55:1 on the demo-badge tint, both
    // below WCAG AA's 4.5:1 for normal text. #8a4a35 measures 6.26:1 on
    // cream and 5.40:1 on the tint (see contrastRatio.test.ts), while
    // keeping the same warm clay/terracotta hue.
    clay: '#8a4a35',
    charcoal: '#2a2622',
  },
  conceptDisclaimer:
    'Concept website prepared by EduNexus Kenya for demonstration purposes. This is not the official website of Kutus Municipality School.',
  publicationStatus: 'concept',
}
