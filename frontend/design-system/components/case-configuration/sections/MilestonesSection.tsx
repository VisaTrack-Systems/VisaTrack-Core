/** MilestonesSection: Configuration section for Milestones settings and options. */

import { AlertCircle, Calendar, CheckCircle, Clock, Edit2, Eye, EyeOff, Info, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { CaseWorkspace } from '@/lib/api';

import { DeleteMilestoneDialog } from '../dialogs/DeleteMilestoneDialog';
import { MilestoneDialog, type MilestoneDialogInput } from '../dialogs/MilestoneDialog';
import { formatDate, milestoneStatus, statusColor, titleize } from '../utils';

type MilestoneUpdate = {
  name?: string;
  description?: string | null;
  due_date?: string | null;
  status?: string;
  client_visible?: boolean;
};

type NewMilestoneInput = {
  name: string;
  description: string | null;
  due_date: string | null;
  status: string;
  client_visible: boolean;
};

type MilestonesSectionProps = {
  workspace: CaseWorkspace;
  creatingMilestone: boolean;
  updatingMilestoneId: string | null;
  deletingMilestoneId: string | null;
  onAddMilestone: (input: NewMilestoneInput) => Promise<boolean>;
  onUpdateMilestone: (milestoneId: string, updates: MilestoneUpdate) => Promise<boolean>;
  onDeleteMilestone: (milestoneId: string) => Promise<void>;
};

export function MilestonesSection({
  workspace,
  creatingMilestone,
  updatingMilestoneId,
  deletingMilestoneId,
  onAddMilestone,
  onUpdateMilestone,
  onDeleteMilestone,
}: MilestonesSectionProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<CaseWorkspace['milestones'][number] | null>(null);
  const [deletingMilestone, setDeletingMilestone] = useState<CaseWorkspace['milestones'][number] | null>(null);

  const handleAddMilestone = async (input: MilestoneDialogInput): Promise<boolean> => {
    return onAddMilestone(input);
  };

  const handleEditMilestone = async (input: MilestoneDialogInput): Promise<boolean> => {
    if (!editingMilestone) {
      return false;
    }

    return onUpdateMilestone(editingMilestone.id, input);
  };

  const handleDeleteMilestone = async () => {
    if (!deletingMilestone) {
      return;
    }

    await onDeleteMilestone(deletingMilestone.id);
    setDeletingMilestone(null);
  };

  const isEditingMilestoneSaving =
    editingMilestone !== null && updatingMilestoneId === editingMilestone.id;

  const isDeletingMilestoneSaving =
    deletingMilestone !== null && deletingMilestoneId === deletingMilestone.id;

  const milestoneDialogInitialValue = editingMilestone
    ? {
        name: editingMilestone.name,
        description: editingMilestone.description ?? '',
        due_date: editingMilestone.due_date ?? '',
        status: editingMilestone.status,
        client_visible: editingMilestone.client_visible,
      }
    : undefined;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Milestones</h2>
            <p className="text-gray-600">Configure case milestones and timeline</p>
          </div>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            onClick={() => setIsAddDialogOpen(true)}
            disabled={creatingMilestone}
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="space-y-6">
            {workspace.milestones.map((milestone, index) => {
              const normalizedStatus = milestoneStatus(milestone.status);
              const isUpdating = updatingMilestoneId === milestone.id;

              return (
                <div key={milestone.id} className="relative">
                  {index < workspace.milestones.length - 1 ? (
                    <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200" />
                  ) : null}

                  <div className="flex gap-4">
                    <div
                      className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                        normalizedStatus === 'completed'
                          ? 'bg-green-100'
                          : normalizedStatus === 'in-progress'
                            ? 'bg-blue-100'
                            : normalizedStatus === 'blocked'
                              ? 'bg-red-100'
                              : 'bg-gray-100'
                      }`}
                    >
                      {normalizedStatus === 'completed' ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : normalizedStatus === 'in-progress' ? (
                        <Clock className="w-6 h-6 text-blue-600" />
                      ) : normalizedStatus === 'blocked' ? (
                        <AlertCircle className="w-6 h-6 text-red-600" />
                      ) : (
                        <div className="w-3 h-3 rounded-full bg-gray-400" />
                      )}
                    </div>

                    <div className="flex-1 pb-8">
                      <div className="bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{milestone.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{milestone.description ?? 'No description provided.'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              className="p-1 hover:bg-white rounded disabled:opacity-50"
                              title={milestone.client_visible ? 'Hide from Client' : 'Show to Client'}
                              aria-label={milestone.client_visible ? 'Hide from Client' : 'Show to Client'}
                              disabled={isUpdating}
                              onClick={(event) => {
                                event.stopPropagation();
                                void onUpdateMilestone(milestone.id, {
                                  client_visible: !milestone.client_visible,
                                });
                              }}
                            >
                              {milestone.client_visible ? (
                                <Eye className="w-4 h-4 text-green-600" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                            <button
                              className="p-1 hover:bg-white rounded disabled:opacity-50"
                              title="Edit Milestone"
                              aria-label="Edit Milestone"
                              disabled={isUpdating}
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingMilestone(milestone);
                              }}
                            >
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              className="p-1 hover:bg-white rounded disabled:opacity-50"
                              title="Delete Milestone"
                              aria-label="Delete Milestone"
                              disabled={isUpdating}
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeletingMilestone(milestone);
                              }}
                            >
                              <Trash2 className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Due: {formatDate(milestone.due_date)}
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor(milestone.status)}`}>
                            {titleize(milestone.status)}
                          </span>
                          {milestone.completed_at ? (
                            <span className="text-xs text-green-600">Completed: {formatDate(milestone.completed_at)}</span>
                          ) : null}
                        </div>

                        {milestone.dependencies.length > 0 ? (
                          <div className="mt-2 text-xs text-gray-500">Dependencies: {milestone.dependencies.length}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900">Milestone Templates Available</p>
              <p className="text-sm text-blue-700 mt-1">
                Milestones are loaded directly from your case data. Add or adjust milestones from the backend to update this timeline.
              </p>
            </div>
          </div>
        </div>
      </div>

      {isAddDialogOpen ? (
        <MilestoneDialog
          title="Add Milestone"
          description="Create a new milestone in this case timeline."
          submitLabel="Add Milestone"
          submitting={creatingMilestone}
          onClose={() => setIsAddDialogOpen(false)}
          onSubmit={handleAddMilestone}
        />
      ) : null}

      {editingMilestone ? (
        <MilestoneDialog
          title="Edit Milestone"
          description="Update milestone details and visibility."
          submitLabel="Save Changes"
          submitting={isEditingMilestoneSaving}
          initialValue={milestoneDialogInitialValue}
          onClose={() => setEditingMilestone(null)}
          onSubmit={handleEditMilestone}
        />
      ) : null}

      {deletingMilestone ? (
        <DeleteMilestoneDialog
          milestoneName={deletingMilestone.name}
          submitting={isDeletingMilestoneSaving}
          onClose={() => setDeletingMilestone(null)}
          onConfirm={handleDeleteMilestone}
        />
      ) : null}
    </>
  );
}
