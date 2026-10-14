/** lawyerDashboard: Component tests for the lawyer dashboard (stats, case panel, quick actions, errors). */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getLawyerCases: vi.fn(),
  getLawyerClients: vi.fn(),
}));

import { getLawyerCases, getLawyerClients } from '@/lib/api';

import { LawyerDashboard } from '../design-system/components/LawyerDashboard';
import { mockLawyerClients } from '../design-system/storybook/fixtures';
import { buildCase, failOnUnmockedNetwork, statValue } from './support/componentTestKit';

failOnUnmockedNetwork();

afterEach(() => {
  cleanup();
});

const cases = [
  buildCase({ case_number: 'C-1001', client_name: 'Jamie Chen', status: 'in_progress', target_filing_date: '2026-12-01' }),
  buildCase({ case_number: 'C-1002', client_name: 'Morgan Singh', case_type: 'Study Permit', status: 'intake' }),
  buildCase({ case_number: 'C-1003', client_name: 'Jamie Chen', status: 'closed' }),
];

function renderDashboard(lawyerName?: string) {
  const handlers = {
    onViewActiveCases: vi.fn(),
    onSelectCase: vi.fn(),
    onCreateCase: vi.fn(),
  };
  render(<LawyerDashboard {...handlers} lawyerName={lawyerName} />);
  return handlers;
}

describe('LawyerDashboard', () => {
  it('CT-LAWYER-01: greets the lawyer by first name', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue([]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    renderDashboard('  Avery   Counsel ');

    expect(screen.getByRole('heading', { name: 'Welcome back, Avery' })).toBeInTheDocument();
    await screen.findByText('No active cases yet.');
  });

  it('CT-LAWYER-02: falls back to "Attorney" without a name', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue([]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    renderDashboard();

    expect(screen.getByRole('heading', { name: 'Welcome back, Attorney' })).toBeInTheDocument();
    await screen.findByText('No active cases yet.');
  });

  it('CT-LAWYER-03: computes stats from cases and the client roster', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    vi.mocked(getLawyerClients).mockResolvedValue(mockLawyerClients);
    renderDashboard('Avery');

    await screen.findByText('Morgan Singh');
    expect(statValue('Active Cases')).toBe('2');
    expect(statValue('Completed Cases')).toBe('1');
    expect(statValue('Upcoming Milestones')).toBe('1');
    expect(statValue('Total Users')).toBe(String(mockLawyerClients.length));
  });

  it('CT-LAWYER-04: counts unique clients from cases when the roster fails to load', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    vi.mocked(getLawyerClients).mockRejectedValue(new Error('forbidden'));
    renderDashboard('Avery');

    await screen.findByText('Morgan Singh');
    expect(statValue('Total Users')).toBe('2');
    expect(screen.queryByText('Failed to load dashboard data.')).not.toBeInTheDocument();
  });

  it('CT-LAWYER-05: prompts to create a first case when there are no clients', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue([]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    renderDashboard('Avery');

    expect(await screen.findByText('No clients found. Create your first case to add a client.')).toBeInTheDocument();
  });

  it('CT-LAWYER-06: searches the active cases panel and opens a case', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    vi.mocked(getLawyerClients).mockResolvedValue(mockLawyerClients);
    const { onSelectCase } = renderDashboard('Avery');
    await screen.findByText('Morgan Singh');

    await user.type(screen.getByRole('textbox', { name: 'Search active cases' }), 'study');
    expect(screen.queryByText('C-1001')).not.toBeInTheDocument();
    await user.click(screen.getByText('C-1002'));
    expect(onSelectCase).toHaveBeenCalledWith('C-1002');

    await user.type(screen.getByRole('textbox', { name: 'Search active cases' }), 'zzz');
    expect(screen.getByText('No cases match your current search/filter.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByRole('textbox', { name: 'Search active cases' })).toHaveValue('');
    expect(screen.getByText('C-1001')).toBeInTheDocument();
  });

  it('CT-LAWYER-07: wires the new-case and view-all actions', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue(cases);
    vi.mocked(getLawyerClients).mockResolvedValue(mockLawyerClients);
    const { onCreateCase, onViewActiveCases } = renderDashboard('Avery');
    await screen.findByText('Morgan Singh');

    await user.click(screen.getByRole('button', { name: 'New Case' }));
    await user.click(screen.getByRole('button', { name: 'Create New Case' }));
    await user.click(screen.getByRole('button', { name: 'View Active Cases' }));
    await user.click(screen.getByRole('button', { name: 'View all cases →' }));

    expect(onCreateCase).toHaveBeenCalledTimes(2);
    expect(onViewActiveCases).toHaveBeenCalledTimes(2);
  });

  it('CT-LAWYER-08: shows an error and reloads on retry', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(cases);
    vi.mocked(getLawyerClients).mockResolvedValue(mockLawyerClients);
    renderDashboard('Avery');

    expect(await screen.findByText('Failed to load dashboard data.')).toBeInTheDocument();
    expect(screen.queryByText('No clients found. Create your first case to add a client.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Morgan Singh')).toBeInTheDocument();
  });
});
