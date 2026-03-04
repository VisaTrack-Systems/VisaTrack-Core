import { Briefcase, Building2, CheckCircle2, RefreshCw, Shield, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  type AdminCreateOrganizationInput,
  type AdminRoleItem,
  type AdminCreateUserInput,
  type AdminOverview,
  type OrganizationListItem,
  type UserListItem,
  createAdminOrganization,
  createAdminUser,
  getAdminOrganizations,
  getAdminOverview,
  getAdminRoles,
  getAdminUsers,
} from '@/lib/api';

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type FlashState = {
  kind: 'success' | 'error';
  message: string;
} | null;

const initialOrgForm: AdminCreateOrganizationInput = {
  name: '',
  contact_email: '',
  slug: '',
  subscription_tier: 'basic',
  subscription_status: 'active',
};

const initialUserForm: AdminCreateUserInput = {
  organization_id: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  status: 'active',
  role_slug: 'lawyer',
};

export function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);

  const [orgForm, setOrgForm] = useState(initialOrgForm);
  const [userForm, setUserForm] = useState(initialUserForm);

  const loadAdminData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [overviewData, organizationsData, usersData, rolesData] = await Promise.all([
        getAdminOverview(),
        getAdminOrganizations(100),
        getAdminUsers(200),
        getAdminRoles(),
      ]);

      setOverview(overviewData);
      setOrganizations(organizationsData);
      setUsers(usersData);
      setRoles(rolesData);
      setError(null);

      if (!userForm.organization_id && organizationsData.length > 0) {
        setUserForm((previous) => ({
          ...previous,
          organization_id: organizationsData[0].id,
        }));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAdminData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(
    () => [
      {
        label: 'Organizations',
        value: overview?.stats.organizations ?? 0,
        icon: Building2,
        color: 'text-blue-700 bg-blue-100',
      },
      {
        label: 'Users',
        value: overview?.stats.users ?? 0,
        icon: Users,
        color: 'text-indigo-700 bg-indigo-100',
      },
      {
        label: 'Active Cases',
        value: overview?.stats.active_cases ?? 0,
        icon: Briefcase,
        color: 'text-red-700 bg-red-100',
      },
      {
        label: 'Completed Cases',
        value: overview?.stats.completed_cases ?? 0,
        icon: CheckCircle2,
        color: 'text-green-700 bg-green-100',
      },
    ],
    [overview]
  );

  const handleCreateOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const created = await createAdminOrganization({
        ...orgForm,
        slug: orgForm.slug.trim(),
      });
      setOrgForm(initialOrgForm);
      setFlash({ kind: 'success', message: `Organization created: ${created.name}` });
      await loadAdminData(true);
    } catch (createError) {
      setFlash({
        kind: 'error',
        message: createError instanceof Error ? createError.message : 'Failed to create organization',
      });
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const created = await createAdminUser(userForm);
      setUserForm((previous) => ({
        ...initialUserForm,
        organization_id: previous.organization_id,
      }));
      setFlash({ kind: 'success', message: `User created: ${created.full_name}` });
      await loadAdminData(true);
    } catch (createError) {
      setFlash({
        kind: 'error',
        message: createError instanceof Error ? createError.message : 'Failed to create user',
      });
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Loading admin dashboard...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-50 p-10 text-red-600">Failed to load admin dashboard: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="w-6 h-6 text-red-600" />
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 mt-1">Manage organizations, users, and platform activity.</p>
            </div>
            <button
              className="border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              onClick={() => void loadAdminData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {flash ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              flash.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {flash.message}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {stats.map((card) => (
            <div key={card.label} className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{card.value}</div>
              <div className="text-sm text-gray-600">{card.label}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <form onSubmit={handleCreateOrganization} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create Organization</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
              <input
                required
                type="text"
                value={orgForm.name}
                onChange={(event) => setOrgForm((previous) => ({ ...previous, name: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                required
                type="email"
                value={orgForm.contact_email}
                onChange={(event) => setOrgForm((previous) => ({ ...previous, contact_email: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                required
                type="text"
                value={orgForm.slug ?? ''}
                onChange={(event) => setOrgForm((previous) => ({ ...previous, slug: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                placeholder="acme-immigration"
              />
              {orgForm.slug.trim() && organizations.some((o) => o.slug === orgForm.slug.trim()) && (
                <p className="mt-1 text-xs text-red-600">A organization with this slug already exists.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                <select
                  value={orgForm.subscription_tier}
                  onChange={(event) => setOrgForm((previous) => ({ ...previous, subscription_tier: event.target.value }))}
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
                  onChange={(event) => setOrgForm((previous) => ({ ...previous, subscription_status: event.target.value }))}
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

          <form onSubmit={handleCreateUser} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create User</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization</label>
              <select
                required
                value={userForm.organization_id}
                onChange={(event) => setUserForm((previous) => ({ ...previous, organization_id: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="" disabled>
                  Select organization
                </option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input
                  required
                  type="text"
                  value={userForm.first_name}
                  onChange={(event) => setUserForm((previous) => ({ ...previous, first_name: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input
                  required
                  type="text"
                  value={userForm.last_name}
                  onChange={(event) => setUserForm((previous) => ({ ...previous, last_name: event.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm((previous) => ({ ...previous, email: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
              <input
                required
                minLength={8}
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm((previous) => ({ ...previous, password: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={userForm.status}
                onChange={(event) => setUserForm((previous) => ({ ...previous, status: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="invited">Invited</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={userForm.role_slug}
                onChange={(event) => setUserForm((previous) => ({ ...previous, role_slug: event.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                {roles.length === 0 ? (
                  <option value="lawyer">Lawyer</option>
                ) : (
                  roles.map((role) => (
                    <option key={role.id} value={role.slug}>
                      {role.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors">
              Create User
            </button>
          </form>
        </div>

        <div className="grid xl:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Organizations</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {(overview?.recent_organizations ?? []).map((organization) => (
                <div key={organization.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{organization.name}</p>
                      <p className="text-sm text-gray-600">{organization.slug} • {organization.contact_email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(organization.created_at)}</p>
                      <p className="text-xs font-medium text-green-700">{organization.subscription_status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Recent Users</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {(overview?.recent_users ?? []).map((user) => (
                <div key={user.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{user.full_name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{formatDate(user.created_at)}</p>
                      <p className="text-xs font-medium text-blue-700">{user.status}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">All Users</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Email</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Organization</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-700 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => {
                  const organization = organizations.find((entry) => entry.id === user.organization_id);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{user.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{organization?.name ?? 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{user.status}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(user.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
