/** activeCasesPage: Component tests for the ActiveCases page (loading, summary totals, search/filter, errors and retry). */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getLawyerCases: vi.fn(),
}));

import { getLawyerCases } from '@/lib/api';

import { ActiveCases } from '../design-system/components/ActiveCases';
import { buildCase, displayDate, failOnUnmockedNetwork, statValue } from './support/componentTestKit';

failOnUnmockedNetwork();

afterEach(() => {
  cleanup();
});

const cases = [
  buildCase({ case_number: 'C-1001', client_name: 'Jamie Chen', case_type: 'Work Permit', status: 'in_progress', priority: 'urgent', target_filing_date: '2026-12-01T12:00:00Z' }),
  buildCase({ case_number: 'C-1002', client_name: 'Morgan Singh', case_type: 'Express Entry', status: 'intake', priority: 'high' }),
  buildCase({ case_number: 'C-1003', client_name: 'Taylor Roy', case_type: 'Study Permit', status: 'closed', priority: 'low' }),
];

function renderPage() {
  const onSelectCase = vi.fn();
  const onBack = vi.fn();
  render(<ActiveCases onSelectCase={onSelectCase} onBack={onBack} />);
  return { onSelectCase, onBack };
}

describe('ActiveCases page', () => {
  it('CT-CASES-01: shows a loading state, then the cases and summary totals', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    renderPage();

    expect(screen.getByText('Loading active cases...')).toBeInTheDocument();
    expect(await screen.findByText('Jamie Chen')).toBeInTheDocument();
    expect(getLawyerCases).toHaveBeenCalledWith(100);

    expect(statValue('Total Cases')).toBe('3');
    expect(statValue('High Priority')).toBe('2');

    const firstRow = screen.getByRole('row', { name: /C-1001/ });
    expect(within(firstRow).getByText('In Progress')).toBeInTheDocument();
    expect(within(firstRow).getByText(displayDate('2026-12-01T12:00:00Z'))).toBeInTheDocument();
    expect(within(firstRow).getByText('75%')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /C-1002/ })).getByText('Not set')).toBeInTheDocument();
  });

  it('CT-CASES-02: searches by client name, case type, or case ID', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    renderPage();
    await screen.findByText('Jamie Chen');

    const search = screen.getByRole('textbox', { name: 'Search cases' });
    await user.type(search, 'study');
    expect(screen.getByText('Taylor Roy')).toBeInTheDocument();
    expect(screen.queryByText('Jamie Chen')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'c-1002');
    expect(screen.getByText('Morgan Singh')).toBeInTheDocument();
    expect(screen.queryByText('Taylor Roy')).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'nobody');
    expect(screen.getByText('No cases found matching your search criteria')).toBeInTheDocument();
  });

  it('CT-CASES-03: filters by status', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    renderPage();
    await screen.findByText('Jamie Chen');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'Closed');

    expect(screen.getByText('Taylor Roy')).toBeInTheDocument();
    expect(screen.queryByText('Jamie Chen')).not.toBeInTheDocument();
    expect(screen.queryByText('Morgan Singh')).not.toBeInTheDocument();
  });

  it('CT-CASES-04: opens a case and goes back to the dashboard', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    const { onSelectCase, onBack } = renderPage();

    await user.click(await screen.findByText('Morgan Singh'));
    await user.click(screen.getByRole('button', { name: 'Back to Dashboard' }));

    expect(onSelectCase).toHaveBeenCalledWith('C-1002');
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('CT-CASES-05: shows an error and reloads on retry', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(cases);
    renderPage();

    expect(await screen.findByText('Failed to load active cases.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Jamie Chen')).toBeInTheDocument();
    expect(screen.queryByText('Failed to load active cases.')).not.toBeInTheDocument();
    expect(getLawyerCases).toHaveBeenCalledTimes(2);
  });
});
