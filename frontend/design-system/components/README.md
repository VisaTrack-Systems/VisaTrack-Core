# frontend/figma/components

This directory contains all reusable React components organized by feature domains, providing the UI building blocks for the VisaTrack application. Each subdirectory represents a major feature area with components, hooks, and stories for that domain.

## Overview

- **active-cases/** - Components for displaying, filtering, and managing active case lists
- **admin-dashboard/** - Admin-specific dashboard components, user management, system settings UI
- **case-configuration/** - Case setup, configuration forms, details sections, and workflow components
- **client-dashboard/** - Client-facing dashboard with case overview, document access, and communications
- **lawyer-dashboard/** - Lawyer-specific dashboard with workload management, task tracking, and analytics

Each subdirectory includes:
- **Functional Components** (`.tsx` files) - React components implementing specific UI features
- **Custom Hooks** (`use*.ts` files) - React hooks for state management and side effects
- **Stories** (`.stories.tsx` files) - Storybook documentation with interactive component examples

## Key Files & Patterns

- Component structure follows atomic design principles: pages > sections > features > shared components
- Each component has a `.tsx` implementation file and typically a `.stories.tsx` documentation file
- Hooks prefixed with `use*` handle complex state logic (e.g., `useClientDashboardData.ts`)
- All components import types and API functions from [../../lib/api.ts](../../lib/api.ts)
- Styling uses Tailwind CSS classes defined in [../../../frontend/app/globals.css](../../app/globals.css)

## Getting Started

To use a component, import it from its subdirectory:
```tsx
import { CaseDetailsSection } from '@/figma/components/case-configuration/sections/CaseDetailsSection';
```

To add new components:
1. Create a `.tsx` file in the appropriate subdirectory
2. Export the component and any supporting hooks
3. Create a `.stories.tsx` file documenting the component with example props
4. Import shared utilities from [../../lib/api.ts](../../lib/api.ts) for data needs

## Related Documentation

- See [../App.tsx](../App.tsx) for root component composition
- See [../../lib/api.ts](../../lib/api.ts) for API types and data fetching functions
- See [../../app/](../../app/) for page-level usage of components
