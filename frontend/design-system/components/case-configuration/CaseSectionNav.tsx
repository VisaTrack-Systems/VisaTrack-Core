/**
 * CaseSectionNav: Case workspace header. Shows a back link, the client name,
 * case type and number, and a horizontal tab strip for the case sections
 * (Clio matter-page style).
 */

import {
  ArrowLeft,
  Bot,
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

type CaseSectionNavProps = {
  activeSection: SectionType;
  caseId: string;
  onBack: () => void;
  onSectionChange: (section: SectionType) => void;
  workspace: CaseWorkspace | null;
};

const SECTIONS: Array<{ id: SectionType; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'details', label: 'Case Details', icon: FileText },
  { id: 'documents', label: 'Document Requests', icon: FileCheck },
  { id: 'milestones', label: 'Milestones', icon: CheckCircle },
  { id: 'ai-assistant', label: 'AI Assistant', icon: Bot },
  { id: 'payments', label: 'Payments & Invoices', icon: DollarSign },
  { id: 'reminders', label: 'Reminders', icon: BellRing },
  { id: 'permissions', label: 'Sharing / Permissions', icon: Settings },
];

export function CaseSectionNav({ activeSection, caseId, onBack, onSectionChange, workspace }: CaseSectionNavProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-primary-600 transition-colors hover:text-primary-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Case</p>
        <h1 className="text-xl font-semibold text-gray-900">
          {workspace?.case.client_name ?? 'Loading...'}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {workspace?.case.case_type ? `${workspace.case.case_type} · ` : ''}
          {workspace?.case.case_number ?? caseId}
        </p>
      </div>

      {/* Still scrolls sideways on narrow screens (swipe or trackpad), but the scrollbar is hidden. */}
      <nav
        aria-label="Case sections"
        className="mt-3 overflow-x-auto px-4 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-1">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSectionChange(section.id)}
                className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-primary-600 font-semibold text-primary-700'
                    : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                <section.icon className="h-4 w-4" aria-hidden="true" />
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
