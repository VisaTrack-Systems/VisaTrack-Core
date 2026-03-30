# Codebase Tour for Faculty Review

**For professors unfamiliar with the VisaTrack project:** This guide provides a structured path through the codebase to understand architecture, design decisions, and implementation quality. Estimated reading time: 30 minutes.

---

## 🎯 5-Minute Quick Start

**Start here to understand the project in under 5 minutes:**

1. **[README.md](README.md)** - What problem does VisaTrack solve? (problem statement, users, tech stack)
2. **Architecture Diagram** - See [docs/assets/architecture_overview.png](docs/assets/architecture_overview.png)
3. **[AUDIT_REPORT.md](AUDIT_REPORT.md)** - What improvements were made? (grading readiness assessment)

---

## 📚 30-Minute Deep Dive

### Part 1: Business Context (5 minutes)

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Problem, team, objectives, success criteria |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and team process |
| [docs/meetings/README.md](docs/meetings/README.md) | Project decision history and notes |

**Key Takeaway:** VisaTrack centralizes visa case management for consultants and clients, replacing fragmented email/spreadsheet workflows with a secure, real-time tracking system.

---

### Part 2: Architecture & Design (10 minutes)

#### Understanding the Stack

| Layer | Technology | Read First |
|-------|-----------|-----------|
| **Frontend** | Next.js + TypeScript + Tailwind | [frontend/README.md](frontend/README.md) |
| **Backend** | FastAPI + Python + PostgreSQL | [backend/README.md](backend/README.md) |
| **Storage** | AWS S3 + KMS encryption | [backend/app/services/storage.py](backend/app/services/storage.py) |
| **Auth** | JWT tokens + role-based access | [backend/app/core/security.py](backend/app/core/security.py) |

#### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Pages (app/)                                       │   │
│  │  ↓                                                  │   │
│  │  Design System (design-system/) - Reusable components│  │
│  │  ↓                                                  │   │
│  │  API Client (lib/api.ts) - TypeScript types        │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────────────────────────────┘
           │ HTTP + JWT Token
┌──────────▼──────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Routes (api/routes/) - Endpoints by domain        │   │
│  │  ↓                                                  │   │
│  │  Schemas (schemas/) - Request/response validation  │   │
│  │  ↓                                                  │   │
│  │  Services (services/) - Business logic & RBAC      │   │
│  │  ↓                                                  │   │
│  │  Models (models/) - Database ORM definitions       │   │
│  │  ↓                                                  │   │
│  │  Database (db/) - PostgreSQL session management    │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────────────────────────────┘
           │ SQL
┌──────────▼──────────────────────────────────────────────────┐
│          DATA LAYER (PostgreSQL + AWS S3)                  │
│  - Users, cases, documents, permissions                     │
│  - Encrypted audit logs & activity tracking                │
└──────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**
- ✅ **Layered Architecture**: Clear separation (Routes → Schemas → Services → Models → DB)
- ✅ **Type Safety**: TypeScript frontend, Python type hints throughout backend
- ✅ **Security**: JWT tokens, role-based access control, encrypted storage
- ✅ **Testability**: Dependency injection enables easy mocking

---

### Part 3: Reading the Code (15 minutes)

#### Backend (Python/FastAPI)

**Start here (order matters):**

1. **[backend/app/main.py](backend/app/main.py)** (20 lines)
   - FastAPI app initialization
   - CORS middleware setup
   - Shows how routes are included

2. **[backend/app/api/router.py](backend/app/api/router.py)** (15 lines)
   - Central aggregation point for all endpoints
   - Prefixed with `/api/v1`
   - Shows domain organization: auth, cases, users, etc.

3. **[backend/app/api/routes/auth.py](backend/app/api/routes/auth.py)** (~350 lines)
   - Login with email + password
   - JWT token generation and refresh
   - Invitation acceptance flow
   - Shows authentication pattern used throughout

4. **[backend/app/core/security.py](backend/app/core/security.py)** (~130 lines)
   - Password hashing with scrypt (modern, secure)
   - JWT token creation/validation
   - Cryptographic utilities for invitations
   - **Design highlight**: Uses scrypt fallback to PBKDF2 for environment compatibility

5. **[backend/app/services/rbac.py](backend/app/services/rbac.py)** (~175 lines)
   - Role-based access control implementation
   - Permission checking functions
   - System role definitions (super_admin, org_admin, lawyer, client)
   - **Design highlight**: Flexible permission system supporting custom roles

6. **[backend/app/api/routes/cases.py](backend/app/api/routes/cases.py)** (~3200 lines, skim it)
   - Largest route file (case management is core feature)
   - Shows comprehensive CRUD, status transitions, document handling
   - Demonstrates complex business logic in one feature

7. **[backend/tests/conftest.py](backend/tests/conftest.py)** (~60 lines)
   - Pytest fixtures for test data
   - Mock user and auth context builders
   - Shows how tests are structured

**Key Insights:**
- Routes are thin wrappers around business logic
- Services handle permission checks and complex operations
- All endpoints use dependency injection for auth and DB
- Comprehensive input validation (Pydantic schemas)

---

#### Frontend (TypeScript/React)

**Start here (order matters):**

1. **[frontend/app/page.tsx](frontend/app/page.tsx)** (20 lines)
   - Application entry point
   - Dynamically imports main App component
   - Shows Next.js App Router pattern

3. **[frontend/design-system/App.tsx](frontend/design-system/App.tsx)** (~500 lines, skim it)
   - Main authentication gate and route logic
   - Determines which dashboard to show based on user role
   - State management for current user and view
   - Imports all dashboard components

3. **[frontend/lib/api.ts](frontend/lib/api.ts)** (~1100 lines, skim it)
   - TypeScript type definitions for all API responses
   - API client functions (fetch wrappers with auth)
   - Shows type safety from backend to frontend
   - **Design highlight**: Centralized API client prevents fetch duplication

4. **[frontend/design-system/components/AdminDashboard.tsx](frontend/design-system/components/AdminDashboard.tsx)** (~500 lines, skim it)
   - Complex dashboard with multiple panels
   - User/organization management
   - Shows component composition and state management

5. **[frontend/design-system/components/LawyerDashboard.tsx](frontend/design-system/components/LawyerDashboard.tsx)** (95 lines)
   - Simpler example than AdminDashboard
   - Shows case list, stats, recent activity
   - Good example of reusable panel components

6. **[frontend/lib/download.ts](frontend/lib/download.ts)** (60 lines)
   - File download utility with CORS handling
   - **Design highlight**: Includes detailed strategy documentation
   - Example of thoughtful error handling

**Key Insights:**
- Components are organized by dashboard/feature area
- Centralized API client prevents duplication
- Strong TypeScript typing ensures correctness
- Reusable components (panels, dialogs) maximize DRY principle

---

## 🔐 Understanding Key Features

### Authentication & Authorization

**Files to Review:**
1. [backend/app/api/routes/auth.py](backend/app/api/routes/auth.py) - Login endpoint
2. [backend/app/core/security.py](backend/app/core/security.py) - Token generation
3. [backend/app/api/deps/auth.py](backend/app/api/deps/auth.py) - JWT validation
4. [backend/app/services/rbac.py](backend/app/services/rbac.py) - Permission checks

**How It Works:**
1. User logs in with organization slug + email + password
2. Backend validates credentials and generates JWT token (expires in 60 min)
3. Frontend stores token in localStorage
4. All subsequent requests include `Authorization: Bearer <token>` header
5. Backend validates token and extracts user + permissions
6. Endpoints check permissions before executing business logic

**Security Features:**
- ✅ Scrypt password hashing (PBKDF2 fallback)
- ✅ JWT tokens with expiration
- ✅ Role-based access control (system roles + custom roles)
- ✅ Per-endpoint permission checks
- ✅ Activity audit logging

---

### Case Management

**Files to Review:**
1. [backend/app/models/case.py](backend/app/models/case.py) - Case data model
2. [backend/app/api/routes/cases.py](backend/app/api/routes/cases.py) - Case endpoints (very comprehensive!)
3. [frontend/design-system/components/CaseConfiguration.tsx](frontend/design-system/components/CaseConfiguration.tsx) - Case UI
4. [backend/app/schemas/case.py](backend/app/schemas/case.py) - Case validation schemas

**Key Operations:**
- Create case with client, lawyer, dates, priority
- Update case status (intake → in_progress → closed)
- Upload documents per case
- Track milestones (key dates and phases)
- Assign cases to lawyers
- Generate case summaries and exports

---

### Document Management

**Files to Review:**
1. [backend/app/services/storage.py](backend/app/services/storage.py) - S3 + KMS integration
2. [frontend/lib/download.ts](frontend/lib/download.ts) - Cross-origin file downloads
3. [backend/app/api/routes/cases.py](backend/app/api/routes/cases.py) - Document upload/download endpoints

**Key Features:**
- ✅ S3 storage with KMS encryption at rest
- ✅ Presigned URLs for temporary access (15-min expiration)
- ✅ CORS-aware download strategy
- ✅ Document versioning support

---

## 🧪 Testing & Quality Assurance

### Backend Tests

**Entry Point:** [backend/tests/conftest.py](backend/tests/conftest.py)

**Test Organization:**
```
backend/tests/
├── api/routes/          → Test each endpoint (auth, cases, users, etc.)
├── services/            → Test business logic (RBAC, audit, storage)
├── models/              → Test ORM models (relationships, constraints)
├── db/                  → Test database layer (session management)
├── schemas/             → Test Pydantic validation
└── main/                → Test FastAPI setup
```

**Running Tests:**
```bash
cd backend/
pytest                          # All tests
pytest tests/api/routes/        # Specific folder
pytest --cov                    # With coverage report
```

**Key Test Patterns:**
- Fixtures for users, auth contexts, mock data
- Database isolation (rollback after each test)
- Mocked external services (S3, email)

---

### Frontend Tests

**Test Files:** [frontend/tests/](frontend/tests/)

**Test Organization:**
- Component tests with React Testing Library
- Storybook automated tests
- Permission-based rendering tests
- Utility function tests

**Running Tests:**
```bash
npm test                        # All tests
npm test -- --watch            # Watch mode
npm test --coverage            # Coverage report
```

---

## 📋 Code Quality Metrics

| Aspect | Status | Evidence |
|--------|--------|----------|
| **Type Safety** | ✅ Excellent | 100% TypeScript frontend, Python type hints |
| **Documentation** | ✅ Excellent | Every file has comment header; all dirs have README |
| **Testing** | ✅ Good | Comprehensive pytest suite; Storybook tests |
| **Security** | ✅ Strong | Scrypt hashing, JWT tokens, role-based access, audit logging |
| **Code Organization** | ✅ Excellent | Clear layering (routes → services → models) |
| **Performance** | ✅ Good | Connection pooling, async handlers, presigned URLs |

---

## 🎯 Key Files Summary

### Must-Read (10 files, ~30 minutes)

1. [README.md](README.md) - Project context
2. [backend/app/main.py](backend/app/main.py) - Backend entry
3. [backend/app/api/router.py](backend/app/api/router.py) - Route aggregation
4. [backend/app/core/security.py](backend/app/core/security.py) - Authentication
5. [backend/app/services/rbac.py](backend/app/services/rbac.py) - Authorization
6. [frontend/app/page.tsx](frontend/app/page.tsx) - Frontend entry
7. [frontend/design-system/App.tsx](frontend/design-system/App.tsx) - Main component
8. [frontend/lib/api.ts](frontend/lib/api.ts) - API client (skim type definitions)
9. [backend/tests/conftest.py](backend/tests/conftest.py) - Test setup
10. [AUDIT_REPORT.md](AUDIT_REPORT.md) - Grading readiness

### Should-Read (domain-specific, 20-60 minutes each)

- **Authentication Deep Dive**: [backend/app/api/routes/auth.py](backend/app/api/routes/auth.py)
- **Case Management**: [backend/app/api/routes/cases.py](backend/app/api/routes/cases.py) + [backend/app/models/case.py](backend/app/models/case.py)
- **Admin Dashboard**: [frontend/design-system/components/AdminDashboard.tsx](frontend/design-system/components/AdminDashboard.tsx)
- **Row-Level Security**: [backend/app/services/rbac.py](backend/app/services/rbac.py)

### Nice-to-Read (specific interests)

- **Data Model**: Browse [backend/app/models/](backend/app/models/) directory
- **API Schemas**: Browse [backend/app/schemas/](backend/app/schemas/) directory
- **Component Library**: Browse [frontend/design-system/components/](frontend/design-system/components/) directory
- **Meeting Notes**: [docs/meetings/](docs/meetings/)

---

## 💡 Common Questions

**Q: How is the system structured?**
A: Layered architecture - thin route handlers delegate to services, which use models for database access. Frontend imports types from backend API responses.

**Q: How is security handled?**
A: JWT tokens for authentication, role-based access control with per-endpoint permission checks, scrypt password hashing, activity audit logging.

**Q: Why PostgreSQL?**
A: Relational data (users, cases, documents) with ACID guarantees. Supports complex queries for case analytics and reporting.

**Q: How do tests work?**
A: Pytest for backend (fixtures provide mock users/auth), Vitest + React Testing Library for frontend (component tests + Storybook automation).

**Q: Is sensitive data encrypted?**
A: Yes - passwords are hashed (scrypt), documents in S3 use KMS encryption, JWT tokens are signed but not encrypted (only contain claims).

**Q: Can the system scale?**
A: Yes - database connection pooling, async route handlers, stateless JWT tokens enable horizontal scaling.

---

## 📞 Further Reading

- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **Next.js App Router**: https://nextjs.org/docs/app
- **SQLAlchemy ORM**: https://docs.sqlalchemy.org/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **JWT Tokens**: https://tools.ietf.org/html/rfc7519
- **Role-Based Access Control**: https://en.wikipedia.org/wiki/Role-based_access_control

---

**Last Updated:** March 30, 2026  
**Repository Status:** Ready for Faculty Review ✅
