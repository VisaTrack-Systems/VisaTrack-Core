import { Calendar } from 'lucide-react';

import type { DashboardAppointment } from './types';

type AppointmentsPanelProps = {
  upcomingAppointments: DashboardAppointment[];
};

export function AppointmentsPanel({ upcomingAppointments }: AppointmentsPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Upcoming Appointments</h2>
      </div>
      <div className="p-6 space-y-4">
        {upcomingAppointments.map((appointment, index) => (
          <div key={`${appointment.title}-${index}`} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-red-100 p-2 rounded">
                <Calendar className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{appointment.title}</p>
                <p className="text-sm text-gray-600 mt-1">{appointment.date}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {appointment.time} • {appointment.type}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
