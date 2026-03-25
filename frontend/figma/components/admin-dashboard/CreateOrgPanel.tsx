import { FormEvent } from 'react';

import type { AdminCreateOrganizationInput, OrganizationListItem } from '@/lib/api';

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
    <div className="grid lg:grid-cols-2 gap-8">
      <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Create Organization</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
          <input
            required
            type="text"
            value={orgForm.name}
            onChange={(e) => set({ name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
          <input
            required
            type="email"
            value={orgForm.contact_email}
            onChange={(e) => set({ contact_email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input
            required
            type="text"
            value={orgForm.slug}
            onChange={(e) => set({ slug: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
            placeholder="acme-immigration"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
            <select
              value={orgForm.subscription_tier}
              onChange={(e) => set({ subscription_tier: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={orgForm.subscription_status}
              onChange={(e) => set({ subscription_status: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
          Create Organization
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Organizations</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {organizations.map((org) => (
            <div key={org.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{org.name}</p>
                  <p className="text-sm text-gray-600">
                    {org.slug} • {org.contact_email}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">{formatDate(org.created_at)}</p>
                  <p className="text-xs font-medium text-green-700">{org.subscription_status}</p>
                  <button
                    type="button"
                    className="mt-2 border border-red-200 text-red-700 px-3 py-1 rounded-lg text-xs hover:bg-red-50 disabled:opacity-50"
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
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
