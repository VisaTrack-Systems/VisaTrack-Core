import type { Meta, StoryObj } from '@storybook/react';

import { ActiveCasesPanel } from './ActiveCasesPanel';
import { QuickActionsPanel } from './QuickActionsPanel';
import { RecentActivityPanel } from './RecentActivityPanel';
import { StatsGrid } from './StatsGrid';
import { UpcomingDeadlinesPanel } from './UpcomingDeadlinesPanel';
import {
  mockActivityItems,
  mockDashboardCases,
  mockDashboardStats,
  mockDeadlineItems,
} from '../../storybook/fixtures';

const StoryHost = () => null;

const meta = {
  title: 'Components/Lawyer Dashboard',
  component: StoryHost,
  tags: ['autodocs'],
} satisfies Meta<typeof StoryHost>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Stats: Story = {
  render: () => <StatsGrid stats={mockDashboardStats} />,
};

export const ActiveCasesList: Story = {
  render: () => <ActiveCasesPanel cases={mockDashboardCases} onViewActiveCases={() => {}} />,
};

export const RecentActivity: Story = {
  render: () => <RecentActivityPanel activityItems={mockActivityItems} />,
};

export const UpcomingDeadlines: Story = {
  render: () => <UpcomingDeadlinesPanel deadlines={mockDeadlineItems} />,
};

export const QuickActions: Story = {
  render: () => <QuickActionsPanel />,
};
