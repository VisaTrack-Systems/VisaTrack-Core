# VisaTrack: Immigration Case Management System

**Course:** SEG4910 | **Version:** 1.0 | **Date:** March 30, 2026

---

## 🎯 START HERE

**👉 New to this project? Read [CODEBASE_TOUR.md](CODEBASE_TOUR.md)**

This guide provides a structured walkthrough of the codebase (30 min read) with:
- ✅ Architecture explanation with diagrams
- ✅ Guided reading order for key files
- ✅ Feature and design deep dives
- ✅ Code quality assessment

**For immediate context:** Continue reading below (5 min).

---

## What is VisaTrack?

VisaTrack centralizes visa case management for immigration consulting firms. It replaces fragmented email/spreadsheet workflows with a secure, real-time system where:

**For Consultants:**
- Unified dashboard for case management
- Document storage and version control
- Client and case organization
- Automated reminders and appointments
- Real-time activity tracking

**For Clients:**
- Track visa application progress
- Upload required documents
- Receive reminders and updates
- Book follow-up appointments
- Full transparency into their case

**End Result:** Faster case resolution, fewer errors, better client experience.

---

## 🏗️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js + TypeScript + Tailwind CSS | Responsive web interface for consultants & clients |
| **Backend** | FastAPI + Python | RESTful API with role-based access control |
| **Database** | PostgreSQL | Multi-tenant relational data (users, cases, documents) |
| **Storage** | AWS S3 + KMS | Encrypted document storage with presigned URLs |
| **Auth** | JWT Tokens | Stateless authentication with scrypt password hashing |

**Key Features:**
- ✅ Role-based access control (super_admin, org_admin, lawyer, client)
- ✅ Multi-tenant architecture (isolated organizations)
- ✅ Audit logging (all user actions tracked)
- ✅ Modern security practices (encryption, secure tokens, input validation)

## 👥 Team

| Name | Primary Role | Responsibilities |
|------|--------------|------------------|
| **Umer Qamar** | Backend & Database Lead | FastAPI architecture, PostgreSQL schema, ORM models, API design, infrastructure support |
| **Patrick Bonini** | Tech Lead - Lawyer Component & DevOps | Lawyer portal development, component library architecture, design system leadership, Docker/CI-CD infrastructure, full-stack co-leadership |
| **Mayoor** | Full-Stack Developer | Full-stack support across frontend, backend, and database, admin component implementation |
| **Ronit Mehta** | Full-Stack Developer | Full-stack support across frontend, backend, and database, client portal implementation |
| **Pavel Karmaker** | Project Administration | Meeting coordination, documentation management, action item tracking, project communication |

*All team members adapted multiple software engineering roles as needed for the full-stack development.*

## 📋 Features & Goals

**Core Features:**
- Secure user authentication (JWT-based, role-based access control)
- Client profile and case management dashboards
- Encrypted document upload and storage (AWS S3 + KMS)
- Real-time application status tracking
- Automated reminders and appointment scheduling
- Comprehensive audit logging for compliance

**Success Criteria:**
- End-to-end workflows function reliably
- Multi-user support without data corruption
- Sensitive data secured with encryption and access control
- Deployable MVP for small consulting firms
- Well-documented, extensible codebase

---

**Full feature breakdown and implementation details:** See [CODEBASE_TOUR.md](CODEBASE_TOUR.md#-the-features) or [SECURITY.md](SECURITY.md)

## 🏛️ Architecture Overview

**Four-Layer Design:**

1. **Frontend** (Next.js + TypeScript) — User interface for consultants and clients
2. **API** (FastAPI) — RESTful endpoints with role-based access control
3. **Services** (Python) — Business logic (RBAC, audit logging, encryption, storage)
4. **Database** (PostgreSQL + S3) — Secure data persistence and document storage

**Diagram:**

![VisaTrack Architecture](./docs/assets/architecture_overview.png)

For detailed architecture breakdown, see [CODEBASE_TOUR.md](CODEBASE_TOUR.md#-the-architecture)

---

## 📚 Project Structure

```
VisaTrack-Core/
├── frontend/                  # Next.js web application
│   ├── design-system/         # React components and pages
│   ├── lib/                   # API client and utilities
│   └── tests/                 # Vitest unit tests
├── backend/                   # FastAPI application
│   ├── app/
│   │   ├── api/              # Route handlers
│   │   ├── core/             # Auth, config, security
│   │   ├── db/               # Database layer
│   │   ├── models/           # ORM models
│   │   ├── schemas/          # Validation schemas
│   │   └── services/         # Business logic
│   ├── alembic/              # Database migrations
│   └── tests/                # Pytest test suite
├── Database/                  # SQL schema definitions
├── docs/                      # Architecture and design docs
└── scripts/                   # Development helpers
```

**Starting Points:**
- **Backend:** See [backend/README.md](backend/README.md) for entry points
- **Frontend:** See [frontend/README.md](frontend/README.md) for entry points
- **Full Tour:** See [CODEBASE_TOUR.md](CODEBASE_TOUR.md) for guided 30-min walkthrough

## 5. Anticipated Risks

### 5.1 Engineering Challenges

What technical hurdles do you expect? (e.g., Learning a new API, data synchronization issues).

Security and Compliance:

- Especially dealing with sensitive user data, we need to implement robust encryption for immigration documents (at rest and in transit)
- Meeting data privacy regulations (GDPR, CCPA, or any Canadian-laws (isolated to Canada for now?)) for handling personal identification documents
- Building secure authentication with role-based access controls to separate client and consultant views

Intelligent Form-Filling Module:

- One idea we’ve had from the onset is to use some automation to help users fill out applications. In order to do so, we need to train and fine-tune models to accurately extract structured data from varied document formats (passports, birth certificates, employment letters, university degrees)
- Mapping extracted data to correct fields across different form types and handling form version changes

Data Management:

- Designing a flexible database schema that can accommodate changing immigration requirements across multiple countries
- Manage document versioning and audit trails (keep track of documents and changes to uploaded documents)

### 5.2 Mitigation Strategies

How will you handle these risks if they occur?

- Apply industry best practices for authentication, encryption, and access control
- Incremental development with frequent testing
- Start with a minimal, extensible schema and refactor as needed
- Treat intelligent automation as an optional enhancement, not a core dependency

## 6. Legal and Social Issues

### Privacy & Security

- User data will be encrypted in transit and access-controlled
- Only authorized users can view specific case data
- No unnecessary personal data will be collected

### Licensing

The project will use the MIT License to allow flexibility and future expansion

### Social Impact

The system aims to improve accessibility and transparency for users navigating complex immigration processes
UI design will consider clarity and usability for non-technical users

## 7. Initial Plans

### 7.1 Tool Setup

Version Control: GitHub
Project Management: GitHub Issues & GitHub Projects
Documentation: README.md and GitHub Wiki (if needed)
Communication: Team

### 7.2 First Release Plan

Describe the "MVP" (Minimum Viable Product). What will be functional by the first milestone?

The first release will focus on a functional Minimum Viable Product (MVP):

- User authentication (client & consultant)
- Basic client profile creation
- Case creation and status tracking
- Document upload and storage
- Consultant dashboard for managing cases

This MVP establishes the foundation for future iterations and advanced features.
