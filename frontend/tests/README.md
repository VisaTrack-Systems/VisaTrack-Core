# frontend/tests

This directory contains the frontend test suite for VisaTrack, organized to test UI components, integration scenarios, and utilities. Tests use Vitest (Vite's native test runner) and React Testing Library for component testing, with Storybook integration for visual regression and component snapshot testing.

## Overview

- **[clientDashboard.permissions.test.tsx](clientDashboard.permissions.test.tsx)** - Tests for client dashboard access control and permission-based rendering
- **[storybook.test.tsx](storybook.test.tsx)** - Automated Storybook story rendering tests (verifies all story variants render without errors)
- **[permissionsSection.test.tsx](permissionsSection.test.tsx)** - Tests for role-based permission rendering and UI visibility
- **[relativeTime.test.ts](relativeTime.test.ts)** - Utility function tests for relative time formatting (e.g., "2 hours ago")

## Key Files

- [clientDashboard.permissions.test.tsx](clientDashboard.permissions.test.tsx) - Client dashboard role-based access tests
- [storybook.test.tsx](storybook.test.tsx) - Storybook story automation runner
- [permissionsSection.test.tsx](permissionsSection.test.tsx) - Permission/role UI tests
- [relativeTime.test.ts](relativeTime.test.ts) - Time formatting utility tests

## Getting Started

**Run all tests:**
```bash
npm test
```

**Run specific test file:**
```bash
npm test clientDashboard.permissions.test.tsx
```

**Watch mode (re-run on changes):**
```bash
npm test -- --watch
```

**Generate coverage report:**
```bash
npm test -- --coverage
```

**Run Storybook tests only:**
```bash
npm test storybook.test.tsx
```

## Testing Patterns

**Component Testing with React Testing Library:**
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from '@/figma/components/MyComponent';

describe('MyComponent', () => {
  it('renders and responds to user input', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByRole('button', { name: /submit/i });
    await user.click(button);
    
    expect(screen.getByText(/success/i)).toBeInTheDocument();
  });
});
```

**Permission-Based Tests:**
```typescript
it('renders admin-only section when user has admin role', () => {
  render(<Dashboard user={{ roles: ['admin'] }} />);
  expect(screen.getByText(/admin panel/i)).toBeVisible();
});

it('hides admin section when user lacks permission', () => {
  render(<Dashboard user={{ roles: ['client'] }} />);
  expect(screen.queryByText(/admin panel/i)).not.toBeInTheDocument();
});
```

**Storybook Integration:**
- All Storybook stories are automatically validated to render
- Stories with `play()` functions are executed to test user interactions
- Adds visual regression safety without manual testing

## Test Configuration

- **Vitest Config**: [vitest.config.mts](../vitest.config.mts)
- **Setup File**: [vitest.setup.ts](../vitest.setup.ts) (initializes test environment)
- **Test Timeout**: 5000ms (configurable per test with `it(..., () => {}, 10000)`)

## Best Practices

1. **Accessible Queries**: Use `screen.getByRole()`, `screen.getByLabelText()` instead of selectors
2. **User Events**: Simulate real user interactions with `userEvent` instead of `fireEvent`
3. **Wait for Async**: Use `waitFor()` for async state updates
4. **Avoid Implementation Details**: Test behavior, not implementation
5. **Mock Externals**: Mock API calls and external dependencies

## Related Documentation

- See [../figma/](../figma/) for components being tested
- See [../lib/api.ts](../lib/api.ts) for API functions that tests may mock
- Vitest: https://vitest.dev/
- React Testing Library: https://testing-library.com/react
- Storybook Testing Library: https://storybook.js.org/docs/writing-tests/

