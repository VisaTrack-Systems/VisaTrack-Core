# frontend/figma

This directory houses the design system and reusable React component library for the VisaTrack frontend application. It implements a collection of UI components that follow modern design patterns, accessibility standards, and responsive design principles. Components are documented using Storybook for isolated development and visual testing.

## Overview

**Top-Level Components**
- **[App.tsx](App.tsx)** - Main application routing and authentication gateway; renders role-based dashboard views (admin, lawyer, client)
- **[PortalAuthGate.tsx](PortalAuthGate.tsx)** - Authentication form component for login
- **[AdminDashboard.tsx](AdminDashboard.tsx)** - System administration interface
- **[LawyerDashboard.tsx](LawyerDashboard.tsx)** - Lawyer/consultant case management dashboard
- **[ClientDashboard.tsx](ClientDashboard.tsx)** - Client portal for tracking cases and documents
- **[ActiveCases.tsx](ActiveCases.tsx)** - Active cases list view with filtering
- **[CaseConfiguration.tsx](CaseConfiguration.tsx)** - Case editing interface
- **[NewCaseDialog.tsx](NewCaseDialog.tsx)** - Case creation form dialog
- **[ProfileSettingsDialog.tsx](ProfileSettingsDialog.tsx)** - User settings and profile management

**Organized Subdirectories**
- **[components/](components/)** - Feature-organized reusable sub-components:
  - **active-cases/** - Components for case list display and filtering
  - **admin-dashboard/** - Admin-specific UI modules (MembersTable, CreateUserForm, etc.)
  - **case-configuration/** - Case editing and configuration UI (dialogs, sections, forms)
  - **client-dashboard/** - Client portal components (DocumentChecklistPanel, MilestonesPanel, etc.)
  - **lawyer-dashboard/** - Lawyer dashboard components (StatsGrid, ActiveCasesPanel, RecentActivityPanel, etc.)
  - **figma/** - Low-level UI primitives and utilities

- **[storybook/](storybook/)** - Storybook configuration and mock API implementation
- **[App.stories.tsx](App.stories.tsx)** - Interactive component stories for development

## Key Files

- [App.tsx](App.tsx) - Entry point for role-based routing; coordinates authentication state
- [AdminDashboard.tsx](AdminDashboard.tsx) - System and organization management interface
- [LawyerDashboard.tsx](LawyerDashboard.tsx) - Lawyer case workload and management
- [ClientDashboard.tsx](ClientDashboard.tsx) - Client case tracking interface
- [components/](components/) - Modular sub-components organized by feature area

## Getting Started

**Development with Storybook:**
```bash
npm run storybook
# Opens at http://localhost:6006
```

**Adding a New Component:**
1. Create component file in appropriate subdirectory: `frontend/figma/components/MyComponent.tsx`
2. Add JSDoc comment block explaining purpose and usage
3. Create corresponding Storybook story: `MyComponent.stories.tsx`
4. Import and use in dashboard components

**Component Template:**
```tsx
/**
 * MyComponent: Brief description of purpose.
 * Used for [use case]. Key props: [prop names].
 */

export function MyComponent({ prop1, prop2 }: Props) {
  return (
    // JSX implementation
  );
}
```

**Testing Components:**
- Components tested via Storybook plays (interactive tests)
- Integration tests in [../../tests/](../../tests/)
- All components use TypeScript for type safety
- Styling uses Tailwind CSS classes for consistency

## Design System

- Color scheme defined in [../app/globals.css](../app/globals.css)
- Tailwind CSS for responsive, utility-first styling
- Lucide React for consistent icon library
- Component composition for maximum reuse
- Props validation with TypeScript interfaces

## Related Documentation

- See [../](../) for Next.js App Router and page structure
- See [../../lib/api.ts](../../lib/api.ts) for API client types and functions
- See [../../../../backend/](../../../../backend/) for backend API that feeds dashboard data
- Storybook: https://storybook.js.org/
- React: https://react.dev/
- Tailwind CSS: https://tailwindcss.com/
- [storybook/](storybook/) - Storybook configuration for component interactive documentation
- [App.tsx](App.tsx) - Root component composition and feature routing
- [App.stories.tsx](App.stories.tsx) - Storybook story documentation for the App component

## Getting Started

Browse components in each subdirectory of [components/](components/) and review `.stories.tsx` files for usage examples. Run Storybook with `npm run storybook` to interactively explore components and their variations. New components should be created in the appropriate feature directory and exported with a corresponding `.stories.tsx` file for documentation. Import components into pages from [../app/](../app/) to build complete UI surfaces.

## Related Documentation

- See [../lib/api.ts](../lib/api.ts) for API integration patterns when building data-driven components
- See [../app/](../app/) for page-level composition of components
- Storybook documentation: https://storybook.js.org/
