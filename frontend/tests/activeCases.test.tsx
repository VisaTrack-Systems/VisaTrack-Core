/** activeCases: Component tests for the active-cases FilterBar, CasesTable, and status/priority helpers. */

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CasesTable } from '../design-system/components/active-cases/CasesTable';
import { FilterBar } from '../design-system/components/active-cases/FilterBar';
import type { UiCase } from '../design-system/components/active-cases/types';
import {
  completionFromStatus,
  priorityTone,
  statusTone,
  titleize,
} from '../design-system/components/active-cases/utils';
import { mockUiCases } from '../design-system/storybook/fixtures';

function renderFilterBar(overrides?: Partial<Parameters<typeof FilterBar>[0]>) {
  const props = {
    searchTerm: '',
    filterStatus: 'all',
    onSearchTermChange: vi.fn(),
    onFilterStatusChange: vi.fn(),
    ...overrides,
  };
  render(<FilterBar {...props} />);
  return props;
}

describe('FilterBar', () => {
  it('CT-LIST-01: reports search input changes', () => {
    const { onSearchTermChange } = renderFilterBar();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search cases' }), {
      target: { value: 'Jordan' },
    });

    expect(onSearchTermChange).toHaveBeenCalledWith('Jordan');
  });

  it('CT-LIST-02: reports status filter changes', async () => {
    const user = userEvent.setup();
    const { onFilterStatusChange } = renderFilterBar();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'Closed');

    expect(onFilterStatusChange).toHaveBeenCalledWith('Closed');
  });

  it('CT-LIST-03: hides the lawyer filter unless options and a handler are provided', () => {
    renderFilterBar({ lawyerOptions: ['Alex Lawyer'] });

    expect(screen.queryByRole('combobox', { name: 'Filter by lawyer' })).not.toBeInTheDocument();
  });

  it('CT-LIST-04: lists lawyer options and reports lawyer filter changes', async () => {
    const user = userEvent.setup();
    const { onFilterLawyerChange } = renderFilterBar({
      lawyerOptions: ['Alex Lawyer', 'Avery Counsel'],
      onFilterLawyerChange: vi.fn(),
    });

    const lawyerSelect = screen.getByRole('combobox', { name: 'Filter by lawyer' });
    expect(lawyerSelect).toHaveValue('all');
    expect(within(lawyerSelect).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'All Lawyers',
      'Alex Lawyer',
      'Avery Counsel',
    ]);

    await user.selectOptions(lawyerSelect, 'Avery Counsel');
    expect(onFilterLawyerChange).toHaveBeenCalledWith('Avery Counsel');
  });
});

describe('CasesTable', () => {
  it('CT-LIST-05: renders one row per case with its details', () => {
    render(<CasesTable filteredCases={mockUiCases} onSelectCase={vi.fn()} />);

    // Header row plus one row per case.
    expect(screen.getAllByRole('row')).toHaveLength(mockUiCases.length + 1);

    const firstRow = screen.getByRole('row', { name: /C-2026-001/ });
    expect(within(firstRow).getByText('Express Entry')).toBeInTheDocument();
    expect(within(firstRow).getByText('HIGH')).toBeInTheDocument();
    expect(within(firstRow).getByText('2 docs')).toBeInTheDocument();
    expect(within(firstRow).getByText('1 payment')).toBeInTheDocument();
    expect(within(firstRow).getByText('68%')).toBeInTheDocument();
  });

  it('CT-LIST-06: pluralizes payments and shows "All clear" when nothing is outstanding', () => {
    const cases: UiCase[] = [
      { ...mockUiCases[0], id: 'C-PLURAL', outstandingDocs: 0, outstandingPayments: 3 },
      { ...mockUiCases[0], id: 'C-CLEAR', outstandingDocs: 0, outstandingPayments: 0 },
    ];
    render(<CasesTable filteredCases={cases} onSelectCase={vi.fn()} />);

    const pluralRow = screen.getByRole('row', { name: /C-PLURAL/ });
    expect(within(pluralRow).getByText('3 payments')).toBeInTheDocument();
    expect(within(pluralRow).queryByText(/docs/)).not.toBeInTheDocument();

    const clearRow = screen.getByRole('row', { name: /C-CLEAR/ });
    expect(within(clearRow).getByText('All clear')).toBeInTheDocument();
  });

  it('CT-LIST-07: opens a case when its row is clicked', async () => {
    const user = userEvent.setup();
    const onSelectCase = vi.fn();
    render(<CasesTable filteredCases={mockUiCases} onSelectCase={onSelectCase} />);

    await user.click(screen.getByText('C-2026-002'));

    expect(onSelectCase).toHaveBeenCalledWith('C-2026-002');
  });

  it('CT-LIST-08: shows an empty state when no cases match', () => {
    render(<CasesTable filteredCases={[]} onSelectCase={vi.fn()} />);

    expect(screen.getByText('No cases found matching your search criteria')).toBeInTheDocument();
  });
});

describe('active-cases utils', () => {
  it('CT-LIST-09: titleizes snake_case values', () => {
    expect(titleize('awaiting_client')).toBe('Awaiting Client');
    expect(titleize('in_progress')).toBe('In Progress');
    expect(titleize('closed')).toBe('Closed');
  });

  it.each([
    ['closed', 100],
    ['in_progress', 75],
    ['awaiting_client', 45],
    ['intake', 15],
    ['something_else', 50],
  ])('CT-LIST-10: maps status %s to %i%% complete', (status, expected) => {
    expect(completionFromStatus(status)).toBe(expected);
  });

  it.each([
    ['Awaiting Client', 'warning'],
    ['In Progress', 'primary'],
    ['Closed', 'success'],
    ['Intake', 'neutral'],
  ])('CT-LIST-11: maps status %s to the %s tone', (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });

  it.each([
    ['urgent', 'danger'],
    ['high', 'danger'],
    ['medium', 'warning'],
    ['low', 'success'],
    ['unknown', 'neutral'],
  ])('CT-LIST-12: maps priority %s to the %s tone', (priority, tone) => {
    expect(priorityTone(priority)).toBe(tone);
  });
});
