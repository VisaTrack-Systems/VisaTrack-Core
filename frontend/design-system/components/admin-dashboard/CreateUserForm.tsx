/** CreateUserForm: Form for an admin to create a new organization member (active account or emailed invitation). */

import { FormEvent } from 'react';

import type { AdminCreateUserInput, AdminRoleItem, OrganizationListItem } from '@/lib/api';

import { Button, Card, CardHeader, Input, Label, Select } from '../ui';

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
    <Card>
      <CardHeader title="Create User" description="Add a member directly, or invite them to set their own password." />
      <form onSubmit={onSubmit} className="grid gap-4 px-5 py-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor="create-user-organization">Organization</Label>
          <Select
            id="create-user-organization"
            required
            value={userForm.organization_id}
            onChange={(e) => set({ organization_id: e.target.value })}
          >
            <option value="" disabled>
              Select organization
            </option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="create-user-first-name">First Name</Label>
          <Input
            id="create-user-first-name"
            required
            type="text"
            placeholder="First"
            value={userForm.first_name}
            onChange={(e) => set({ first_name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="create-user-last-name">Last Name</Label>
          <Input
            id="create-user-last-name"
            required
            type="text"
            placeholder="Last"
            value={userForm.last_name}
            onChange={(e) => set({ last_name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="create-user-email">Email</Label>
          <Input
            id="create-user-email"
            required
            type="email"
            placeholder="first@example.com"
            value={userForm.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </div>
        {userForm.status !== 'invited' ? (
          <div>
            <Label htmlFor="create-user-password">Temporary Password</Label>
            <Input
              id="create-user-password"
              required
              minLength={8}
              type="password"
              placeholder="Min. 8 characters"
              value={userForm.password}
              onChange={(e) => set({ password: e.target.value })}
            />
          </div>
        ) : (
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700">Temporary Password</p>
            <p className="text-sm text-gray-500">
              No password needed — the user will set one via the invitation link.
            </p>
          </div>
        )}
        <div>
          <Label htmlFor="create-user-role">Role</Label>
          <Select id="create-user-role" value={userForm.role_slug} onChange={(e) => set({ role_slug: e.target.value })}>
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
          </Select>
        </div>
        <div>
          <Label htmlFor="create-user-status">Status</Label>
          <Select id="create-user-status" value={userForm.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="invited">Invited</option>
            <option value="disabled">Disabled</option>
          </Select>
        </div>
        <div className="flex justify-end border-t border-gray-200 pt-4 md:col-span-2 lg:col-span-3">
          <Button type="submit">Create User</Button>
        </div>
      </form>
    </Card>
  );
}
