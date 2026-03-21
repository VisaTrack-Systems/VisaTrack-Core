import { useEffect, useState } from 'react';

import {
  type AdminOperations,
  type AdminRoleItem,
  type OrganizationListItem,
  type UserListItem,
  getAdminOperations,
  getAdminOrganizations,
  getAdminRoles,
  getAdminUsers,
} from '@/lib/api';

type AdminData = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  organizations: OrganizationListItem[];
  users: UserListItem[];
  roles: AdminRoleItem[];
  operations: AdminOperations | null;
  roleDraftByUserId: Record<string, string>;
  setRoleDraftByUserId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  caseAssignmentDraft: Record<string, string>;
  setCaseAssignmentDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  refresh: () => void;
};

export function useAdminData(activeRole?: string): AdminData {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([]);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);
  const [operations, setOperations] = useState<AdminOperations | null>(null);
  const [roleDraftByUserId, setRoleDraftByUserId] = useState<Record<string, string>>({});
  const [caseAssignmentDraft, setCaseAssignmentDraft] = useState<Record<string, string>>({});
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load(isRefresh: boolean) {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const [orgs, usersData, rolesData, ops] = await Promise.all([
          getAdminOrganizations(100),
          getAdminUsers(200),
          getAdminRoles(),
          getAdminOperations(),
        ]);

        if (ignore) return;

        setOrganizations(orgs);
        setUsers(usersData);
        setRoles(rolesData);
        setOperations(ops);
        setError(null);

        setRoleDraftByUserId((previous) => {
          const next = { ...previous };
          for (const user of usersData) {
            if (!next[user.id]) {
              const firstMissing = rolesData.find((r) => !user.roles.includes(r.slug));
              next[user.id] = firstMissing?.slug ?? rolesData[0]?.slug ?? 'lawyer';
            }
          }
          return next;
        });

        setCaseAssignmentDraft((previous) => {
          const next = { ...previous };
          for (const c of ops.unassigned_cases) {
            if (!next[c.case_number]) {
              next[c.case_number] = ops.lawyer_workload[0]?.lawyer_user_id ?? '';
            }
          }
          return next;
        });
      } catch (err) {
        if (ignore) return;
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!ignore) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    void load(reloadToken > 0);

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRole, reloadToken]);

  return {
    loading,
    refreshing,
    error,
    organizations,
    users,
    roles,
    operations,
    roleDraftByUserId,
    setRoleDraftByUserId,
    caseAssignmentDraft,
    setCaseAssignmentDraft,
    refresh: () => setReloadToken((t) => t + 1),
  };
}
