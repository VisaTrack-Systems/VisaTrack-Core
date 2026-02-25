export type DashboardDocumentStatus = 'completed' | 'pending' | 'review' | 'optional';

export type DashboardDocument = {
  name: string;
  status: DashboardDocumentStatus;
  uploadedDate: string;
  required: boolean;
};

export type DashboardMilestone = {
  title: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  date: string;
  description: string;
};

export type DashboardMessage = {
  from: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
};

export type DashboardAppointment = {
  title: string;
  date: string;
  time: string;
  type: string;
};

export type BillingInfo = {
  totalFees: number;
  paid: number;
  remaining: number;
  nextPayment: string;
  paymentMethod: string;
};

export type CaseInfo = {
  id: string;
  type: string;
  status: string;
  assignedLawyer: string;
  startDate: string;
  estimatedCompletion: string;
  progress: number;
};

export type ClientPortalCapabilities = {
  portalAccess: 'full_access' | 'limited_access' | 'read_only' | 'disabled';
  canViewCaseStatus: boolean;
  canViewMilestones: boolean;
  canViewDocuments: boolean;
  canViewMessages: boolean;
  canViewBilling: boolean;
  canUploadDocuments: boolean;
  canSendMessages: boolean;
};
