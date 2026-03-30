# frontend/lib

This directory contains utility libraries and helper functions for the Next.js frontend, including TypeScript type definitions and API client abstractions. It provides centralized functions for HTTP communication, file downloading, and shared types used across multiple components and pages, reducing code duplication and ensuring consistent data handling patterns.

## Overview

- **[api.ts](api.ts)** - Comprehensive API client (~1110 lines) with TypeScript type definitions for all backend entities (DashboardOverview, CaseListItem, User, Organization, etc.) and HTTP request functions for CRUD operations on cases, users, organizations, and dashboards
- **[download.ts](download.ts)** - Utility functions for client-side file downloading and document export operations

## Key Files

- [api.ts](api.ts) - TypeScript type definitions for backend response models and API client functions (fetch wrappers with authentication, error handling, type safety)
- [download.ts](download.ts) - `downloadFile()`, `downloadCSV()`, `downloadPDF()` helper functions for client-side document export

## Getting Started

Import type definitions and API functions from [api.ts](api.ts) in components. For example, `import { DashboardOverview, fetchDashboard } from '@/lib/api'` provides types and data-fetching function. Ensure API endpoints match the backend [../../../backend/app/api/routes/](../../../backend/app/api/routes/) structure. Use [download.ts](download.ts) utilities to trigger file downloads from components handling document export operations. All API functions should include error handling and optional loading states for component feedback.

## Related Documentation

- See [../app/](../app/) for page components using these utilities
- See [../figma/components/](../figma/components/) for components consuming api.ts types and functions
- See [../../../backend/app/api/](../../../backend/app/api/) for backend endpoint structure
