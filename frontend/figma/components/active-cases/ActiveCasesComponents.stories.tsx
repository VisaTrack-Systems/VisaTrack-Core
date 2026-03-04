import type { Meta, StoryObj } from '@storybook/react';

import { CasesTable } from './CasesTable';
import { FilterBar } from './FilterBar';
import { SummaryCards } from './SummaryCards';
import { mockUiCases } from '../../storybook/fixtures';

const StoryHost = () => null;

const meta = {
  title: 'Components/Active Cases',
  component: StoryHost,
  tags: ['autodocs'],
} satisfies Meta<typeof StoryHost>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Filters: Story = {
  render: () => (
    <FilterBar
      searchTerm="Jordan"
      filterStatus="all"
      onSearchTermChange={() => {}}
      onFilterStatusChange={() => {}}
    />
  ),
};

export const Summary: Story = {
  render: () => <SummaryCards cases={mockUiCases} />,
};

export const Table: Story = {
  render: () => <CasesTable filteredCases={mockUiCases} onSelectCase={() => {}} />,
};

export const EmptyTable: Story = {
  render: () => <CasesTable filteredCases={[]} onSelectCase={() => {}} />,
};
