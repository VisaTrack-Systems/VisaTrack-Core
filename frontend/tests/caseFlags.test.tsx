/** caseFlags: Personal flags save independently of case navigation, ordering, and administrator views. */

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getLawyerCases: vi.fn(),
  getLawyerClients: vi.fn(),
  setLawyerCaseFlag: vi.fn(),
}));

import { getLawyerCases, getLawyerClients, setLawyerCaseFlag } from '@/lib/api';

import { ActiveCases } from '../design-system/components/ActiveCases';
import { LawyerDashboard } from '../design-system/components/LawyerDashboard';
import { AdminCaseHistory } from '../design-system/components/admin-dashboard/AdminCaseHistory';
import { buildCase, failOnUnmockedNetwork, statValue } from './support/componentTestKit';

failOnUnmockedNetwork();
afterEach(cleanup);

function datedCase(number: string, createdAt: string, isFlagged = false) {
  return buildCase({ case_number: number, client_name: `Client ${number}`, created_at: createdAt, is_flagged: isFlagged });
}

function renderCases(enablePersonalFlags = true) {
  const handlers = { onSelectCase: vi.fn(), onBack: vi.fn() };
  render(<ActiveCases {...handlers} enablePersonalFlags={enablePersonalFlags} />);
  return handlers;
}

function renderDashboard() {
  const handlers = { onSelectCase: vi.fn(), onViewActiveCases: vi.fn(), onCreateCase: vi.fn() };
  render(<LawyerDashboard {...handlers} lawyerName="Avery Counsel" />);
  return handlers;
}

function flagOrder() {
  return screen.getAllByRole('button', { name: /^(?:Flag|Unflag) case / })
    .map(button => button.getAttribute('aria-label')?.replace(/^(?:Flag|Unflag) case /, ''));
}

describe('Personal case flags', () => {
  it('CT-FLAG-01: saving a flag moves its case first without opening the workspace', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-NEW', '2026-10-10T12:00:00Z'),
      datedCase('C-OLD', '2026-01-01T12:00:00Z'),
    ]);
    vi.mocked(setLawyerCaseFlag).mockResolvedValue({ case_number: 'C-OLD', is_flagged: true });
    const { onSelectCase } = renderCases();
    const flag = await screen.findByRole('button', { name: 'Flag case C-OLD' });
    expect(flag).toHaveAttribute('aria-pressed', 'false');
    expect(flagOrder()).toEqual(['C-NEW', 'C-OLD']);

    await user.click(flag);

    expect(setLawyerCaseFlag).toHaveBeenCalledWith('C-OLD', true);
    const saved = await screen.findByRole('button', { name: 'Unflag case C-OLD' });
    expect(saved).toHaveAttribute('aria-pressed', 'true');
    expect(saved).toHaveTextContent('Flagged');
    expect(flagOrder()).toEqual(['C-OLD', 'C-NEW']);
    expect(onSelectCase).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole('row', { name: /C-OLD/ })).getByText('C-OLD', { exact: true }));
    expect(onSelectCase).toHaveBeenCalledWith('C-OLD');
  });

  it('CT-FLAG-02: removing a flag restores newest-first case order', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-OLD', '2026-01-01T12:00:00Z', true),
      datedCase('C-MIDDLE', '2026-05-01T12:00:00Z'),
      datedCase('C-NEW', '2026-10-10T12:00:00Z'),
    ]);
    vi.mocked(setLawyerCaseFlag).mockResolvedValue({ case_number: 'C-OLD', is_flagged: false });
    renderCases();
    await user.click(await screen.findByRole('button', { name: 'Unflag case C-OLD' }));

    expect(setLawyerCaseFlag).toHaveBeenCalledWith('C-OLD', false);
    expect(await screen.findByRole('button', { name: 'Flag case C-OLD' })).toHaveAttribute('aria-pressed', 'false');
    expect(flagOrder()).toEqual(['C-NEW', 'C-MIDDLE', 'C-OLD']);
  });

  it('CT-FLAG-03: a failed save preserves the flag, order, and selected filters', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-NEW', '2026-10-10T12:00:00Z'),
      datedCase('C-OLD', '2026-01-01T12:00:00Z'),
    ]);
    vi.mocked(setLawyerCaseFlag).mockRejectedValue(new Error('Flag service unavailable'));
    const { onSelectCase } = renderCases();
    await screen.findByRole('button', { name: 'Flag case C-OLD' });
    await user.type(screen.getByRole('textbox', { name: 'Search cases' }), 'c-');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'Intake');
    const previousOrder = flagOrder();

    await user.click(screen.getByRole('button', { name: 'Flag case C-OLD' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/flag/i);
    expect(screen.getByRole('button', { name: 'Flag case C-OLD' })).toHaveAttribute('aria-pressed', 'false');
    expect(flagOrder()).toEqual(previousOrder);
    expect(screen.getByRole('textbox', { name: 'Search cases' })).toHaveValue('c-');
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('Intake');
    expect(onSelectCase).not.toHaveBeenCalled();
  });

  it('CT-FLAG-04: an in-flight save disables only its own case flag', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-NEW', '2026-10-10T12:00:00Z'),
      datedCase('C-OLD', '2026-01-01T12:00:00Z'),
    ]);
    let finishSave!: (value: Awaited<ReturnType<typeof setLawyerCaseFlag>>) => void;
    vi.mocked(setLawyerCaseFlag).mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
    renderCases();
    await user.click(await screen.findByRole('button', { name: 'Flag case C-OLD' }));

    expect(screen.getByRole('button', { name: 'Flag case C-OLD' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Flag case C-NEW' })).toHaveAttribute('aria-disabled', 'false');
    await act(async () => { finishSave({ case_number: 'C-OLD', is_flagged: true }); });
    expect(await screen.findByRole('button', { name: 'Unflag case C-OLD' })).toHaveAttribute('aria-disabled', 'false');
    expect(setLawyerCaseFlag).toHaveBeenCalledOnce();
  });

  it('CT-FLAG-05: the shared case page has no personal flag controls by default', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue([datedCase('C-OLD', '2026-01-01T12:00:00Z', true)]);
    render(<ActiveCases onSelectCase={vi.fn()} onBack={vi.fn()} />);

    await screen.findByText('C-OLD', { exact: true });
    expect(screen.queryByRole('button', { name: /^(?:Flag|Unflag) case / })).not.toBeInTheDocument();
    expect(setLawyerCaseFlag).not.toHaveBeenCalled();
  });

  it('CT-FLAG-06: administrator case history does not expose personal flags', async () => {
    vi.mocked(getLawyerCases).mockResolvedValue([datedCase('C-OLD', '2026-01-01T12:00:00Z', true)]);
    render(<AdminCaseHistory onSelectCase={vi.fn()} />);

    await screen.findByText('C-OLD', { exact: true });
    expect(screen.queryByRole('button', { name: /^(?:Flag|Unflag) case / })).not.toBeInTheDocument();
    expect(setLawyerCaseFlag).not.toHaveBeenCalled();
  });

  it('CT-FLAG-07: dashboard flags save and reorder without navigating', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-NEW', '2026-10-10T12:00:00Z'),
      datedCase('C-OLD', '2026-01-01T12:00:00Z'),
    ]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    vi.mocked(setLawyerCaseFlag).mockResolvedValue({ case_number: 'C-OLD', is_flagged: true });
    const { onSelectCase } = renderDashboard();
    await user.click(await screen.findByRole('button', { name: 'Flag case C-OLD' }));

    expect(setLawyerCaseFlag).toHaveBeenCalledWith('C-OLD', true);
    expect(await screen.findByRole('button', { name: 'Unflag case C-OLD' })).toHaveAttribute('aria-pressed', 'true');
    expect(flagOrder()).toEqual(['C-OLD', 'C-NEW']);
    expect(onSelectCase).not.toHaveBeenCalled();
  });

  it('CT-FLAG-08: dashboard keeps every flagged case when there are more than eight', async () => {
    const flagged = Array.from({ length: 9 }, (_, index) => datedCase(
      `C-FLAG-${index + 1}`, `2026-01-${String(index + 1).padStart(2, '0')}T12:00:00Z`, true,
    ));
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-NEW-NORMAL', '2026-10-10T12:00:00Z'),
      ...flagged,
    ]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    renderDashboard();

    await screen.findByRole('button', { name: 'Unflag case C-FLAG-1' });
    expect(screen.getAllByRole('button', { name: /^Unflag case / })).toHaveLength(9);
    expect(flagOrder()).toEqual([...flagged].reverse().map(item => item.case_number));
    expect(screen.queryByRole('button', { name: 'Flag case C-NEW-NORMAL' })).not.toBeInTheDocument();
    expect(statValue('Active Cases')).toBe('10');
  });

  it('CT-FLAG-09: dashboard loads later pages and fills the preview after an older flagged case', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => datedCase(
      `C-NORMAL-${index + 1}`, new Date(Date.UTC(2026, 9, 10, 12) - index * 60_000).toISOString(),
    ));
    vi.mocked(getLawyerCases).mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([datedCase('C-OLDER-FLAG', '2025-01-01T12:00:00Z', true)]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    renderDashboard();

    expect(await screen.findByRole('button', { name: 'Unflag case C-OLDER-FLAG' })).toHaveAttribute('aria-pressed', 'true');
    expect(getLawyerCases).toHaveBeenNthCalledWith(1, 100);
    expect(getLawyerCases).toHaveBeenNthCalledWith(2, 100, 100);
    expect(getLawyerCases).toHaveBeenCalledTimes(2);
    expect(flagOrder()).toEqual(['C-OLDER-FLAG', ...firstPage.slice(0, 7).map(item => item.case_number)]);
    await waitFor(() => { expect(statValue('Active Cases')).toBe('101'); });
  });

  it('CT-FLAG-10: keyboard activation preserves focus through saving and reordering and blocks repeated saves', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-NEW', '2026-10-10T12:00:00Z'),
      datedCase('C-OLD', '2026-01-01T12:00:00Z'),
    ]);
    let finishSave!: (value: Awaited<ReturnType<typeof setLawyerCaseFlag>>) => void;
    vi.mocked(setLawyerCaseFlag).mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
    const { onSelectCase } = renderCases();
    const flag = await screen.findByRole('button', { name: 'Flag case C-OLD' });
    flag.focus();

    await user.keyboard('{Enter}');
    expect(flag).toHaveFocus();
    expect(flag).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Enter} ');
    expect(setLawyerCaseFlag).toHaveBeenCalledOnce();
    expect(onSelectCase).not.toHaveBeenCalled();

    await act(async () => { finishSave({ case_number: 'C-OLD', is_flagged: true }); });
    expect(await screen.findByRole('button', { name: 'Unflag case C-OLD' })).toHaveFocus();
    expect(flagOrder()).toEqual(['C-OLD', 'C-NEW']);
  });

  it('CT-FLAG-11: finishing a save does not steal focus after the user tabs away', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-NEW', '2026-10-10T12:00:00Z'),
      datedCase('C-OLD', '2026-01-01T12:00:00Z'),
    ]);
    let finishSave!: (value: Awaited<ReturnType<typeof setLawyerCaseFlag>>) => void;
    vi.mocked(setLawyerCaseFlag).mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
    renderCases();
    (await screen.findByRole('button', { name: 'Flag case C-OLD' })).focus();
    await user.keyboard('{Enter}');
    await user.tab({ shift: true });
    const otherFlag = screen.getByRole('button', { name: 'Flag case C-NEW' });
    expect(otherFlag).toHaveFocus();

    await act(async () => { finishSave({ case_number: 'C-OLD', is_flagged: true }); });
    await screen.findByRole('button', { name: 'Unflag case C-OLD' });
    expect(otherFlag).toHaveFocus();
  });

  it('CT-FLAG-12: unflagging a focused case outside the recent preview moves focus to dashboard search', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-OLD', '2025-01-01T12:00:00Z', true),
      ...Array.from({ length: 8 }, (_, index) => datedCase(
        `C-NORMAL-${index + 1}`, new Date(Date.UTC(2026, 9, 10, 12) - index * 60_000).toISOString(),
      )),
    ]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    vi.mocked(setLawyerCaseFlag).mockResolvedValue({ case_number: 'C-OLD', is_flagged: false });
    renderDashboard();
    (await screen.findByRole('button', { name: 'Unflag case C-OLD' })).focus();

    await user.keyboard('{Enter}');

    await waitFor(() => { expect(screen.queryByRole('button', { name: /^(?:Flag|Unflag) case C-OLD$/ })).not.toBeInTheDocument(); });
    expect(screen.getByRole('textbox', { name: 'Search active cases' })).toHaveFocus();
    expect(flagOrder()).toHaveLength(8);
  });

  it('CT-FLAG-13: removing an unflagged preview row does not steal focus from another case', async () => {
    const user = userEvent.setup();
    vi.mocked(getLawyerCases).mockResolvedValue([
      datedCase('C-OLD', '2025-01-01T12:00:00Z', true),
      ...Array.from({ length: 8 }, (_, index) => datedCase(
        `C-NORMAL-${index + 1}`, new Date(Date.UTC(2026, 9, 10, 12) - index * 60_000).toISOString(),
      )),
    ]);
    vi.mocked(getLawyerClients).mockResolvedValue([]);
    let finishSave!: (value: Awaited<ReturnType<typeof setLawyerCaseFlag>>) => void;
    vi.mocked(setLawyerCaseFlag).mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
    renderDashboard();
    (await screen.findByRole('button', { name: 'Unflag case C-OLD' })).focus();
    await user.keyboard('{Enter}');
    await user.tab();
    const nextCase = screen.getByRole('button', { name: /Client C-NORMAL-1\b/ });
    expect(nextCase).toHaveFocus();

    await act(async () => { finishSave({ case_number: 'C-OLD', is_flagged: false }); });

    await waitFor(() => { expect(screen.queryByRole('button', { name: /^(?:Flag|Unflag) case C-OLD$/ })).not.toBeInTheDocument(); });
    expect(nextCase).toHaveFocus();
    expect(screen.getByRole('textbox', { name: 'Search active cases' })).not.toHaveFocus();
  });
});
