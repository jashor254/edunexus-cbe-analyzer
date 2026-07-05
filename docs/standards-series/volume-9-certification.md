# EduNexus Standards Series

## Volume 9 — Educational Developer Certification

### Professional Certification Paths for Educational Intelligence Systems

**Edition 1.0 — June 2026**

---

> *Certification is not gatekeeping. It is a signal. When a school administrator installs a certified application, they are trusting that a professional standard has been met. When a government procurement officer evaluates a certified vendor, they know what the certification represents. Certification makes trust scalable.*

---

## Preface

Educational software operates in high-stakes environments. Errors in a financial application cost money. Errors in an educational application can affect a child's assessment record, their risk profile, their reported performance, and ultimately — compounding across a school career — their opportunities.

Professional certification provides confidence that the developers, architects, and organisations building educational software understand the domain, the standards, and the responsibility.

This volume defines eight certification paths. Each path has:
- A target professional role
- Knowledge domains assessed
- Assessment format (examination, practical project, peer review)
- Prerequisites
- Continuing education requirements
- Renewal period

Certification is not static. Educational systems evolve, AI capabilities develop, and privacy requirements deepen. All certifications require renewal and continuing education.

---

## Certification Path 1 — Developer Certification

### Target Role

Software developers integrating with educational intelligence platforms to build educational applications. This is the entry-level certification for developers working with Educational API Standards.

### Certification Tiers

**EDS-Developer Associate (EDS-DA)**

*For developers with less than 2 years of educational technology experience or new to the educational intelligence platform ecosystem.*

Knowledge domains:
- Educational domain fundamentals (CBC curriculum structure, competency-based assessment, learner progression models)
- Platform API fundamentals (authentication, request/response patterns, pagination, error handling)
- Educational API Standards (Volume 3) — Learner, Teacher, Assessment APIs
- Security fundamentals (API key management, data classification, GDPR/DPA principles for learner data)
- SDK usage in at least one language
- Webhook integration and event handling fundamentals

Assessment:
- Online examination: 60 questions, 120 minutes, 75% pass mark
- Practical project: integrate a sample educational application with mock APIs demonstrating CRUD and at least two domain operations

Validity: 18 months

**EDS-Developer Professional (EDS-DP)**

*For developers with demonstrated professional experience building production educational applications.*

Prerequisites: EDS-DA (or demonstrated equivalent experience)

Knowledge domains (in addition to Associate domains):
- Full Educational API Standards (all 12 APIs in Volume 3)
- Educational event platform: subscription, delivery, idempotency, replay
- Plugin development (Volume 6) — lifecycle, permissions, Extension APIs
- Educational AI APIs — prompt architecture grounding principles, draft workflow, quality expectations
- Educational Data Standards (Volume 7) — canonical domain objects, interoperability patterns
- Offline architecture patterns for educational applications
- Learner intelligence API — risk scores, competency models, trajectory
- Performance optimisation for educational applications (batch queries, caching, event-driven updates)

Assessment:
- Online examination: 80 questions, 150 minutes, 78% pass mark
- Practical project: build a complete educational feature (minimum: AI generation with curriculum grounding + learner intelligence integration + event-driven notification) reviewed by a certified mentor

Validity: 24 months

**EDS-Developer Expert (EDS-DX)**

*For senior practitioners with deep expertise and demonstrated contribution to the educational technology ecosystem.*

Prerequisites: EDS-DP + 3 years of professional educational technology development

Knowledge domains (in addition to Professional domains):
- Advanced plugin architecture and security
- Educational AI quality standards and evaluation methodology
- Privacy-by-design for educational systems (Volume 5 + UNCRC data principles)
- Cross-curriculum adapter patterns (multi-country educational system integration)
- Educational data governance frameworks
- Contribution to educational standards (participation in standards bodies, open source, or community)

Assessment:
- Portfolio review: 3 production educational applications with technical write-up
- Community contribution: documented contribution to the ecosystem (open source, standards, documentation, mentoring)
- Peer panel review: 90-minute technical discussion with a panel of certified experts

Validity: 36 months (with annual continuing education requirement)

---

## Certification Path 2 — Solution Architect Certification

### Target Role

Technical architects who design educational technology integrations for schools, districts, government bodies, or EdTech companies. Solution architects design the integration architecture; developers implement it.

### Certification Tiers

**EDS-Architect Associate (EDS-AA)**

*For architects new to educational technology.*

Knowledge domains:
- Educational system architecture (all architectures in Volume 2)
- Multi-tenant design patterns
- Integration patterns for educational systems (ERP, LMS, assessment platform, parent portal)
- Educational API Standards and Educational Data Standards
- Event-driven architecture for educational systems
- Security architecture for learner data
- Offline-first architecture
- Cost modeling for educational systems

Assessment:
- Online examination: 60 questions, 120 minutes, 75% pass mark
- Architecture case study: design an integration architecture for a specified scenario (e.g., district LMS integration with school ERP and assessment platform)

Validity: 24 months

**EDS-Architect Professional (EDS-AP)**

*For senior architects with production educational system design experience.*

Prerequisites: EDS-AA + EDS-DP (or equivalent) + demonstrated architectural experience

Knowledge domains (in addition to Associate domains):
- Large-scale educational system design (national examination systems, government intelligence platforms)
- Data governance frameworks for educational institutions
- International educational system interoperability
- Educational AI system design and governance
- School Operating System architecture (Volume 2, Architecture 10)
- Regulatory compliance (Kenya Data Protection Act, GDPR, COPPA, national education data regulations)
- Disaster recovery and business continuity for educational systems

Assessment:
- Portfolio review: 2 complete architecture designs (anonymized) with technical rationale
- Architecture defence: present one architecture to a panel with Q&A
- Written assessment: 3 essay questions on architectural trade-offs

Validity: 36 months

---

## Certification Path 3 — Platform Engineer Certification

### Target Role

Engineers who build, operate, and maintain educational intelligence platform infrastructure — not external integrations but the platform itself.

**EDS-Platform Engineer (EDS-PE)**

Knowledge domains:
- Platform architecture (Volume 2, all reference architectures + Volume 1 patterns)
- API Gateway design and operation (authentication, rate limiting, circuit breaking, observability)
- Educational data pipeline design (event bus, streaming, batch processing)
- Plugin Runtime design and security
- Learner intelligence engine design
- Assessment engine design
- Curriculum knowledge graph management
- Multi-tenant infrastructure patterns
- Kubernetes and cloud infrastructure for educational platforms
- SRE practices adapted to educational contexts (SLOs for educational data freshness, etc.)
- Incident response for educational systems (data integrity incidents, availability incidents)

Assessment:
- Technical examination: 80 questions, 150 minutes, 80% pass mark
- System design interview: 90-minute design session with platform engineers
- Production contribution: documented contribution to a production educational platform

Validity: 24 months

---

## Certification Path 4 — AI Engineer Certification

### Target Role

AI/ML engineers building AI capabilities specifically for educational applications. This certification focuses on the unique requirements of AI in educational contexts beyond general ML engineering.

**EDS-AI Engineer Associate (EDS-AEA)**

*For AI engineers entering the educational domain.*

Knowledge domains:
- Educational AI Standards (Volume 5) — all 12 standards
- Curriculum grounding for AI generation — theory and implementation
- RAG (Retrieval-Augmented Generation) for curriculum knowledge
- Prompt architecture for educational domain tasks
- Hallucination prevention for educational content
- Bias evaluation and remediation in educational AI
- Educational quality evaluation methodologies
- AI governance requirements for educational settings
- Child data protection in AI systems

Assessment:
- Online examination: 70 questions, 120 minutes, 78% pass mark
- Technical project: implement a curriculum-grounded generation feature with validation and quality evaluation

Validity: 18 months (AI field moves fast — shorter renewal cycle)

**EDS-AI Engineer Professional (EDS-AEP)**

Prerequisites: EDS-AEA + professional AI experience

Knowledge domains (in addition to Associate domains):
- Learner risk prediction model design and evaluation
- Calibration of educational AI models
- Benchmark dataset design for educational AI
- Model version management for educational systems
- Human-in-the-loop workflow design
- Federated learning considerations for learner privacy
- International AI model evaluation for African educational contexts
- AI incident response for educational systems

Assessment:
- Portfolio: 2 production educational AI features with quality metrics
- Research contribution: documented evaluation of an educational AI model
- Technical panel review

Validity: 18 months

---

## Certification Path 5 — Educational Intelligence Specialist

### Target Role

Professionals who bridge the gap between educational domain expertise and technical implementation — curriculum specialists who work with technical teams, or technical professionals who develop deep educational domain knowledge.

**EDS-Educational Intelligence Specialist (EDS-EIS)**

Knowledge domains:
- CBC curriculum: all strands and sub-strands, Grade 7–12 (Volume 4 — CBC Intelligence Specification)
- Competency-based assessment: philosophy, implementation, common failure modes
- Learner progression models: theoretical foundations and practical implementation
- Teacher professional practice: how teachers actually work and what software must accommodate
- Special educational needs in the CBC context
- Assessment design: validity, reliability, and bias in educational assessment
- Performance level calibration
- Educational data interpretation: how to read learner intelligence data and understand what it means
- Kenya educational policy and regulatory context

Assessment:
- Domain knowledge examination: 80 questions, 150 minutes, 80% pass mark
- Curriculum review exercise: review and annotate an AI-generated lesson plan for curriculum accuracy
- Assessment design exercise: create a valid CBC-aligned assessment instrument
- Interview with curriculum experts: 60-minute discussion of curriculum interpretation and assessment design

Validity: 36 months (requires continuing professional development in educational domain)

---

## Certification Path 6 — Marketplace Partner Certification

### Target Role

Organisations that publish applications, plugins, or content to an educational technology marketplace.

**EDS-Marketplace Partner (EDS-MP)**

*Organisation-level certification, not individual.*

Requirements:
- At least one EDS-DP certified developer on staff
- Completed technical review of submitted application/plugin
- Security review passed (Volume 6, Chapter 9)
- Educational quality review passed (for AI applications)
- Privacy impact assessment completed
- Support commitment: documented SLA for user support and security patches
- Data handling agreement signed

Annual renewal requirements:
- Security patches applied within required timelines
- Plugin/application maintained for current platform version
- Support SLA maintained (measured by user rating and ticket resolution)
- No unresolved critical or high security vulnerabilities

---

## Certification Path 7 — Security Specialist Certification

### Target Role

Security professionals working specifically on educational technology security.

**EDS-Security Specialist (EDS-SS)**

Knowledge domains:
- Learner data classification and protection
- Kenya Data Protection Act (2019) — educational application requirements
- GDPR principles applied to educational contexts (for international schools)
- COPPA / CIPA for child data protection
- OAuth 2.0 and OIDC in educational applications
- Multi-tenant security architecture
- Educational API security (authentication, authorisation, audit logging)
- Plugin security (Volume 6, Chapter 9)
- AI safety in educational systems (Volume 5, Standard 10)
- Penetration testing methodology for educational applications
- Incident response for learner data breaches
- Educational data encryption (at rest, in transit, field-level)

Assessment:
- Security knowledge examination: 80 questions, 150 minutes, 80% pass mark
- Penetration testing exercise: conduct a structured security assessment of a sample educational application
- Security review exercise: review a proposed integration architecture and produce a security assessment report

Validity: 24 months

---

## Certification Path 8 — Curriculum Specialist Certification

### Target Role

Technical professionals who encode curriculum knowledge into software systems — building curriculum engines, validating curriculum references, or extending educational intelligence platforms with curriculum packs.

**EDS-Curriculum Specialist (EDS-CS)**

Knowledge domains:
- CBC Intelligence Specification (Volume 4) — complete mastery
- 8-4-4 curriculum structure (secondary level)
- IGCSE curriculum structure (for international schools)
- Curriculum ontology and knowledge graph design
- Machine-readable curriculum representation
- Curriculum validation rules and their implementation
- Assessment framework alignment
- Performance indicator design
- Cross-curriculum relationships and concept mapping
- Prerequisite graph construction and validation
- Curriculum update management (how to handle KICD document revisions)
- Curriculum adapter design (mapping between curriculum systems)
- International curriculum comparison

Assessment:
- Curriculum knowledge examination: 100 questions, 180 minutes, 82% pass mark (hardest examination in the program due to the precision required)
- Curriculum encoding exercise: encode a provided curriculum extract into CBCIS format
- Validation exercise: identify errors in a provided curriculum implementation
- Curriculum design review: critique a curriculum knowledge graph design

Validity: 24 months (shorter due to curriculum updates requiring knowledge refresh)

---

## Examination Administration

### Examination Format

All written examinations are:
- Delivered online through a proctored examination platform
- Timed with no extensions (accommodations available for documented disabilities)
- Scored automatically for objective questions
- Scored by certified assessors for essay and short-answer questions
- Results available within 5 business days

### Practical Assessment Format

Practical assessments (projects, architecture reviews) are:
- Submitted through the certification portal
- Reviewed by at least two certified assessors in the relevant domain
- Scored against published rubrics
- Accompanied by written assessor feedback regardless of outcome
- Re-submittable once after a 30-day remediation period

### Appeals Process

Candidates who believe their examination was incorrectly marked may appeal within 30 days of receiving results. Appeals require a written statement identifying specific marking errors. Appeals are reviewed by a panel of three assessors not involved in the original marking.

---

## Continuing Education

All certifications require continuing education for renewal:

| Certification | Annual CE Hours |
|---|---|
| EDS-DA | 10 hours |
| EDS-DP | 20 hours |
| EDS-DX | 30 hours |
| EDS-AA | 15 hours |
| EDS-AP | 25 hours |
| EDS-PE | 20 hours |
| EDS-AEA | 20 hours |
| EDS-AEP | 30 hours |
| EDS-EIS | 20 hours |
| EDS-SS | 25 hours |
| EDS-CS | 20 hours |

Approved continuing education activities:
- Accredited training courses
- Platform-hosted webinars and workshops
- Educational technology conferences
- Standards body participation
- Peer knowledge sharing (documented)
- Research publication
- Community mentoring

---

## Certification Directory

All certified professionals are listed in the public Certification Directory with:
- Name
- Certification(s) held
- Certification level
- Expiry date
- Specialisation areas (optional)

The directory allows schools, districts, and government procurement teams to verify certification claims and find qualified professionals.

---

## Governing Body

The Educational Developer Certification program is governed by the Educational Intelligence Standards Board (EISB), an independent body comprising:
- Practicing educational technology developers
- Curriculum experts and academics
- School administrator representatives
- Government education officer representatives
- Privacy and security experts
- Representatives from international educational standards bodies

The EISB:
- Sets and revises examination content
- Approves assessors
- Manages appeals
- Publishes annual quality reports
- Reviews and updates certification requirements as the field evolves

---

*EduNexus Standards Series — Volume 9: Educational Developer Certification*

*Edition 1.0 — June 2026*
