/** NewCaseDialog: Modal dialog for creating new case entries. Guides users through case type selection, client assignment, and initial configuration. */

import { X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import type { UserListItem } from '@/lib/api';
import { DialogPanel } from './DialogPanel';
import { Alert, Button, Input, Label, Select } from './ui';

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

  const modeButtonClasses = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-white text-primary-700 shadow-card' : 'text-gray-600 hover:text-gray-900'
    }`;

  return (
    <div className="fixed inset-0 z-[70] bg-navy-900/50 flex items-center justify-center p-4">
      <DialogPanel
        labelledBy="new-case-dialog-title"
        onClose={onClose}
        className="w-full max-w-2xl bg-white rounded-md shadow-popover border border-gray-200 overflow-hidden"
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 id="new-case-dialog-title" className="text-base font-semibold text-gray-900">Create New Case</h2>
            <p className="mt-0.5 text-sm text-gray-500">Set up a case and link it to an existing or new client.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            disabled={submitting}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-5 py-4">
            {validationError ? <Alert tone="warning">{validationError}</Alert> : null}

            {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-case-type">Case Type</Label>
                <Input
                  id="new-case-type"
                  value={caseType}
                  onChange={(event) => setCaseType(event.target.value)}
                  placeholder="Express Entry"
                  required
                />
              </div>

              <div>
                <Label htmlFor="new-case-priority">Priority</Label>
                <Select
                  id="new-case-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as (typeof PRIORITY_OPTIONS)[number])}
                >
                  {PRIORITY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value.charAt(0).toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="new-case-filing-date">Target Filing Date (Optional)</Label>
              <Input
                id="new-case-filing-date"
                type="date"
                value={targetFilingDate}
                onChange={(event) => setTargetFilingDate(event.target.value)}
              />
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">Client</p>
                <div className="inline-flex rounded-md bg-gray-200/70 p-0.5">
                  <button
                    type="button"
                    onClick={() => setClientMode('existing')}
                    disabled={!hasExistingClients}
                    aria-pressed={clientMode === 'existing'}
                    className={`${modeButtonClasses(clientMode === 'existing')} ${!hasExistingClients ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    Existing Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientMode('new')}
                    aria-pressed={clientMode === 'new'}
                    className={modeButtonClasses(clientMode === 'new')}
                  >
                    New Client
                  </button>
                </div>
              </div>

              {loadingClients ? (
                <p className="text-sm text-gray-600">Loading clients...</p>
              ) : null}

              {clientMode === 'existing' ? (
                <div>
                  <Label htmlFor="new-case-client">Select Client</Label>
                  <Select
                    id="new-case-client"
                    value={resolvedSelectedClientId}
                    onChange={(event) => setSelectedClientId(event.target.value)}
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
                  </Select>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label htmlFor="new-case-client-email">Client Email</Label>
                    <Input
                      id="new-case-client-email"
                      type="email"
                      value={newClientEmail}
                      onChange={(event) => setNewClientEmail(event.target.value)}
                      placeholder="client@example.com"
                      required={clientMode === 'new'}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-case-client-first-name">First Name</Label>
                    <Input
                      id="new-case-client-first-name"
                      value={newClientFirstName}
                      onChange={(event) => setNewClientFirstName(event.target.value)}
                      required={clientMode === 'new'}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-case-client-last-name">Last Name</Label>
                    <Input
                      id="new-case-client-last-name"
                      value={newClientLastName}
                      onChange={(event) => setNewClientLastName(event.target.value)}
                      required={clientMode === 'new'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || loadingClients}>
              {submitting ? 'Creating Case...' : 'Create Case'}
            </Button>
          </div>
        </form>
      </DialogPanel>
    </div>
  );
}
