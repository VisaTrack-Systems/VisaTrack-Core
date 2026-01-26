# Frontend - VisaTrack

This directory contains the frontend web application for VisaTrack, built using Next.js (React) with TypeScript and Tailwind CSS.

The frontend is a responsive web app designed to work on both desktop and mobile browsers.

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

```
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
