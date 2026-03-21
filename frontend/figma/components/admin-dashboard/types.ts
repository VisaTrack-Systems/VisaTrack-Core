export type AdminSection = 'home' | 'org-overview' | 'org-members' | 'org-invitations';

export type FlashState = {
  kind: 'success' | 'error';
  message: string;
} | null;

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'danger' | 'info';
  onConfirm: () => void;
};

export type Invitation = {
  invitation_id: string;
  user_id: string;
  email: string;
  role_slug: string;
  created_at: string;
  expires_at: string;
  status: string;
  invited_by_name: string | null;
};
