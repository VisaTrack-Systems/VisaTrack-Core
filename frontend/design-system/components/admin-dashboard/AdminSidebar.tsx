/** AdminSidebar: adminsidebar implementation. */

import { Building2, CreditCard, FolderOpen, LayoutDashboard, Settings, Users } from 'lucide-react';

import type { AdminSection } from './types';

function NavItem({
  section,
  label,
  icon,
  indent,
  activeSection,
  onNavigate,
}: {
  section: AdminSection;
  label: string;
  icon: React.ReactNode;
  indent?: boolean;
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
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

export function AdminSidebar({
  activeSection,
  onNavigate,
  isSuperAdmin,
}: {
  activeSection: AdminSection;
  onNavigate: (section: AdminSection) => void;
  isSuperAdmin: boolean;
}) {
  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200">
      <nav className="p-3 space-y-0.5">
        {/* Organization */}
        <div className="pt-2">
          <div className="px-3 pb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Organization</span>
          </div>
          <NavItem section="home" label="Home" icon={<LayoutDashboard className="w-4 h-4" />} indent activeSection={activeSection} onNavigate={onNavigate} />
          {!isSuperAdmin && (
            <NavItem section="case-history" label="Case History" icon={<FolderOpen className="w-4 h-4" />} indent activeSection={activeSection} onNavigate={onNavigate} />
          )}
          <NavItem section="org-members" label="Members" icon={<Users className="w-4 h-4" />} indent activeSection={activeSection} onNavigate={onNavigate} />
        </div>

        {/* Settings */}
        {!isSuperAdmin && (
          <div className="pt-4">
            <div className="px-3 pb-1.5 flex items-center gap-1.5">
              <Settings className="w-3 h-3 text-gray-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</span>
            </div>
            <NavItem section="settings-general" label="General" icon={<Settings className="w-4 h-4" />} indent activeSection={activeSection} onNavigate={onNavigate} />
            <NavItem section="settings-billing" label="Billing & Plan" icon={<CreditCard className="w-4 h-4" />} indent activeSection={activeSection} onNavigate={onNavigate} />
          </div>
        )}
      </nav>
    </aside>
  );
}
