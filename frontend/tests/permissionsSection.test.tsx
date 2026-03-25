import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PermissionsSection } from '../figma/components/case-configuration/sections/PermissionsSection';
import { mockPortalPermissions } from '../figma/storybook/fixtures';

function renderPermissionsSection(options?: {
  portalPermissions?: typeof mockPortalPermissions;
  onSave?: (next: typeof mockPortalPermissions) => Promise<boolean>;
  onReset?: () => void;
}) {
  const onSave = options?.onSave ?? vi.fn(async () => true);
  const onReset = options?.onReset ?? vi.fn();

  const result = render(
    <PermissionsSection
      portalPermissions={options?.portalPermissions ?? mockPortalPermissions}
      defaultPortalPermissions={mockPortalPermissions}
      saving={false}
      onReset={onReset}
      onSave={onSave}
    />
  );

  return {
    ...result,
    onSave,
    onReset,
  };
}

function getSelectForLabelText(labelText: string): HTMLSelectElement {
  const label = screen.getByText(labelText);
  const fieldContainer = label.parentElement;
  if (!fieldContainer) {
    throw new Error(`Missing field container for label: ${labelText}`);
  }

  const select = fieldContainer.querySelector('select');
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`Missing select for label: ${labelText}`);
  }

  return select;
}

describe('PermissionsSection', () => {
  it('is editable by default and no longer requires edit mode', async () => {
    renderPermissionsSection();

    const portalAccessSelect = getSelectForLabelText('Client Portal Access');
    expect(portalAccessSelect).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

    await userEvent.selectOptions(portalAccessSelect, 'read_only');
    expect(portalAccessSelect).toHaveValue('read_only');
  });

  it('keeps unsaved local edits when portal permissions props refresh (polling)', async () => {
    const { rerender } = renderPermissionsSection();

    const portalAccessSelect = getSelectForLabelText('Client Portal Access');
    await userEvent.selectOptions(portalAccessSelect, 'disabled');
    expect(portalAccessSelect).toHaveValue('disabled');

    rerender(
      <PermissionsSection
        portalPermissions={mockPortalPermissions}
        defaultPortalPermissions={mockPortalPermissions}
        saving={false}
        onReset={() => {}}
        onSave={async () => true}
      />
    );

    expect(getSelectForLabelText('Client Portal Access')).toHaveValue('disabled');
    expect(screen.getByText('Unsaved changes. Click “Save Permissions” to apply them.')).toBeInTheDocument();
  });

  it('saves the full draft permissions payload', async () => {
    const onSave = vi.fn(async () => true);
    renderPermissionsSection({ onSave });

    await userEvent.selectOptions(getSelectForLabelText('Client Portal Access'), 'read_only');

    const caseStatusRow = screen.getByText('Case Status').closest('div.flex.items-center.justify-between');
    if (!(caseStatusRow instanceof HTMLElement)) {
      throw new Error('Missing Case Status row');
    }
    await userEvent.click(within(caseStatusRow).getByRole('button', { name: 'Enabled' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save Permissions' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        portal_access: 'read_only',
        show_case_status_progress: false,
      })
    );
  });
});
