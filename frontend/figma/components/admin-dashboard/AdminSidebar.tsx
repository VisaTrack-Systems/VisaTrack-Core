import { BarChart2, Building2, LayoutDashboard, Mail, Users } from 'lucide-react';

import type { AdminSection } from './types';

export function AdminSidebar({
  activeSection,
  onNavigate,
}: {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
}) {
  function NavItem({
    section,
    label,
    icon,
    indent,
  }: {
    section: AdminSection;
    label: string;
    icon: React.ReactNode;
    indent?: boolean;
  }) {
    const isActive = activeSection === section;
    return (
      <button
        type="button"
        onClick={() => onNavigate(section)}
        className={`w-full flex items-center gap-2 rounded-lg text-sm transition-colors ${
          indent ? 'pl-7 pr-3 py-1.5' : 'px-3 py-2'
        } ${isActive ? 'bg-red-50 text-red-700 font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200">
      <nav className="p-3 space-y-0.5">
        <NavItem section="home" label="Home" icon={<LayoutDashboard className="w-4 h-4" />} />
        <div className="pt-4">
          <div className="px-3 pb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Organization</span>
          </div>
          <NavItem section="org-overview" label="Overview" icon={<BarChart2 className="w-4 h-4" />} indent />
          <NavItem section="org-members" label="Members" icon={<Users className="w-4 h-4" />} indent />
          <NavItem
            section="org-invitations"
            label="Pending Invitations"
            icon={<Mail className="w-4 h-4" />}
            indent
          />
        </div>
      </nav>
    </aside>
  );
}
