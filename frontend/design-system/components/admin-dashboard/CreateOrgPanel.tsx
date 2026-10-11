/** CreateOrgPanel: Super-admin form to create an organization, alongside the list of existing organizations. */

import { FormEvent } from 'react';

import type { AdminCreateOrganizationInput, OrganizationListItem } from '@/lib/api';

import { Badge, Button, Card, CardHeader, Input, Label, Select } from '../ui';
import type { ConfirmDialogState } from './types';
import { formatDate } from './utils';

type Props = {
  organizations: OrganizationListItem[];
  orgForm: AdminCreateOrganizationInput;
  onFormChange: (form: AdminCreateOrganizationInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busyOrganizationId: string | null;
  currentUserOrgId: string | undefined;
  openConfirm: (opts: ConfirmDialogState) => void;
  onDeleteOrganization: (org: OrganizationListItem) => void;
};

export function CreateOrgPanel({
  organizations,
  orgForm,
  onFormChange,
  onSubmit,
  busyOrganizationId,
  currentUserOrgId,
  openConfirm,
  onDeleteOrganization,
}: Props) {
  const set = (patch: Partial<AdminCreateOrganizationInput>) => onFormChange({ ...orgForm, ...patch });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader title="Create Organization" />
        <form onSubmit={onSubmit} className="space-y-4 px-5 py-4">
          <div>
            <Label htmlFor="create-org-name">Organization Name</Label>
            <Input
              id="create-org-name"
              required
              type="text"
              value={orgForm.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="create-org-email">Contact Email</Label>
            <Input
              id="create-org-email"
              required
              type="email"
              value={orgForm.contact_email}
              onChange={(e) => set({ contact_email: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="create-org-slug">Slug</Label>
            <Input
              id="create-org-slug"
              required
              type="text"
              value={orgForm.slug}
              onChange={(e) => set({ slug: e.target.value })}
              placeholder="acme-immigration"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="create-org-tier">Tier</Label>
              <Select
                id="create-org-tier"
                value={orgForm.subscription_tier}
                onChange={(e) => set({ subscription_tier: e.target.value })}
              >
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-org-status">Status</Label>
              <Select
                id="create-org-status"
                value={orgForm.subscription_status}
                onChange={(e) => set({ subscription_status: e.target.value })}
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end border-t border-gray-200 pt-4">
            <Button type="submit">Create Organization</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Organizations" />
        <ul className="divide-y divide-gray-200">
          {organizations.map((org) => (
            <li key={org.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{org.name}</p>
                <p className="truncate text-xs text-gray-500">
                  {org.slug} • {org.contact_email}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatDate(org.created_at)}</span>
                  <Badge tone={org.subscription_status === 'active' ? 'success' : 'neutral'}>
                    {org.subscription_status}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="danger-subtle"
                  size="sm"
                  disabled={busyOrganizationId === org.id || currentUserOrgId === org.id}
                  onClick={() =>
                    openConfirm({
                      title: 'Delete Organization',
                      message: `Delete "${org.name}"? This will block all logins for this organization and cannot be undone.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                      onConfirm: () => onDeleteOrganization(org),
                    })
                  }
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
