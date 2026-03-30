/** App.stories: Storybook story definitions for the main App component. Demonstrates different application states and user roles in isolated UI testing environment. */

import type { Meta, StoryObj } from '@storybook/react';

import App from './App';
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
