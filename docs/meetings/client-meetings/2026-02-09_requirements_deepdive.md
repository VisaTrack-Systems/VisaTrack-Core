# Client Meeting #2 - System Requirements & Specifications Deep-Dive

## Meeting Information

**Date:** February 9, 2026  
**Time:** 4:30 PM  
**Duration:** 2 hours  
**Location:** Virtual (Zoom)  
**Meeting Type:** Requirements & Specifications Review  
**Facilitator:** Patrick Bonini  
**Note-taker:** Mayoor

## Attendees

**VisaTrack Team:**
- Umer Qamar - Backend Lead
- Patrick Bonini - Frontend Lead
- Pavel Karmaker - DevOps/Infrastructure
- Ronit Mehta - Full-Stack Developer

**Client/Stakeholders:**
- Margaret Chen - Immigration Consulting Firm Director
- James Rodriguez - Senior Immigration Consultant

## Pre-Meeting Context

**Purpose of meeting:** Deep-dive into system requirements, features, and detailed specifications for VisaTrack  
**Background:** Follow-up to initial January 23rd introductions; client has had time to prepare detailed requirements with completed questionnaire  
**Materials shared:** Client requirements questionnaire responses, current workflow documentation, sample case files, organizational chart showing user roles

## Agenda

1. Detailed system requirements review
2. Core feature discussion (case management, documents, notifications, etc.)
3. User role workflows (client, lawyer, admin)
4. Technical requirements and constraints
5. Timeline and delivery milestones
6. Next steps and development planning

## Discussion Summary

### Case Management Requirements

**Client Feedback/Requirements:**
- Track case type (work visa, family sponsorship, temporary resident permit, etc.)
- Status tracking: Initial consultation → Document collection → Application submission → In Review → Approved/Denied
- Three primary user roles: Client (view-only access), Lawyer (full case management), Admin (organization control)
- Historical notes and timeline for each case showing all actions taken
- Automated reminder system for approaching deadlines and document submission dates

**Team Response:**
- Confirmed case status model matches legal workflow requirements
- Proposed SQLAlchemy ORM with case status as enumerated type
- Discussed role-based access control (RBAC) implementation using JWT tokens
- Confirmed MVP will include all three core user roles and views

**Clarifications Needed:** [Any ambiguities]

### Document Management Requirements

**Client Feedback/Requirements:**
- Need to upload multiple document types per case (ITA letter, passport scan, medical exam, job offer, etc.)
- Documents should be organized by suites (e.g., "Proof of Identity", "Work History", "Financial Records")
- Clients should only see documents they're required to submit; lawyers see all
- Template library needed for common document types with checklists
- Audit trail showing when documents were accessed by which user

**Team Response:**
- Proposed AWS S3 for document storage with KMS encryption
- Document suite model with RBAC permissions controlling visibility
- Versioning supported: multiple uploads of same document retain history
- Activity logging table to track all access and modifications
- Pre-signed URLs for secure temporary download links

**Clarifications Needed:** [Any questions to follow up on]

### Communication & Notifications

**Client Feedback/Requirements:**
- Email notifications when documents are requested from client
- Email when case status changes
- In-app reminders for upcoming deadlines (30 days, 7 days, 1 day before)
- Appointment scheduling: clients need ability to request consultations; lawyers confirm
- SMS option for urgent notifications (to be explored)

**Team Response:**
- Email notifications via SendGrid integration
- Reminders table with cron job scheduler for automated triggers
- Calendar integration with appointment booking modal
- MVP will include email and in-app notifications; SMS deferred to future phase

### User Workflows

**Client Feedback/Requirements:**
- Lawyers need dashboard showing their assigned cases with priority/urgency indicators
- Clients need portal with assigned cases, required documents, and communication history
- Admins need to: invite users, assign cases to lawyers, manage organization settings, view activity logs
- No formal approval workflows initially - but case status updates should be trackable
- Multi-tenant support: clients can have multiple consultant firms representing them (future enhancement)

**Team Response:**
- Confirmed role-based access control with three tiers: Client, Lawyer, Admin
- Dashboard layouts customized per role
- Permission model: role → permissions → can access resource
- Multi-tenancy via organization_id foreign key on all entities

## Key Requirements/Feedback

| Requirement | Client Priority | Team Assessment | Status |
|-------------|-----------------|-----------------|--------|
| Case tracking & status updates | High | Feasible | To be implemented |
| Document management system | High | Feasible | To be implemented |
| Client notifications & reminders | High | Feasible | To be implemented |
| Role-based access control | High | Feasible | To be implemented |
| Multi-user appointment booking | Medium | Feasible | To be implemented (Phase 2) |
| Activity log & audit trail | Medium | Feasible | To be implemented |
| Bulk operations (for lawyers) | Low | Will defer | Future enhancement |

## Change Requests / New Features Identified

| Feature/Requirement | Description | Est. Effort | Priority | Status |
|-------------------|-----------|-------------|----------|--------|
| [Feature 1] | [Description] | [Story points] | High/Med/Low | To be scoped |
| [Requirement 2] | [Description] | [Story points] | High/Med/Low | To be scoped |

## Action Items

| Item | Owner (Team/Client) | Due Date | Status |
|------|---------------------|----------|--------
| Team to create detailed technical specifications | Team | February 16 | In Progress |
| Client to review and approve requirements document | Client | February 23 | Not Started |
| Identify any missing requirements | Team/Client | February 20 | Not Started |
| Schedule design review meeting | Team | February 20 | Not Started |

## Decisions Made

- **Requirement Prioritization:** High-priority features identified for MVP scope
- **Technical Approach:** Discussed backend architecture and database schema approach
- **Timeline:** Proposed development timeline and delivery milestones
- **Communication:** Established regular weekly/bi-weekly sync cadence

## Outstanding Questions / Clarifications Needed

- [X] **Question 1:** Can clients see information about other clients? - *Answered by: Client (No - each case is isolated)*
- [X] **Question 2:** How should lawyers export case data? - *Answered by: Client (PDF export for case summary)*
- [X] **Question 3:** What happens after case closure? - *Answered by: Client (Archive, don't delete)*

## Timeline & Next Steps

1. Team to finalize technical specifications by February 16, 2026
2. Client to review and approve specifications by February 23, 2026
3. Development team to begin implementation of Phase 1 features by February 24, 2026
4. Schedule follow-up meeting for March 9, 2026 to review progress
5. Plan for client demo/feedback session in late March (final client meeting)

## Next Meeting

**Scheduled:** March 9, 2026 at 4:30 PM (demo of initial features)  
**Topics to cover:** Development status, any blockers, demo of initial features  
**Deliverables to review:** Technical specifications, initial prototype/mockups

## Client Satisfaction / Feedback

**Overall meeting outcome:** Excellent - detailed requirements gathering successful, clear alignment on MVP scope  
**Client satisfaction level:** 5/5 - Very impressed with team's technical understanding and proactive suggestions  

## Follow-Up Communication

- [X] Detailed meeting notes and decisions shared with client by: February 10, 2026
- [ ] Technical specifications document shared by: February 16, 2026
- [ ] Development timeline and roadmap shared by: February 16, 2026

## Additional Notes

This meeting covered the essential requirements for the MVP (Minimum Viable Product). The client was highly engaged and provided specific, actionable feedback. James Rodriguez was particularly excited about the document management and RBAC capabilities. The team has a comprehensive understanding of the scope and architectural patterns needed. Development can proceed confidently with these requirements locked in.

---

**Document version:** 1  
**Last updated:** February 9, 2026  
**Distribution:** Internal Team / Client Shared
