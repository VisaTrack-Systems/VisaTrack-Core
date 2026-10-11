/** CasesTable: Table of cases with status, priority, next milestone, deadline, outstanding items, and progress; rows open the case. */

import { Calendar, Clock, DollarSign, FileText } from 'lucide-react';

import { Badge, Card, TableBody, TableHead, TableRow, Td, Th } from '../ui';
import type { UiCase } from './types';
import { priorityTone, statusTone } from './utils';

type CasesTableProps = {
  filteredCases: UiCase[];
  onSelectCase: (caseId: string) => void;
};

export function CasesTable({ filteredCases, onSelectCase }: CasesTableProps) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <TableHead>
            <tr>
              <Th>Client / Case</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              <Th>Next Milestone</Th>
              <Th>Deadline</Th>
              <Th>Outstanding</Th>
              <Th>Progress</Th>
            </tr>
          </TableHead>
          <TableBody>
            {filteredCases.map((case_) => (
              <TableRow key={case_.id} onClick={() => onSelectCase(case_.id)} className="cursor-pointer">
                <Td>
                  <div className="font-semibold text-gray-900">{case_.clientName}</div>
                  <div className="text-sm text-gray-600">{case_.caseType}</div>
                  <div className="mt-0.5 text-xs font-medium text-primary-700">{case_.id}</div>
                </Td>
                <Td>
                  <Badge tone={statusTone(case_.status)}>{case_.status}</Badge>
                </Td>
                <Td>
                  <Badge tone={priorityTone(case_.priority)}>{case_.priority.toUpperCase()}</Badge>
                </Td>
                <Td>
                  <div className="text-sm text-gray-900">{case_.nextMilestone}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {case_.lastActivity}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-1.5 whitespace-nowrap text-sm text-gray-900">
                    <Calendar className="h-4 w-4 text-gray-400" aria-hidden="true" />
                    {case_.nextDeadline}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    {case_.outstandingDocs > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <FileText className="h-3 w-3" aria-hidden="true" />
                        {case_.outstandingDocs} docs
                      </span>
                    )}
                    {case_.outstandingPayments > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700">
                        <DollarSign className="h-3 w-3" aria-hidden="true" />
                        {case_.outstandingPayments} payment{case_.outstandingPayments > 1 ? 's' : ''}
                      </span>
                    )}
                    {case_.outstandingDocs === 0 && case_.outstandingPayments === 0 && (
                      <span className="text-xs text-green-700">All clear</span>
                    )}
                  </div>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-primary-600" style={{ width: `${case_.completionPercent}%` }} />
                    </div>
                    <span className="min-w-[40px] text-xs font-medium text-gray-700">{case_.completionPercent}%</span>
                  </div>
                </Td>
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>

      {filteredCases.length === 0 && (
        <div className="py-12 text-center">
          <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
          <p className="text-sm text-gray-600">No cases found matching your search criteria</p>
        </div>
      )}
    </Card>
  );
}
