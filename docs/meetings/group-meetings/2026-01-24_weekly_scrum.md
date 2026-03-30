# Weekly Team Scrum - January 24, 2026

## Meeting Information

**Date:** January 24, 2026 (Friday)  
**Time:** 3:00 PM  
**Duration:** 1 hour  
**Location:** Zoom  
**Facilitator:** Umer Qamar  
**Note-taker:** Pavel Karmaker

## Attendees

- Umer Qamar - Full-Stack Developer
- Mayoor - Full-Stack Developer
- Patrick Bonini - Full-Stack Developer
- Pavel Karmaker - Full-Stack Developer
- Ronit Mehta - Full-Stack Developer

## Agenda

1. Team kickoff and role confirmation
2. Repository and infrastructure setup
3. Technical stack finalization
4. Database schema planning
5. First week priorities

## Discussion Summary

### Status Updates

**Team Member Updates:**
- Umer Qamar (Tech Lead - Backend/Full-Stack): Repository initialized with base structure, PostgreSQL schema design started with 15 planned tables, initial ERD completed, Alembic migration framework integrated
- Patrick Bonini (Tech Lead - Lawyer Component & DevOps): Figma design system started with component library (buttons, cards, forms designed), Tailwind CSS configured with project color palette, Docker setup with PostgreSQL container, GitHub Actions CI/CD pipeline initiated
- Pavel Karmaker (Project Administration): Project documentation structure established, meeting templates created, GitHub project board configured, communication channels set up (Slack, GitHub discussions)
- Mayoor (Admin Component/Backend): Environment configuration complete, reviewed all project requirements, ORM pattern research completed, ready for SQLAlchemy data layer implementation
- Ronit Mehta (Client Component/Frontend): Development environment fully configured on Mac and Linux, FastAPI documentation reviewed, frontend tooling (Next.js, Vitest) set up and tested

### Major Accomplishments

- ✅ Team onboarded and roles assigned
- ✅ Repository structure established (backend/, frontend/, Database/, docs/)
- ✅ All environments operational on local machines
- ✅ Database schema designed with proper entity relationships
- ✅ Technical stack agreed: FastAPI + PostgreSQL + React/Next.js + Tailwind CSS

### Decisions Made

- **Backend:** FastAPI with SQLAlchemy ORM and Alembic for migrations
- **Frontend:** Next.js 16 with TypeScript and Tailwind CSS
- **Database:** PostgreSQL 14 with Alembic versioning
- **Auth:** JWT with access/refresh token pattern (7-day access, 30-day refresh)
- **Infrastructure:** Docker for all environments, GitHub Actions for CI/CD
- **Testing:** pytest for backend, Vitest for frontend

### Role Responsibilities Confirmed

- **Umer:** Backend APIs, database setup/optimization, DevOps support
- **Patrick:** Lawyer component UI, design system leadership, Docker/CI-CD infrastructure
- **Ronit:** Client component UI, frontend integration
- **Mayoor:** Admin component, data layer/ORM
- **Pavel:** Project administration, meeting coordination, documentation management

### Blockers and Resolutions

**Database Version:**
- Issue: PostgreSQL version mismatch between team members
- Resolution: Standardize on PostgreSQL 14 (Patrick to provide docker-compose by tomorrow)

**Design System:**
- Issue: Figma tokens not yet extracted
- Resolution: Patrick to extract and document design tokens by Monday

**API Planning:**
- Issue: Need agreed endpoint structure before scaffolding
- Resolution: Team to define auth endpoints spec by Tuesday

## Action Items

| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| Standardize PostgreSQL 14 config | Pavel | Jan 25 | In Progress |
| Complete database schema finalization | Umer | Jan 27 | In Progress |
| Design token library extraction | Patrick | Jan 27 | Not Started |
| Auth endpoints specification | Umer, Ronit | Jan 28 | Not Started |
| Component library MVP (12 components) | Patrick | Jan 31 | Not Started |
| API scaffolding (auth, users, cases) | Ronit, Mayoor | Feb 3 | Not Started |

## Team Metrics & Velocity

- Week Type: Infrastructure/Setup
- Features Completed: 0 (planning phase)
- Infrastructure Tasks: 7/7 complete
- Team Synchronization: Excellent
- Expected Velocity Week 2: 18-22 story points

## Risks & Mitigation

- **Medical leave pending:** Pavel may need limited availability starting early February; Umer ready to cover DevOps
- **Component library scope:** Design system may grow; plan MVP for first release
- **API design complexity:** Permission system will require upfront planning

## Next Week Focus

1. Complete database schema with all migrations
2. Implement JWT authentication middleware
3. Scaffold core API endpoints (users, auth, cases)
4. Release design token library
5. Begin component implementation
6. First health-check endpoint deployment
