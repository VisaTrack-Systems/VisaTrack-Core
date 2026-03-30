# frontend/app

This directory contains the Next.js App Router application structure for the VisaTrack client-side interface. It defines the root layout, styling, and page organization using Next.js 13+ conventions where each subdirectory implicitly creates routes, providing a modular, file-based routing system for the immigration case management dashboard.

## Overview

- **[layout.tsx](layout.tsx)** - Root layout component wrapping all pages with shared navigation, styling, and global state providers
- **[page.tsx](page.tsx)** - Home/dashboard landing page component
- **[globals.css](globals.css)** - Global stylesheet with CSS variables, Tailwind directives, and base element styles
- **[favicon.ico](favicon.ico)** - Application favicon

## Key Files

- [layout.tsx](layout.tsx) - Root RootLayout component providing HTML metadata, fonts, and global UI providers
- [page.tsx](page.tsx) - HomePage or dashboard entry point rendering user welcome/dashboard content
- [globals.css](globals.css) - Tailwind CSS configuration, theme variables, and base styles for the entire application

## Getting Started

The Next.js App Router automatically creates routes from the file structure. To add a new page, create a `.tsx` file or `page.tsx` in a subdirectory (e.g., `app/cases/page.tsx` creates `/cases` route). The [layout.tsx](layout.tsx) wraps all pages with shared components and styling. Review [globals.css](globals.css) for available CSS variables and utility classes (Tailwind), then import shared layouts or components from [../figma/components/](../figma/components/) for consistent UI.

## Related Documentation

- See [../figma/](../figma/) for reusable component library and design system documentation
- See [../lib/api.ts](../lib/api.ts) for API client functions for data fetching
- Next.js App Router guide: https://nextjs.org/docs/app
