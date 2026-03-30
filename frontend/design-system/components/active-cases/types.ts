/** types: types implementation. */

export type UiCase = {
  id: string;
  clientName: string;
  caseType: string;
  status: string;
  priority: string;
  lawyerName: string;
  lastActivity: string;
  nextMilestone: string;
  nextDeadline: string;
  outstandingDocs: number;
  outstandingPayments: number;
  completionPercent: number;
};
