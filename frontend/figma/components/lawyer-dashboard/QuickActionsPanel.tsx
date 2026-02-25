import { Calendar, FileText, MessageSquare, Users } from 'lucide-react';

export function QuickActionsPanel() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="space-y-3">
        <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
          <FileText className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Create New Case</span>
        </button>
        <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
          <Users className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Add New Client</span>
        </button>
        <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">View Messages</span>
        </button>
        <button className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
          <Calendar className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Schedule Appointment</span>
        </button>
      </div>
    </div>
  );
}
