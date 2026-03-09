# VoltTrack ERP — Business Requirements Document

**Version:** 1.0
**Date:** March 9, 2026
**Status:** Approved for Implementation Planning

---

## Executive Summary

VoltTrack is an AI-assisted ERP/CRM for small-to-mid-size electrical testing and service contractors. It replaces the patchwork of Word, Excel, QuickBooks, and paper that defines the industry today — managing the complete business lifecycle from lead generation through contract execution, field inspection, compliance reporting, deficiency resolution, and recurring billing.

**Core value proposition:** A technician finishes a job on-site. By the time they're back in the truck, a branded compliance report is generated, deficiencies are queued for quoting, and the invoice is drafted. No office re-entry, no lost paperwork, no revenue leakage.

**Business objectives:**
- Enable seamless lead-to-renewal workflow for electrical contractors
- Automate NFPA 70B / NETA compliance tracking and inspection scheduling
- Eliminate revenue leakage from untracked deficiencies (30%+ industry average)
- Reduce administrative overhead so contractors can scale without adding office staff
- Provide an AI automation layer that handles routine operational tasks autonomously

---

## Market Opportunity

The US electrical services market exceeds $200B annually. Within it, the electrical testing and maintenance segment — companies performing NETA acceptance testing, NFPA 70B preventative maintenance, infrared thermography, arc flash studies, and power quality analysis — represents a highly specialized niche with strong recurring revenue characteristics and almost no purpose-built software.

**Market dynamics:**
- ~35,000 electrical contractors perform testing/maintenance work in the US
- Mature testing firms derive 60–70% of revenue from recurring inspection contracts
- Inspection contracts typically include auto-renewal clauses, creating sticky revenue
- Software adoption is extremely low — most firms use Word/Excel for reports, email for scheduling, QuickBooks for billing, and nothing for compliance tracking

**Target customer:**
- Primary: Electrical testing companies (NETA-certified, 5–50 technicians, $1–10M revenue)
- Secondary: Full-service electrical contractors with a service/maintenance division
- Geographic focus: US, initially Northeast, expanding nationally

**Competitive gap:**

| Competitor | Strengths | Gaps |
|------------|-----------|------|
| ServiceTitan | Full FSM suite, mature platform | $300–500/tech/month, 6-month onboarding, zero electrical compliance features |
| Jobber | Affordable, easy to use | No compliance, no electrical-specific features |
| FieldEdge | HVAC/plumbing focused | Not built for electrical testing workflows |
| Inspect Point | Strong fire inspection templates | Fire-only, no CRM, iOS-only |

No solution combines electrical compliance depth (NFPA 70B, NETA, 70E), full lifecycle management, AI automation, and mid-market accessibility.

**Pricing target:** $99–149/tech/month, self-serve onboarding under 30 minutes.

---

## Stakeholders & Personas

### Persona 1: The Field Technician

- **Profile:** NETA-certified, 5–20 years experience, works across 30–50 mile radius, moderate tech comfort
- **Daily workflow:** 3–6 jobs/day across industrial and commercial sites; works in switchgear rooms, substations, and mechanical spaces with poor connectivity
- **Pain points:** Paper checklists are bulky and unclear; photo management is chaos; must re-enter field data at the office; can't access customer history on-site
- **Feature priorities:** Pre-loaded inspection checklists, photo capture tied to findings, offline sync, digital signature collection, voice-to-text notes

### Persona 2: The Operations Manager

- **Profile:** 10+ years in electrical field, often a former technician, manages scheduling/compliance/customer relationships
- **Daily workflow:** Tracks upcoming inspections, assigns techs, reviews completed reports, manages deficiency resolution, handles contract renewals
- **Pain points:** Manual tracking of inspection due dates; deficiencies identified in field don't become quotes (revenue leakage); renewal dates tracked in spreadsheets; no visibility into technician productivity
- **Feature priorities:** Compliance calendar with alerts, automated deficiency-to-quote workflow, contract renewal tracking, technician productivity dashboard

### Persona 3: The Business Owner

- **Profile:** 20+ years in trade, built company from ground up, low-to-moderate tech comfort, delegates to ops manager
- **Business model:** 60–70% recurring inspection/maintenance revenue, 30–40% project/installation work
- **Pain points:** Doesn't know true profitability by customer or job type; worries about compliance gaps and liability exposure; manual processes limit scaling; can't demonstrate business quality to potential acquirers
- **Feature priorities:** Financial reporting (MRR, margins, AR aging), compliance risk dashboard, QuickBooks integration, audit trail for due diligence

### Persona 4: The Sales Representative

- **Profile:** 2–5 years in electrical sales, high tech comfort, commission-driven
- **Pain points:** Lost leads without follow-up system; quote generation is slow; no visibility into which existing customers have open deficiencies (upsell opportunity); unclear handoff to operations
- **Feature priorities:** CRM pipeline, mobile site assessment, automated quote generation from deficiency lists, sales dashboard with conversion metrics

---

## Entity Architecture

The platform is structured around an ERP-first hierarchy. Test reports are the output of field execution — not the root entity.

```
Tenant (contractor company)
├── Users
│   └── Roles: Admin | Manager | Technician | Sales | Customer
├── Customers
│   ├── Locations / Sites
│   │   └── Equipment / Assets
│   │       ├── Equipment Type (from taxonomy)
│   │       ├── QR Code
│   │       └── Inspection History
│   ├── Contacts
│   └── Documents (contracts, permits, certificates)
├── Leads / Opportunities (CRM pipeline)
├── Contracts
│   ├── Type: Inspection | Service | Installation | MSA
│   ├── Frequency: Monthly | Quarterly | Semi-Annual | Annual
│   ├── Auto-Renewal Settings
│   └── Service Schedules (auto-generated inspection events)
├── Work Orders
│   ├── Type: Inspection | Repair | Installation | Emergency
│   ├── Assigned Technician
│   ├── Status: Created → Assigned → En Route → On Site → Complete → Invoiced
│   ├── Inspection Report (field execution output)
│   │   ├── Checklist Results (per equipment type)
│   │   ├── Test Readings (measurements, pass/fail/marginal)
│   │   ├── Findings / Deficiencies
│   │   │   └── Severity: Critical | Major | Minor | Observation
│   │   └── Photos
│   └── Time Tracking
├── Quotes
│   ├── Source: Deficiency | Opportunity | Customer Request
│   └── Line Items (labor, materials, markup)
├── Invoices
│   ├── Source: Completed Work Order | Approved Quote | Recurring Contract
│   └── Payment Status
└── Payments (Stripe + manual)
```

**Multi-tenancy:** Every table carries an `org_id` foreign key. Supabase RLS policies filter all queries by the authenticated user's organization. Tenant data is fully isolated at the database level.

---

## Electrical Compliance Standards

VoltTrack pre-loads compliance rules and inspection templates for the following standards:

| Standard | Scope | Inspection Frequencies |
|----------|-------|----------------------|
| NFPA 70B | Recommended Practice for Electrical Equipment Maintenance | Annual, Quarterly (critical systems) |
| NFPA 70E | Electrical Safety in the Workplace (arc flash, PPE) | Annual audit |
| ANSI/NETA MTS | Maintenance Testing Specifications | Per equipment type and criticality |
| ANSI/NETA ATS | Acceptance Testing Specifications | One-time at commissioning |
| IEEE Std 3007 | Maintenance of Industrial and Commercial Power Systems | Per criticality tier |
| NEC / NFPA 70 | National Electrical Code | Reference for installation compliance |

**Equipment taxonomy (pre-loaded):**

Distribution: Switchgear · Switchboards · Panelboards · Motor Control Centers (MCC) · Busway · Power Distribution Units (PDU)

Protection: Circuit Breakers (LV, MV, HV) · Fuses · Protective Relays · Surge Protection Devices (SPD) · Ground Fault Protection

Transformation: Dry-Type Transformers · Liquid-Filled Transformers · Variable Frequency Drives (VFD) · Uninterruptible Power Supplies (UPS)

Rotating Equipment: Motors · Generators · Transfer Switches (ATS/MTS)

Cables & Conductors: Medium Voltage Cable · Low Voltage Cable · Busduct · Grounding Systems

Other: Emergency Lighting · Arc Flash Labels · Power Quality Monitoring Equipment

---

## Module Breakdown

### Module 1: Core Platform

Multi-tenant SaaS foundation.

- Tenant registration and onboarding (self-serve, under 30 minutes)
- Role-based access control: Admin, Manager, Technician, Sales, Customer
- User invitation and management
- Company branding (logo, colors applied to reports and portal)
- Audit logging for all critical actions
- Supabase Auth with MFA support for Admin role

### Module 2: CRM

Customer and pipeline management.

- Customer master records: company, billing address, service address(es), payment terms, tax status
- Multiple locations per customer with geocoding, site contacts, access instructions, service hours
- Equipment/asset inventory per location: type, manufacturer, model, serial number, QR code, install date, last inspection date
- Contact management: multiple contacts per customer with communication history
- Document storage: contracts, permits, certifications, as-built drawings
- Lead management: capture from web form, manual entry, or import; pipeline stages (New → Contacted → Qualified → Proposal → Won/Lost)
- Opportunity tracking with weighted pipeline value

### Module 3: Contracts

Recurring service agreement management.

- Contract types: Inspection Contract (recurring), Service Contract, Installation Contract, Master Service Agreement
- Contract terms: start/end date, inspection frequency, payment terms, SLAs, termination notice period
- Auto-renewal management: internal alerts at 120/90/60/30 days; customer notifications at 90/60/30 days; automatic renewal if not terminated within notice period
- Service schedule generation: auto-create work orders based on contract frequency and equipment inventory
- Contract revenue tracking: MRR, ACV, TCV; deferred revenue for prepaid annual contracts
- Contract version history and amendment tracking

### Module 4: Scheduling & Dispatch

Compliance calendar and work order assignment.

- Compliance calendar: upcoming inspections from contract schedules, overdue flagging with severity indicators (30/60/90+ days)
- Work order creation from: scheduled inspections (automatic), deficiency repairs (from quote approval), customer service requests, manual creation
- Technician assignment: availability, required certifications, geographic proximity, workload balance
- Customer notifications: 7-day reminder, day-of confirmation with technician details, rescheduling workflow
- Compliance dashboard: % of equipment current, overdue count by customer, upcoming inspection forecast

### Module 5: Field Execution (VoltTrack Core)

The inspection and testing workflow — adapted from the existing VoltTrack build.

- Work order view for technicians: customer info, site access notes, equipment list, previous inspection history
- Pre-loaded inspection checklists by equipment type and applicable standard (NFPA 70B, NETA MTS, Infrared, Power Quality)
- Test readings: measurements with units (V, A, Ω, °C, etc.), pass/fail/marginal/N/A result, notes
- Finding/deficiency capture: description, severity, equipment affected, standard violated, recommended action, photo (minimum 1 required)
- Photo capture: timestamped, GPS-tagged, compressed before upload, queued for background sync
- Digital signature collection from customer contact on-site
- Voice-to-text notes at work order, equipment, or finding level
- Work order status tracking: En Route → On Site → In Progress → Complete

### Module 6: Reporting

Automated report generation and delivery.

- Auto-generate PDF inspection report upon work order completion
- Report contents: customer and location details, technician name and certification numbers, equipment inspected with checklist results, test readings table (color-coded pass/fail/marginal), findings sorted by severity, photos, next inspection due date, compliance statement, company logo and contact info
- Multiple report templates per tenant (customizable via admin UI)
- Automatic delivery to customer contacts via email on completion
- Historical report archive: searchable by date, location, equipment type
- Report branding: logo, color scheme, header/footer, legal disclaimers

### Module 7: Deficiency-to-Revenue

Converting field findings into billable work.

- Deficiency lifecycle: Identified → Quoted → Approved → Scheduled → In Progress → Resolved → Verified
- One-click quote generation from any deficiency or batch of deficiencies at a location
- Pricing rules: per-task pricing, labor + materials + markup, configurable by deficiency type
- Quote approval workflow: internal review, then customer delivery with online acceptance link
- Customer deficiency portal: view photos, descriptions, severity, recommended timeline, approve or decline quotes
- Deficiency dashboard: conversion rate tracking (target 80%+), average quote value, revenue from deficiency work

### Module 8: Billing & Invoicing

From completed work to collected payment.

- Auto-draft invoices from: completed work orders (per contract terms), approved quotes, installation milestones
- Recurring billing: monthly, quarterly, or annual cycles; prorated for partial periods; auto-renew with updated pricing
- Invoice line items: labor, materials, permits, tax (by jurisdiction)
- Payment processing via Stripe: credit card and ACH; online payment via customer portal or email link
- QuickBooks Online bidirectional sync: customers, invoices, payments, chart of accounts mapping
- AR aging dashboard: 0–30, 31–60, 61–90, 90+ days; automated payment reminders (configurable cadence)
- Late fee support: percentage or flat fee

### Module 9: Customer Portal

Self-service access for the contractor's customers.

- Secure login (email/password) with multi-user access per customer account
- View and download inspection reports organized by location and date
- View open deficiencies with photos, severity, and recommended timeline
- Approve or decline deficiency repair quotes online
- View and pay invoices online (credit card or ACH via Stripe)
- View upcoming inspection schedule and request reschedules
- View active contracts and opt out of auto-renewal within notice period

### Module 10: Analytics & Business Intelligence

Operational and financial visibility.

- Executive dashboard: MRR, ACV, revenue by type (inspection vs. repair vs. installation), gross margin by job type, customer retention rate, contract renewal rate, AR aging summary
- Compliance metrics: % of customer equipment current, overdue by customer, inspection completion rate by technician
- Sales pipeline: pipeline value by stage, win rate, average days per stage, forecast vs. quota
- Technician productivity: work orders per day, deficiency identification rate, average time per inspection, customer rating (if enabled)
- Customer lifetime value tracking

---

## AI Automation Layer

VoltTrack's competitive moat is that it doesn't just record what electricians do — it does things for them. Built on the Claude API using the Anthropic Agent SDK, these automation agents run as background processes triggered by platform events.

### Automation Agents

**Report Agent** (triggered: work order marked Complete)
Generates a branded PDF inspection report and emails it to the customer's primary contact. Writes a plain-English executive summary for the customer portal view.

**Deficiency Agent** (triggered: findings saved to work order)
Analyzes technician notes and photos, auto-classifies deficiency severity per NFPA 70B and NETA criteria, drafts professional deficiency descriptions, and creates a draft quote with suggested line items and recommended resolution timeline.

**Compliance Agent** (scheduled: daily at 6am)
Scans all active contracts, generates work orders for inspections due in the next 14 days, sends customer reminder emails at 7-day and 24-hour marks, flags overdue inspections for the operations manager dashboard.

**Renewal Agent** (scheduled: daily)
Monitors contract expiration dates, sends automated renewal notices to customers at 90/60/30 days, flags at-risk accounts (no response at 60 days) for manual outreach by the ops manager.

**AR Agent** (scheduled: daily)
Monitors outstanding invoices, sends automated payment reminders per configurable schedule (invoice sent, 3 days before due, day of due, weekly when overdue), escalates 90+ day accounts to manager.

**Quote Agent** (on-demand)
Given a list of deficiencies, generates a fully priced quote with labor estimates, material line items, markup, and recommended completion timeline. Routes to manager for review before sending to customer.

### Development Methodology

VoltTrack is built using the agency-agents framework (github.com/msitarzewski/agency-agents), deploying specialized AI agents to execute development work:

- **Backend Architect** — database schema, API design, Supabase RLS policies
- **Frontend Developer** — Next.js components, UI implementation, performance
- **Senior Project Manager** — sprint planning, scope management, task conversion from this BRD
- **DevOps Automator** — CI/CD pipeline, Vercel deployment, monitoring
- **Reality Checker** — production readiness gates, quality certification before release

---

## Technical Architecture

**Stack:**
- Next.js 16 (App Router, TypeScript) — web application, customer portal, PDF API endpoints
- Supabase — PostgreSQL, Auth, Storage, Row-Level Security
- Tailwind CSS + shadcn/ui — component library
- Anthropic Claude API + Agent SDK — AI automation layer
- Stripe — payment processing (credit card, ACH)
- QuickBooks Online API — accounting sync
- Resend — transactional email (reports, invoices, notifications, reminders)
- Vercel — hosting and deployment

**Multi-tenancy model:**
Every table carries an `org_id` foreign key. Supabase RLS policies enforce `auth.jwt() ->> 'org_id' = org_id` on all queries. Tenants are fully isolated at the database level. No cross-tenant data access is possible at the application or database layer.

**Schema approach:**
Full rebuild from current report-centric schema. New schema is ERP-first, with `organizations → customers → contracts → work_orders → inspection_reports` as the core hierarchy. The existing test readings, findings, assets, and photos tables are retained but repositioned as children of `work_orders` rather than `test_reports`.

---

## Phasing Plan

### Phase 1 — Core Platform & Field Execution (MVP)

**Goal:** Get value to the first paying customer. A contractor can manage customers, assign work orders, execute inspections in the field, and generate PDF reports.

- Multi-tenant auth with RBAC
- CRM: customers, locations, equipment inventory with QR codes
- Work orders: create, assign, status tracking
- Field execution: inspection checklists (NFPA 70B, NETA, Infrared, Power Quality), test readings, findings, photo upload
- Report generation: PDF with branding, auto-email to customer
- Basic dashboard: today's jobs, open deficiencies, recent reports
- Report Agent (AI): auto-generate report on work order completion

### Phase 2 — Contracts & Compliance Calendar

**Goal:** Replace the spreadsheet. A contractor can manage recurring inspection contracts and never miss a scheduled inspection.

- Contracts: create, terms, frequency settings
- Auto-generate work orders from contract schedules
- Compliance calendar: upcoming inspection view, overdue flagging
- Customer notifications: 7-day and 24-hour reminders
- Compliance Agent (AI): daily schedule generation and customer notifications
- Renewal Agent (AI): contract renewal tracking and customer notifications

### Phase 3 — Deficiency-to-Revenue & Billing

**Goal:** Stop the revenue leakage. Every deficiency becomes a quote. Every completed job becomes an invoice.

- Deficiency lifecycle tracking
- Quote generation from deficiencies (manual + AI-assisted)
- Customer quote approval (email link + portal)
- Invoice generation from completed work orders
- Recurring billing for inspection contracts
- Stripe payment processing
- QuickBooks Online sync
- AR aging dashboard and automated payment reminders
- Deficiency Agent + Quote Agent + AR Agent (AI)

### Phase 4 — Customer Portal & Growth Layer

**Goal:** Delight the contractor's customers and grow the business.

- Customer portal: reports, deficiencies, invoices, quotes, schedule
- CRM pipeline: leads, opportunities, sales dashboard
- Sales Rep role with commission tracking
- Full analytics dashboard: MRR, margins, retention, technician productivity
- Customer lifetime value tracking

### Phase 5 — Mobile & Advanced AI

**Goal:** True field-first experience and deeper automation.

- Progressive Web App (PWA) with offline-first sync for field use
- Barcode/QR scanning for equipment identification
- Route optimization for technician dispatch
- AHJ/utility report submission formatting
- Advanced AI: photo-based deficiency classification, predictive maintenance scoring, dynamic pricing suggestions

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time from inspection completion to report delivery | < 5 minutes (vs. 2–3 days industry average) |
| Deficiency-to-quote conversion rate | 80%+ (vs. 30–40% industry average) |
| Time from deficiency identification to quote sent | < 30 minutes (vs. 30 days industry average) |
| Onboarding time (self-serve) | < 30 minutes to first work order |
| Contract renewal rate for VoltTrack customers | 95%+ |
| Revenue leakage (untracked deficiencies) | < 5% (vs. 30%+ industry average) |
| Pricing | $99–149/tech/month |

---

## Open Questions for Cofounder Review

1. **Mobile priority:** Is a Phase 1 PWA (offline-capable web app) sufficient for field techs, or is a native React Native app required before we can sell to the primary persona?

2. **AI pricing model:** Do we include AI automation in base pricing or tier it (e.g., "VoltTrack Pro" with AI agents at a premium)?

3. **NETA certification data:** Do we pursue a formal data partnership with NETA for pre-loaded MTS templates, or build our own based on the published standards?

4. **QuickBooks vs. full accounting:** For Phase 1, is QuickBooks sync sufficient, or do we need basic invoicing built in before we can launch?

5. **Go-to-market:** Direct sales to contractors, or partner with NETA/NFPA member organizations and electrical trade associations?
