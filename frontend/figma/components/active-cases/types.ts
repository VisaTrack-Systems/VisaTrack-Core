export type UiCase = {
  id: string;
  clientName: string;
  caseType: string;
  status: string;
  priority: string;
  lastActivity: string;
  nextMilestone: string;
  nextDeadline: string;
  outstandingDocs: number;
  outstandingPayments: number;
  completionPercent: number;
};
