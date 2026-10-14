/** appShell: Component tests for the signed-in AppShell frame, sidebar items, and PageHeader. */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Briefcase, Home } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { AppShell, PageHeader, SidebarGroup, SidebarNavItem } from '../design-system/components/AppShell';

function renderShell(userName = 'Avery Counsel') {
  const onOpenProfile = vi.fn();
  const onSignOut = vi.fn();
  const onNavigate = vi.fn();
  render(
    <AppShell
      navigation={
        <SidebarGroup label="Workspace">
          <SidebarNavItem label="Dashboard" icon={Home} active onClick={() => onNavigate('dashboard')} />
          <SidebarNavItem label="Cases" icon={Briefcase} active={false} onClick={() => onNavigate('cases')} />
        </SidebarGroup>
      }
      topBarActions={<button type="button">Switch role</button>}
      userName={userName}
      userSubtitle="Lawyer"
      onOpenProfile={onOpenProfile}
      onSignOut={onSignOut}
    >
      <p>Page content</p>
    </AppShell>
  );
  return { onOpenProfile, onSignOut, onNavigate };
}

describe('AppShell', () => {
  it('CT-SHELL-01: renders page content, top bar actions, and the signed-in user', () => {
    renderShell();

    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch role' })).toBeInTheDocument();
    expect(screen.getByText('Avery Counsel')).toBeInTheDocument();
    expect(screen.getByText('AC')).toBeInTheDocument();
  });

  it('CT-SHELL-02: marks the active navigation item as the current page', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderShell();

    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Cases' })).not.toHaveAttribute('aria-current');

    await user.click(within(nav).getByRole('button', { name: 'Cases' }));
    expect(onNavigate).toHaveBeenCalledWith('cases');
  });

  it('CT-SHELL-03: opens the profile and signs out from the account controls', async () => {
    const user = userEvent.setup();
    const { onOpenProfile, onSignOut } = renderShell();

    await user.click(screen.getByRole('button', { name: 'Profile' }));
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));

    expect(onOpenProfile).toHaveBeenCalledOnce();
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('CT-SHELL-04: opens and closes the mobile navigation drawer', async () => {
    const user = userEvent.setup();
    renderShell();

    const toggle = screen.getByRole('button', { name: 'Open navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(2);

    // Choosing a destination closes the drawer.
    await user.click(within(screen.getAllByRole('navigation', { name: 'Main' })[1]).getByRole('button', { name: 'Cases' }));
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(1);
  });

  it('CT-SHELL-05: falls back to "?" initials for a blank name', () => {
    renderShell('   ');

    expect(screen.getByText('?')).toBeInTheDocument();
  });
});

describe('PageHeader', () => {
  it('CT-SHELL-06: renders the title, description, actions, and extra content', () => {
    render(
      <PageHeader title="Active Cases" description="All open matters" actions={<button type="button">New Case</button>}>
        <div>Tabs</div>
      </PageHeader>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Active Cases' })).toBeInTheDocument();
    expect(screen.getByText('All open matters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Case' })).toBeInTheDocument();
    expect(screen.getByText('Tabs')).toBeInTheDocument();
  });
});
