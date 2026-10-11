/** AppointmentsPanel: List of the client's upcoming appointments (derived from milestones). */

import { Calendar } from 'lucide-react';

import { Card, CardHeader } from '../ui';
import type { DashboardAppointment } from './types';

type AppointmentsPanelProps = {
  upcomingAppointments: DashboardAppointment[];
};

export function AppointmentsPanel({ upcomingAppointments }: AppointmentsPanelProps) {
  return (
    <Card>
      <CardHeader title="Upcoming Appointments" />
      {upcomingAppointments.length === 0 ? (
        <p className="px-5 py-4 text-sm text-gray-500">No upcoming appointments.</p>
      ) : (
        <ul className="divide-y divide-gray-100 px-5 py-1">
          {upcomingAppointments.map((appointment, index) => (
            <li key={`${appointment.title}-${index}`} className="flex items-start gap-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                <Calendar className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{appointment.title}</p>
                <p className="text-sm text-gray-600">{appointment.date}</p>
                <p className="text-xs text-gray-500">
                  {appointment.time} • {appointment.type}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
