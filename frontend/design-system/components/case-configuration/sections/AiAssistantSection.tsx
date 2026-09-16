/** Lawyer-only case assistant with BYOK provider, cited chat, and PDF draft tools. */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, FileOutput, KeyRound, RefreshCw, Send, ShieldAlert, Trash2 } from 'lucide-react';

import {
  type AiChat,
  type AiProvider,
  type AiProviderConnection,
  type AiProviderModels,
  type CaseWorkspace,
  connectAiProvider,
  createAiFormDraft,
  createCaseCustomDocument,
  createCaseAiChat,
  completeCaseDocumentUpload,
  deleteAiChat,
  getAiChat,
  getAiProviderModels,
  indexCaseForAi,
  initiateCaseDocumentUpload,
  listAiProviderConnections,
  listCaseAiChats,
  selectAiProviderModel,
  sendAiChatMessage,
} from '@/lib/api';

type AiAssistantSectionProps = {
  workspace: CaseWorkspace;
  onWorkspaceRefresh: () => Promise<void>;
};

export function AiAssistantSection({ workspace, onWorkspaceRefresh }: AiAssistantSectionProps) {
  const caseNumber = workspace.case.case_number;
  const [connections, setConnections] = useState<AiProviderConnection[]>([]);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [approved, setApproved] = useState(false);
  const [models, setModels] = useState<AiProviderModels | null>(null);
  const [chats, setChats] = useState<AiChat[]>([]);
  const [chat, setChat] = useState<AiChat | null>(null);
  const [question, setQuestion] = useState('');
  const [formDocumentId, setFormDocumentId] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formResult, setFormResult] = useState<{
    warning: string;
    unresolved: string[];
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const connected = connections.find((item) => item.provider === provider) ?? null;
  const cleanPdfDocuments = useMemo(
    () =>
      workspace.documents.filter(
        (document) =>
          document.can_download &&
          Boolean(document.latest_case_document_id) &&
          document.file_name?.toLowerCase().endsWith('.pdf')
      ),
    [workspace.documents]
  );

  useEffect(() => {
    let ignore = false;
    const load = async () => {
      try {
        const [providerConnections, caseChats] = await Promise.all([
          listAiProviderConnections(),
          listCaseAiChats(caseNumber),
        ]);
        if (ignore) return;
        setConnections(providerConnections);
        setChats(caseChats);
        const initialConnection = providerConnections[0];
        if (initialConnection) {
          setProvider(initialConnection.provider);
          const availableModels = await getAiProviderModels(initialConnection.provider);
          if (ignore) return;
          setModels(availableModels);
        }
        if (caseChats[0]) {
          const initialChat = await getAiChat(caseChats[0].id);
          if (ignore) return;
          setChat(initialChat);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load AI assistant');
        }
      }
    };
    void load();
    return () => {
      ignore = true;
    };
  }, [caseNumber]);

  const saveProvider = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('provider');
    setError(null);
    setNotice(null);
    try {
      const saved = await connectAiProvider({
        provider,
        api_key: apiKey,
        data_processing_acknowledged: approved,
      });
      setConnections((current) => [
        ...current.filter((item) => item.provider !== saved.provider),
        saved,
      ]);
      setApiKey('');
      setModels(await getAiProviderModels(provider));
      setNotice(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} connected.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Provider connection failed');
    } finally {
      setBusy(null);
    }
  };

  const changeModel = async (selectedModel: string) => {
    setBusy('model');
    setError(null);
    try {
      const saved = await selectAiProviderModel(provider, selectedModel);
      setConnections((current) =>
        current.map((item) => (item.provider === provider ? saved : item))
      );
      setModels((current) => current ? { ...current, selected_model: selectedModel } : current);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not select model');
    } finally {
      setBusy(null);
    }
  };

  const refreshIndex = async () => {
    setBusy('index');
    setError(null);
    try {
      const result = await indexCaseForAi(caseNumber);
      setNotice(`${result.queued_documents} clean document(s) queued for local indexing.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not index documents');
    } finally {
      setBusy(null);
    }
  };

  const newChat = async () => {
    setBusy('new-chat');
    setError(null);
    try {
      const created = await createCaseAiChat(caseNumber, `Case assistant · ${new Date().toLocaleDateString()}`);
      setChats((current) => [created, ...current]);
      setChat(created);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create chat');
    } finally {
      setBusy(null);
    }
  };

  const openChat = async (chatId: string) => {
    setBusy('open-chat');
    setError(null);
    try {
      setChat(await getAiChat(chatId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not open chat');
    } finally {
      setBusy(null);
    }
  };

  const removeChat = async () => {
    if (!chat || !window.confirm('Delete this AI conversation and all of its messages?')) return;
    setBusy('delete-chat');
    setError(null);
    try {
      await deleteAiChat(chat.id);
      const remaining = chats.filter((item) => item.id !== chat.id);
      setChats(remaining);
      setChat(remaining[0] ? await getAiChat(remaining[0].id) : null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete chat');
    } finally {
      setBusy(null);
    }
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy('message');
    setError(null);
    try {
      let target = chat;
      if (!target) {
        target = await createCaseAiChat(caseNumber, question.trim().slice(0, 80));
        setChats((current) => [target as AiChat, ...current]);
      }
      await sendAiChatMessage(target.id, question.trim());
      setQuestion('');
      setChat(await getAiChat(target.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI request failed');
    } finally {
      setBusy(null);
    }
  };

  const generateForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!formDocumentId) return;
    setBusy('form');
    setError(null);
    setFormResult(null);
    const popup = window.open('', '_blank');
    try {
      const draft = await createAiFormDraft(
        caseNumber,
        formDocumentId,
        formInstructions.trim() || null
      );
      if (popup && !popup.closed) {
        popup.location.href = draft.download_url;
      } else {
        window.location.assign(draft.download_url);
      }
      setFormResult({
        warning: draft.warning,
        unresolved: draft.unresolved_fields,
      });
    } catch (requestError) {
      popup?.close();
      setError(requestError instanceof Error ? requestError.message : 'Form draft failed');
    } finally {
      setBusy(null);
    }
  };

  const uploadForm = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('Official form upload must be a PDF.');
      return;
    }
    setBusy('form-upload');
    setError(null);
    try {
      const slot = await createCaseCustomDocument(caseNumber, {
        name: file.name.replace(/\.pdf$/i, '') || 'Official immigration form',
        suite_id: workspace.document_suites[0]?.id ?? null,
        required: false,
        due_date: null,
        instructions: 'Official form uploaded by the legal team for AI-assisted draft preparation.',
      });
      const upload = await initiateCaseDocumentUpload(caseNumber, slot.id, {
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
      });
      const form = new FormData();
      Object.entries(upload.upload_fields).forEach(([key, value]) => form.append(key, value));
      form.append('file', file);
      const storageResponse = await fetch(upload.upload_url, {
        method: upload.upload_method,
        body: form,
      });
      if (!storageResponse.ok) {
        throw new Error(`Storage upload failed: ${storageResponse.status}`);
      }
      await completeCaseDocumentUpload(caseNumber, slot.id, {
        storage_key: upload.storage_key,
        file_name: file.name,
        file_type: file.type,
        file_size_bytes: file.size,
        client_note: 'Official form uploaded by the legal team.',
      });
      await onWorkspaceRefresh();
      setNotice('PDF uploaded to quarantine. Generate a draft after malware scanning is clean.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'PDF form upload failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-red-700" />
          <h2 className="text-2xl font-bold text-gray-900">Case AI Assistant</h2>
        </div>
        <p className="mt-2 text-gray-600">
          Ask questions grounded in this client&apos;s structured case data and locally indexed,
          malware-clean documents.
        </p>
      </div>

      <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          AI output may be incomplete or wrong. Verify citations and source records. No chat
          response submits, signs, or changes an immigration application.
        </p>
      </div>

      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p> : null}

      <section className="rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="ai-provider-heading">
        <h3 id="ai-provider-heading" className="flex items-center gap-2 font-semibold text-gray-900">
          <KeyRound className="h-4 w-4" /> Your model provider
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          The key is encrypted and write-only. Case excerpts are processed under your firm&apos;s provider agreement.
        </p>
        <form onSubmit={saveProvider} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-700">Provider</label>
            <select
              id="ai-provider"
              value={provider}
              onChange={(event) => {
                const next = event.target.value as AiProvider;
                setProvider(next);
                const nextConnection = connections.find((item) => item.provider === next);
                setModels(null);
                if (nextConnection) void getAiProviderModels(next).then(setModels).catch(() => {});
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="openai">OpenAI API</option>
              <option value="anthropic">Anthropic API</option>
            </select>
          </div>
          <div>
            <label htmlFor="ai-api-key" className="block text-sm font-medium text-gray-700">
              {connected ? `Replace key (${connected.key_hint})` : 'API key'}
            </label>
            <input
              id="ai-api-key"
              type="password"
              autoComplete="off"
              required
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700 md:col-span-2">
            <input
              type="checkbox"
              required
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
              className="mt-1"
            />
            My firm approved this provider, its processing region, retention terms, and use for client confidential data.
          </label>
          <button
            type="submit"
            disabled={busy !== null}
            className="w-fit rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy === 'provider' ? 'Verifying…' : connected ? 'Replace connection' : 'Connect provider'}
          </button>
        </form>
        {connected && models ? (
          <div className="mt-4 max-w-xl">
            <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700">Model</label>
            <select
              id="ai-model"
              value={models.selected_model ?? ''}
              disabled={busy !== null}
              onChange={(event) => void changeModel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {models.models.map((model) => (
                <option key={model} value={model}>
                  {model}{model === models.recommended_model ? ' · Recommended strongest model' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              The strongest current general-purpose model is selected initially. Override it when your firm&apos;s
              retention eligibility, region, cost, or latency policy requires another model.
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="ai-chat-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="ai-chat-heading" className="font-semibold text-gray-900">Case chat</h3>
            <p className="text-xs text-gray-600">Sources show which case documents were retrieved.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refreshIndex()} disabled={busy !== null} className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> {busy === 'index' ? 'Queueing…' : 'Refresh document index'}
            </button>
            <button type="button" onClick={() => void newChat()} disabled={busy !== null || !connected} className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
              New chat
            </button>
            {chat ? (
              <button type="button" onClick={() => void removeChat()} disabled={busy !== null} className="rounded-lg border border-red-300 p-2 text-red-700 disabled:opacity-50" aria-label="Delete current chat">
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        {chats.length > 0 ? (
          <label className="mt-4 block text-sm text-gray-700">
            Conversation
            <select
              value={chat?.id ?? ''}
              onChange={(event) => void openChat(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="" disabled>Select a chat</option>
              {chats.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
        ) : null}
        <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto" aria-live="polite">
          {chat?.messages.map((message) => (
            <article key={message.id} className={`rounded-lg p-4 text-sm ${message.role === 'user' ? 'ml-8 bg-gray-100' : 'mr-8 border border-blue-200 bg-blue-50'}`}>
              <p className="whitespace-pre-wrap text-gray-900">{message.content}</p>
              {message.citations.length > 0 ? (
                <details className="mt-3 text-xs text-gray-700">
                  <summary className="cursor-pointer font-medium">Sources ({message.citations.length})</summary>
                  <ul className="mt-2 space-y-2">
                    {message.citations.map((citation) => (
                      <li key={`${message.id}-${citation.source_id}`}>
                        <strong>{citation.source_id}</strong> · {citation.document_name}
                        {citation.page_number ? ` · page ${citation.page_number}` : ''}
                        <p className="mt-1 text-gray-600">{citation.excerpt}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </article>
          ))}
        </div>
        <form onSubmit={ask} className="mt-4 flex gap-2">
          <label htmlFor="ai-question" className="sr-only">Ask about this case</label>
          <textarea
            id="ai-question"
            rows={3}
            maxLength={12000}
            required
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What passport expiry date is supported by the submitted documents?"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
          <button type="submit" disabled={busy !== null || !connected} className="self-end rounded-lg bg-red-600 p-3 text-white disabled:opacity-50" aria-label="Send question">
            <Send className="h-5 w-5" />
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="ai-form-heading">
        <h3 id="ai-form-heading" className="flex items-center gap-2 font-semibold text-gray-900">
          <FileOutput className="h-4 w-4" /> Create PDF form review draft
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          Supports standard AcroForm PDFs only. IRCC XFA/barcode forms still require Adobe Acrobat Reader.
        </p>
        <label className={`mt-4 flex w-fit items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm ${busy === 'form-upload' ? 'cursor-wait opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
          {busy === 'form-upload' ? 'Uploading and quarantining…' : 'Upload official PDF form'}
          <input
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy !== null}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void uploadForm(file);
            }}
          />
        </label>
        <form onSubmit={generateForm} className="mt-4 space-y-3">
          <div>
            <label htmlFor="ai-form-source" className="block text-sm font-medium text-gray-700">Clean case PDF</label>
            <select
              id="ai-form-source"
              required
              value={formDocumentId}
              onChange={(event) => setFormDocumentId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Select a PDF form</option>
              {cleanPdfDocuments.map((document) => (
                <option key={document.id} value={document.latest_case_document_id ?? ''}>
                  {document.name} · {document.file_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ai-form-instructions" className="block text-sm font-medium text-gray-700">Lawyer instructions (optional)</label>
            <textarea
              id="ai-form-instructions"
              rows={2}
              maxLength={2000}
              value={formInstructions}
              onChange={(event) => setFormInstructions(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <button type="submit" disabled={busy !== null || !connected || !formDocumentId} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy === 'form' ? 'Generating review draft…' : 'Generate review draft'}
          </button>
        </form>
        {formResult ? (
          <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>{formResult.warning}</p>
            {formResult.unresolved.length > 0 ? (
              <p className="mt-2">Unresolved fields: {formResult.unresolved.join(', ')}</p>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
