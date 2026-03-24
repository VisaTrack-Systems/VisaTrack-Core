export type DashboardDocumentStatus = 'completed' | 'pending' | 'review' | 'optional';

export type DashboardDocument = {
  id: string;
  name: string;
  status: DashboardDocumentStatus;
  lawyerStatus: string;
  rejectionNote: string | null;
  uploadedDate: string;
  required: boolean;
  instructions: string | null;
  fileName: string | null;
  canDownload: boolean;
};

export type DashboardMilestone = {
  title: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  date: string;
  description: string;
};

export type DashboardReminder = {
  id: string;
  from: string;
  title: string;
  preview: string;
  body: string;
  time: string;
  unread: boolean;
  acknowledged: boolean;
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
  description: string | null;
};

export type ClientPortalCapabilities = {
  portalAccess: 'full_access' | 'limited_access' | 'read_only' | 'disabled';
  canViewCaseStatus: boolean;
  canViewMilestones: boolean;
  canViewDocuments: boolean;
  canViewReminders: boolean;
  canViewBilling: boolean;
  canUploadDocuments: boolean;
  canAcknowledgeReminders: boolean;
};
