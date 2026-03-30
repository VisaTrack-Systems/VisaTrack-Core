/** CreateUserForm: createuserform implementation. */

import { FormEvent } from 'react';

import type { AdminCreateUserInput, AdminRoleItem, OrganizationListItem } from '@/lib/api';

type Props = {
  organizations: OrganizationListItem[];
  roles: AdminRoleItem[];
  userForm: AdminCreateUserInput;
  onFormChange: (form: AdminCreateUserInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CreateUserForm({ organizations, roles, userForm, onFormChange, onSubmit }: Props) {
  const set = (patch: Partial<AdminCreateUserInput>) => onFormChange({ ...userForm, ...patch });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Create User</h2>
      <form onSubmit={onSubmit} className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
          <select
            required
            value={userForm.organization_id}
            onChange={(e) => set({ organization_id: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="" disabled>
              Select organization
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            required
            type="text"
            placeholder="First"
            value={userForm.first_name}
            onChange={(e) => set({ first_name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            required
            type="text"
            placeholder="Last"
            value={userForm.last_name}
            onChange={(e) => set({ last_name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            required
            type="email"
            placeholder="first@example.com"
            value={userForm.email}
            onChange={(e) => set({ email: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
          />
        </div>
        {userForm.status !== 'invited' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
            <input
              required
              minLength={8}
              type="password"
              placeholder="Min. 8 characters"
              value={userForm.password}
              onChange={(e) => set({ password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
            <p className="text-sm text-gray-500 mt-2">
              No password needed — the user will set one via the invitation link.
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={userForm.role_slug}
            onChange={(e) => set({ role_slug: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            {roles.length === 0 ? (
              <option value="lawyer">Lawyer</option>
            ) : (
              roles
                .filter((r) => r.slug !== 'super_admin')
                .map((r) => (
                  <option key={r.id} value={r.slug}>
                    {r.name}
                  </option>
                ))
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={userForm.status}
            onChange={(e) => set({ status: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
          >
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="invited">Invited</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
            Create User
          </button>
        </div>
      </form>
    </div>
  );
}
