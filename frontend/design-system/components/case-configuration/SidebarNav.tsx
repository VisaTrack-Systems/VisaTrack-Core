/** SidebarNav: sidebarnav implementation. */

import {
  ArrowLeft,
  BellRing,
  CheckCircle,
  DollarSign,
  FileCheck,
  FileText,
  Info,
  type LucideIcon,
  Settings,
} from 'lucide-react';

import type { CaseWorkspace } from '@/lib/api';

import type { SectionType } from './types';

type SidebarNavProps = {
  activeSection: SectionType;
  caseId: string;
  onBack: () => void;
  onSectionChange: (section: SectionType) => void;
  workspace: CaseWorkspace | null;
};

export function SidebarNav({ activeSection, caseId, onBack, onSectionChange, workspace }: SidebarNavProps) {
  const sections: Array<{ id: SectionType; label: string; icon: LucideIcon }> = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'details', label: 'Case Details', icon: FileText },
    { id: 'documents', label: 'Document Requests', icon: FileCheck },
    { id: 'milestones', label: 'Milestones', icon: CheckCircle },
    { id: 'payments', label: 'Payments & Invoices', icon: DollarSign },
    { id: 'reminders', label: 'Reminders', icon: BellRing },
    { id: 'permissions', label: 'Sharing / Permissions', icon: Settings },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen sticky top-0">
      <div className="p-6 border-b border-gray-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Dashboard</span>
        </button>
        <div>
          <h2 className="font-semibold text-gray-900">{workspace?.case.client_name ?? 'Loading...'}</h2>
          <p className="text-sm text-gray-600">{workspace?.case.case_type ?? ''}</p>
          <p className="text-xs text-gray-500 mt-1">{workspace?.case.case_number ?? caseId}</p>
        </div>
      </div>

      <nav className="p-4">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
              activeSection === section.id ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <section.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{section.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
