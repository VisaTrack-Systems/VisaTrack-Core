# Frontend - VisaTrack

This directory contains the frontend web application for VisaTrack, built using Next.js (React) with TypeScript and Tailwind CSS.

The frontend is a responsive web app designed to work on both desktop and mobile browsers.

---

## Reading the Code (Where to Start)

**New to the codebase?** Read these files in order (~20 minutes):

1. **[app/page.tsx](app/page.tsx)** (~20 lines) - Application entry point
2. **[design-system/App.tsx](design-system/App.tsx)** (~500 lines, skim) - Main routing and auth gate
3. **[lib/api.ts](lib/api.ts)** (skim types, ~1100 lines) - API types and client functions
4. **[design-system/components/LawyerDashboard.tsx](design-system/components/LawyerDashboard.tsx)** (~100 lines) - Example dashboard
5. **[tests/storybook.test.tsx](tests/storybook.test.tsx)** (~50 lines) - Component testing pattern
6. **[app/globals.css](app/globals.css)** (~50 lines) - Global styling with Tailwind

Then explore by feature:
- **Login**: `design-system/components/PortalAuthGate.tsx`
- **Case UI**: `design-system/components/CaseConfiguration.tsx`
- **Admin Panel**: `design-system/components/AdminDashboard.tsx`
- **Component Library**: Browse `design-system/components/` directory

📖 **Full guide with diagrams**: See [../CODEBASE_TOUR.md](../CODEBASE_TOUR.md)

---

## Project Structure at a Glance

```
frontend/
├── app/
│   ├── page.tsx         → Application entry point
│   ├── layout.tsx       → Root layout with global providers
│   └── globals.css      → Global styles and Tailwind config
│
├── design-system/       → Component library (design system)
│   ├── App.tsx         → Main routing and authentication logic
│   └── components/
│       ├── AdminDashboard.tsx        → Admin interface
│       ├── LawyerDashboard.tsx       → Lawyer view
│       ├── ClientDashboard.tsx       → Client view
│       ├── CaseConfiguration.tsx     → Case editor
│       ├── PortalAuthGate.tsx        → Login component
│       ├── ActiveCases.tsx           → Case list
│       ├── admin-dashboard/          → Admin sub-components
│       ├── lawyer-dashboard/         → Lawyer sub-components
│       ├── client-dashboard/         → Client sub-components
│       └── figma/                    → UI primitives
│
├── lib/
│   ├── api.ts           → TypeScript types and API client
│   └── download.ts      → File download utilities
│
├── tests/
│   ├── storybook.test.tsx    → Automated component tests
│   └── ...
│
├── public/              → Static assets
└── [config files]       → TypeScript, Next.js, Tailwind config
```

---

## Tech Stack

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS

---

## Structure Overview

- `app/` - Application routes and layouts (App Router)
- `components/` - Reusable UI components
- `hooks/` - Custom React hooks
- `lib/` - API clients, helpers, and utilities
- `public/` - Static assets

---

## Running the Frontend Locally

```bash
npm install
npm run dev
```

The app will be available at:

```text
http://localhost:3000
```

---

## Backend Communication

The frontend communicates with the backend via REST APIs.
The backend base URL is configured using:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Notes

- No direct database access occurs from the frontend
- All sensitive operations are handled by the backend
- Authentication and authorization will be enforced server-side
