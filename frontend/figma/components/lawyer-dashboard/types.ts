export type DashboardCase = {
  id: string;
  clientName: string;
  caseType: string;
  status: string;
  lastUpdate: string;
  priority: string;
  nextDeadline: string;
};

export type DeadlineItem = {
  task: string;
  client: string;
  date: string;
  daysLeft: number;
};

export type ActivityItem = {
  action: string;
  client: string;
  detail: string;
  time: string;
  type: 'document' | 'message' | 'payment' | 'milestone';
};

export type DashboardStats = {
  activeCases: number;
  totalUsers: number;
  upcomingMilestones: number;
  completedCases: number;
};
