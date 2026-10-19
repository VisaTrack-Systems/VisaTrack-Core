/**
 * ClientNotesPanel: One-way notes the legal team leaves for the client (case summary,
 * important information, or what is needed next). Read-only: clients cannot reply here.
 */

import { Card, CardHeader } from '../ui';

type ClientNotesPanelProps = {
  notes: string | null;
};

export function ClientNotesPanel({ notes }: ClientNotesPanelProps) {
  return (
    <Card>
      <CardHeader title="Notes from your legal team" />
      {notes ? (
        <p className="whitespace-pre-wrap px-5 py-4 text-sm text-gray-700">{notes}</p>
      ) : (
        <p className="px-5 py-4 text-sm text-gray-500">Your legal team hasn&apos;t left any notes yet.</p>
      )}
    </Card>
  );
}
