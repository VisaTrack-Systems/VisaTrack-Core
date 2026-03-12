export interface CaseConfigurationProps {
  caseId: string;
  onBack: () => void;
}

export type SectionType =
  | 'overview'
  | 'details'
  | 'documents'
  | 'milestones'
  | 'timeline'
  | 'payments'
  | 'messages'
  | 'permissions';

export type DocumentStats = {
  approved: number;
  received: number;
  pending: number;
  rejected: number;
};

export type MilestoneStats = {
  completed: number;
  inProgress: number;
  notStarted: number;
};

export type NewDocumentInput = {
  name: string;
  suiteId?: string;
  required: boolean;
  dueDate: string | null;
  instructions: string | null;
};

export type NewDocumentSuiteInput = {
  name: string;
  description: string | null;
};
