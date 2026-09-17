/** App.stories: Storybook story definitions for the main App component. Demonstrates different application states and user roles in isolated UI testing environment. */

import type { Meta, StoryObj } from '@storybook/react';

import App from './App';
import {
  mockCaseWorkspace,
  mockCurrentUserLawyer,
  mockLawyerCases,
} from './storybook/fixtures';
import { jsonRoute } from './storybook/mockApi';

const meta = {
  title: 'App/App Shell',
  component: App,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    mockApi: [jsonRoute('GET', '/api/v1/auth/me', { detail: 'Authentication required' }, 401)],
  },
} satisfies Meta<typeof App>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LandingPage: Story = {};

export const AuthenticatedCounselWorkspace: Story = {
  parameters: {
    mockApi: [
      jsonRoute('GET', '/api/v1/auth/me', mockCurrentUserLawyer),
      jsonRoute('GET', '/api/v1/lawyer/cases', mockLawyerCases),
      jsonRoute('GET', '/api/v1/ai/capabilities', {
        chat_enabled: true,
        form_drafts_enabled: false,
        credential_management_allowed: true,
        reason: null,
      }),
      jsonRoute('GET', '/api/v1/cases/by-number/C-2026-001/workspace', mockCaseWorkspace),
      jsonRoute('GET', '/api/v1/ai/providers', []),
      jsonRoute('GET', '/api/v1/ai/cases/C-2026-001/chats', []),
      jsonRoute('GET', '/api/v1/ai/cases/C-2026-001/form-drafts', []),
    ],
  },
};
