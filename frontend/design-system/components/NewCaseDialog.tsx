/** NewCaseDialog: Modal dialog for creating new case entries. Guides users through case type selection, client assignment, and initial configuration. */

import { X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import type { UserListItem } from '@/lib/api';

export type NewCaseDialogSubmitPayload = {
  case_type: string;
  priority: string;
  target_filing_date: string | null;
  client_mode: 'existing' | 'new';
  client_user_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
};

type NewCaseDialogProps = {
  isOpen: boolean;
  clients: UserListItem[];
  loadingClients: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: NewCaseDialogSubmitPayload) => Promise<void>;
};

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

export function NewCaseDialog({
  isOpen,
  clients,
  loadingClients,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: NewCaseDialogProps) {
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(() =>
    clients.length > 0 ? 'existing' : 'new'
  );
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientFirstName, setNewClientFirstName] = useState('');
  const [newClientLastName, setNewClientLastName] = useState('');
  const [caseType, setCaseType] = useState('Express Entry');
  const [priority, setPriority] = useState<(typeof PRIORITY_OPTIONS)[number]>('medium');
  const [targetFilingDate, setTargetFilingDate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const hasExistingClients = clients.length > 0;

  const existingClientOptions = useMemo(
    () => clients.map((client) => ({ id: client.id, label: `${client.full_name} (${client.email})` })),
    [clients]
  );

  const resolvedSelectedClientId =
    selectedClientId || (existingClientOptions.length > 0 ? existingClientOptions[0].id : '');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const normalizedCaseType = caseType.trim();
    if (!normalizedCaseType) {
      setValidationError('Case type is required.');
      return;
    }

    if (clientMode === 'existing') {
      if (!resolvedSelectedClientId) {
        setValidationError('Please select a client.');
        return;
      }

      await onSubmit({
        client_mode: 'existing',
        client_user_id: resolvedSelectedClientId,
        case_type: normalizedCaseType,
        priority,
        target_filing_date: targetFilingDate || null,
      });
      return;
    }

    const email = newClientEmail.trim();
    const firstName = newClientFirstName.trim();
    const lastName = newClientLastName.trim();

    if (!email || !firstName || !lastName) {
      setValidationError('New client email, first name, and last name are required.');
      return;
    }

    await onSubmit({
      client_mode: 'new',
      email,
      first_name: firstName,
      last_name: lastName,
      case_type: normalizedCaseType,
      priority,
      target_filing_date: targetFilingDate || null,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-black text-white flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Create New Case</h2>
            <p className="text-xs text-gray-300 mt-1">Set up a case and link it to an existing or new client.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            disabled={submitting}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {validationError ? (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm px-3 py-2">
              {validationError}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
              <input
                value={caseType}
                onChange={(event) => setCaseType(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                placeholder="Express Entry"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as (typeof PRIORITY_OPTIONS)[number])}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                {PRIORITY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value.charAt(0).toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Filing Date (Optional)</label>
            <input
              type="date"
              value={targetFilingDate}
              onChange={(event) => setTargetFilingDate(event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Client</p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setClientMode('existing')}
                disabled={!hasExistingClients}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  clientMode === 'existing'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300'
                } ${!hasExistingClients ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                Existing Client
              </button>
              <button
                type="button"
                onClick={() => setClientMode('new')}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  clientMode === 'new'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                New Client
              </button>
            </div>

            {loadingClients ? (
              <p className="text-sm text-gray-600">Loading clients...</p>
            ) : null}

            {clientMode === 'existing' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Client</label>
                <select
                  value={resolvedSelectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  disabled={!hasExistingClients}
                >
                  {existingClientOptions.length === 0 ? (
                    <option value="">No clients available</option>
                  ) : (
                    existingClientOptions.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(event) => setNewClientEmail(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="client@example.com"
                    required={clientMode === 'new'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    value={newClientFirstName}
                    onChange={(event) => setNewClientFirstName(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required={clientMode === 'new'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    value={newClientLastName}
                    onChange={(event) => setNewClientLastName(event.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    required={clientMode === 'new'}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              disabled={submitting || loadingClients}
            >
              {submitting ? 'Creating Case...' : 'Create Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
