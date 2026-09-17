/** Lawyer-only case assistant with BYOK provider, cited chat, and PDF draft tools. */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, FileOutput, KeyRound, RefreshCw, Send, ShieldAlert, Trash2 } from 'lucide-react';

import {
  type AiChat,
  type AiFormDraftSummary,
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
  downloadAiFormDraft,
  disconnectAiProvider,
  getAiChat,
  getCaseDocumentViewUrl,
  getAiProviderModels,
  indexCaseForAi,
  initiateCaseDocumentUpload,
  listAiProviderConnections,
  listAiFormDrafts,
  listCaseAiChats,
  selectAiProviderModel,
  sendAiChatMessage,
} from '@/lib/api';

type AiAssistantSectionProps = {
  workspace: CaseWorkspace;
  onWorkspaceRefresh: () => Promise<void>;
  workspaceMode?: boolean;
};

const STARTER_PROMPTS = [
  'Summarize the strongest facts in this matter and cite the record.',
  'What information is missing before the next filing milestone?',
  'Compare the client profile with the submitted identity documents.',
  'Create a lawyer review checklist for this matter.',
];

export function AiAssistantSection({
  workspace,
  onWorkspaceRefresh,
  workspaceMode = false,
}: AiAssistantSectionProps) {
  const caseNumber = workspace.case.case_number;
  const [connections, setConnections] = useState<AiProviderConnection[]>([]);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [approved, setApproved] = useState(false);
  const [models, setModels] = useState<AiProviderModels | null>(null);
  const [chats, setChats] = useState<AiChat[]>([]);
  const [chat, setChat] = useState<AiChat | null>(null);
  const [question, setQuestion] = useState('');
  const [formDocumentId, setFormDocumentId] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formDrafts, setFormDrafts] = useState<AiFormDraftSummary[]>([]);
  const [formResult, setFormResult] = useState<{
    warning: string;
    provider: AiProvider;
    requestedModel: string;
    model: string;
    finishReason: string | null;
    promptVersion: string;
    sourceSha256: string;
    downloadUrl: string;
    fileName: string;
    expiresInSeconds: number;
    unresolved: string[];
    unsupported: string[];
    evidence: Record<string, { value: string; sources: string[] }>;
    citations: Array<{ source_id: string; case_document_id: string; document_name: string; page_number: number | null }>;
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
      const [connectionsResult, chatsResult, draftsResult] = await Promise.allSettled([
        listAiProviderConnections(),
        listCaseAiChats(caseNumber),
        listAiFormDrafts(caseNumber),
      ]);
      if (ignore) return;
      if (connectionsResult.status === 'fulfilled') {
        const providerConnections = connectionsResult.value;
        setConnections(providerConnections);
        const initialConnection = providerConnections[0];
        if (initialConnection) {
          setProvider(initialConnection.provider);
          try {
            const availableModels = await getAiProviderModels(initialConnection.provider);
            if (!ignore) setModels(availableModels);
          } catch (modelError) {
            if (!ignore) {
              setError(
                modelError instanceof Error
                  ? modelError.message
                  : 'AI generation is unavailable; stored keys can still be disconnected'
              );
            }
          }
        }
      } else {
        setError(
          connectionsResult.reason instanceof Error
            ? connectionsResult.reason.message
            : 'Unable to load AI provider connections'
        );
      }
      if (chatsResult.status === 'fulfilled') {
        const caseChats = chatsResult.value;
        setChats(caseChats);
        if (caseChats[0]) {
          try {
            const initialChat = await getAiChat(caseChats[0].id);
            if (!ignore) setChat(initialChat);
          } catch (chatError) {
            if (!ignore) {
              setError(chatError instanceof Error ? chatError.message : 'Unable to load AI chat');
            }
          }
        }
      } else if (connectionsResult.status === 'fulfilled') {
        setError(
          chatsResult.reason instanceof Error
            ? chatsResult.reason.message
            : 'AI generation is unavailable; stored keys can still be disconnected'
        );
      }
      if (draftsResult.status === 'fulfilled') {
        setFormDrafts(draftsResult.value);
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
    let saved: AiProviderConnection;
    try {
      saved = await connectAiProvider({
        provider,
        api_key: apiKey,
        data_processing_acknowledged: approved,
        current_password: currentPassword,
        mfa_code: mfaCode.trim() || null,
      });
      setConnections((current) => [
        ...current.filter((item) => item.provider !== saved.provider),
        saved,
      ]);
      setApiKey('');
      setCurrentPassword('');
      setMfaCode('');
      setApproved(false);
      setNotice(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} connected.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Provider connection failed');
      setBusy(null);
      return;
    }
    try {
      setModels(await getAiProviderModels(provider));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? `Provider connected, but models could not be refreshed: ${requestError.message}`
          : 'Provider connected, but models could not be refreshed'
      );
    } finally {
      setBusy(null);
    }
  };

  const changeModel = async (selectedModel: string) => {
    if (!selectedModel) return;
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

  const disconnectProvider = async () => {
    if (
      !connected ||
      !window.confirm(
        `Disconnect ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} and delete its stored key?`
      )
    ) {
      return;
    }
    setBusy('disconnect-provider');
    setError(null);
    try {
      await disconnectAiProvider(provider);
      setConnections((current) => current.filter((item) => item.provider !== provider));
      setModels(null);
      setNotice(`${provider === 'openai' ? 'OpenAI' : 'Anthropic'} disconnected.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not disconnect provider');
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
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not delete chat');
      setBusy(null);
      return;
    }
    const remaining = chats.filter((item) => item.id !== chat.id);
    setChats(remaining);
    if (!remaining[0]) {
      setChat(null);
      setBusy(null);
      return;
    }
    try {
      setChat(await getAiChat(remaining[0].id));
    } catch (requestError) {
      setChat(null);
      setNotice('Conversation deleted, but the next chat could not be loaded.');
      setError(requestError instanceof Error ? requestError.message : 'Could not load next chat');
    } finally {
      setBusy(null);
    }
  };

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy('message');
    setError(null);
    let target = chat;
    try {
      if (!target) {
        target = await createCaseAiChat(caseNumber, question.trim().slice(0, 80));
        setChats((current) => [target as AiChat, ...current]);
        setChat(target);
      }
      await sendAiChatMessage(target.id, question.trim(), provider);
      setQuestion('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'AI request failed');
      setBusy(null);
      return;
    }
    try {
      setChat(await getAiChat(target.id));
    } catch (requestError) {
      setNotice('Answer created, but the conversation could not be refreshed.');
      setError(requestError instanceof Error ? requestError.message : 'Conversation refresh failed');
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
    try {
      const draft = await createAiFormDraft(
        caseNumber,
        formDocumentId,
        provider,
        formInstructions.trim() || null
      );
      setFormResult({
        warning: draft.warning,
        provider: draft.provider,
        requestedModel: draft.requested_model,
        model: draft.model,
        finishReason: draft.finish_reason,
        promptVersion: draft.prompt_version,
        sourceSha256: draft.source_sha256,
        downloadUrl: draft.download_url,
        fileName: draft.file_name,
        expiresInSeconds: draft.expires_in_seconds,
        unresolved: draft.unresolved_fields,
        unsupported: draft.unsupported_fields,
        evidence: draft.field_evidence,
        citations: draft.citations,
      });
      try {
        setFormDrafts(await listAiFormDrafts(caseNumber));
      } catch {
        setNotice('Draft created, but history could not be refreshed.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Form draft failed');
    } finally {
      setBusy(null);
    }
  };

  const openSource = async (documentId: string, pageNumber?: number | null) => {
    const popup = window.open('', '_blank');
    try {
      const source = await getCaseDocumentViewUrl(caseNumber, documentId);
      const viewUrl = pageNumber
        ? `${source.view_url}#page=${encodeURIComponent(String(pageNumber))}`
        : source.view_url;
      if (popup && !popup.closed) {
        popup.opener = null;
        popup.location.href = viewUrl;
      } else {
        window.location.assign(viewUrl);
      }
    } catch (requestError) {
      popup?.close();
      setError(requestError instanceof Error ? requestError.message : 'Could not open source document');
    }
  };

  const downloadPriorDraft = async (draftId: string) => {
    const popup = window.open('', '_blank');
    setError(null);
    try {
      const draft = await downloadAiFormDraft(caseNumber, draftId);
      if (popup && !popup.closed) {
        popup.opener = null;
        popup.location.href = draft.download_url;
      } else {
        window.location.assign(draft.download_url);
      }
    } catch (requestError) {
      popup?.close();
      setError(requestError instanceof Error ? requestError.message : 'Could not download draft');
    }
  };

  const uploadForm = async (file: File) => {
    if (
      !file.name.toLowerCase().endsWith('.pdf') ||
      (file.type && file.type !== 'application/pdf')
    ) {
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
        file_type: 'application/pdf',
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
        file_type: 'application/pdf',
        file_size_bytes: file.size,
        client_note: 'Official form uploaded by the legal team.',
      });
      setNotice('PDF uploaded to quarantine. Generate a draft after malware scanning is clean.');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'PDF form upload failed');
      setBusy(null);
      return;
    }
    try {
      await onWorkspaceRefresh();
    } catch (refreshError) {
      setNotice('PDF uploaded to quarantine, but the case view could not be refreshed.');
      setError(refreshError instanceof Error ? refreshError.message : 'Case refresh failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={workspaceMode ? 'flex flex-col gap-4' : 'space-y-6'}
      aria-busy={busy !== null}
    >
      <div className={workspaceMode ? 'order-1' : undefined}>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef0ff] text-[#5661ce]">
            <Bot className="h-5 w-5" />
          </span>
          <h2 className={`${workspaceMode ? 'text-xl' : 'text-2xl'} font-semibold tracking-tight text-slate-900`}>
            Matter copilot
          </h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Ask questions grounded in this client&apos;s structured case data and locally indexed,
          malware-clean documents.
        </p>
      </div>

      <div className={`order-2 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950`}>
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          AI output may be incomplete or wrong. Verify citations and source records. No chat
          response submits, signs, or changes an immigration application.
        </p>
      </div>

      {error ? <p role="alert" className="order-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p role="status" className="order-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <section className={`${workspaceMode ? 'order-5' : ''} rounded-2xl border border-slate-200 bg-slate-50/70 p-5`} aria-labelledby="ai-provider-heading">
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
                setApiKey('');
                setCurrentPassword('');
                setMfaCode('');
                setApproved(false);
                setError(null);
                const nextConnection = connections.find((item) => item.provider === next);
                setModels(null);
                if (nextConnection) {
                  void getAiProviderModels(next)
                    .then(setModels)
                    .catch((requestError) => {
                      setError(
                        requestError instanceof Error
                          ? requestError.message
                          : 'Could not load provider models'
                      );
                    });
                }
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
          <div>
            <label htmlFor="ai-current-password" className="block text-sm font-medium text-gray-700">
              Current VisaTrack password
            </label>
            <input
              id="ai-current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="ai-mfa-code" className="block text-sm font-medium text-gray-700">
              MFA code (required when MFA is enabled)
            </label>
            <input
              id="ai-mfa-code"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
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
              value={models.selected_model ?? models.recommended_model ?? ''}
              disabled={busy !== null}
              onChange={(event) => void changeModel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {models.selected_model && !models.models.includes(models.selected_model) ? (
                <option value={models.selected_model} disabled>
                  {models.selected_model} · Unavailable—select an approved replacement
                </option>
              ) : null}
              {models.models.map((model) => (
                <option key={model} value={model}>
                  {model}{model === models.recommended_model ? ' · Recommended model' : ''}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              The recommended model is selected when the key is connected and then pinned to prevent
              silent model or retention-policy changes. Review and select a replacement explicitly.
            </p>
            {models.selected_model && !models.models.includes(models.selected_model) ? (
              <p role="alert" className="mt-2 text-sm text-red-700">
                The pinned model is unavailable. AI requests will remain blocked until you select a replacement.
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void disconnectProvider()}
              className="mt-3 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
            >
              {busy === 'disconnect-provider' ? 'Disconnecting…' : 'Disconnect provider'}
            </button>
          </div>
        ) : null}
        {connected && !models ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void disconnectProvider()}
            className="mt-4 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
          >
            {busy === 'disconnect-provider' ? 'Disconnecting…' : 'Disconnect provider'}
          </button>
        ) : null}
      </section>

      <section className={`${workspaceMode ? 'order-4' : ''} overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm`} aria-labelledby="ai-chat-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="ai-chat-heading" className="font-semibold text-slate-900">Ask the matter</h3>
            <p className="mt-0.5 text-xs text-slate-500">Answers stay scoped to this matter and identify retrieved sources.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refreshIndex()} disabled={busy !== null} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className="h-4 w-4" /> {busy === 'index' ? 'Queueing…' : 'Refresh sources'}
            </button>
            <button type="button" onClick={() => void newChat()} disabled={busy !== null || !connected} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
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
          <label className="mt-4 block text-xs font-medium text-slate-600">
            Conversation
            <select
              value={chat?.id ?? ''}
              onChange={(event) => void openChat(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="" disabled>Select a chat</option>
              {chats.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
        ) : null}
        {!chat?.messages.length ? (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5">
            <p className="text-sm font-medium text-slate-800">Start with a focused request</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              The assistant can organize and compare the matter record. It cannot act as counsel or file on your behalf.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuestion(prompt)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs leading-5 text-slate-600 hover:border-[#aeb5ef] hover:text-[#4651b5]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div
          className={`${chat?.messages.length ? 'mt-5 min-h-32' : 'mt-3'} max-h-[34rem] space-y-4 overflow-y-auto rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#6674e8]`}
          role="log"
          aria-label="Conversation transcript"
          tabIndex={0}
        >
          {chat?.messages.map((message) => (
            <article
              key={message.id}
              aria-label={message.role === 'user' ? 'Your message' : 'AI assistant response'}
              className={`rounded-2xl p-4 text-sm leading-6 ${message.role === 'user' ? 'ml-8 bg-[#eef0ff] text-slate-800' : 'mr-8 border border-slate-200 bg-white text-slate-800 shadow-sm'}`}
            >
              <p className="whitespace-pre-wrap text-gray-900">{message.content}</p>
              {message.role === 'assistant' && message.provider && message.model ? (
                <p className="mt-2 text-xs text-gray-500">
                  {message.provider} / {message.model}
                  {message.requested_model && message.requested_model !== message.model
                    ? ` · requested ${message.requested_model}`
                    : ''}
                  {message.prompt_version ? ` · prompt ${message.prompt_version}` : ''}
                </p>
              ) : null}
              {message.citations.length > 0 ? (
                <details className="mt-3 text-xs text-gray-700">
                  <summary className="cursor-pointer font-medium">Sources ({message.citations.length})</summary>
                  <ul className="mt-2 space-y-2">
                    {message.citations.map((citation) => (
                      <li key={`${message.id}-${citation.source_id}`}>
                        <button
                          type="button"
                          className="font-semibold text-blue-800 underline"
                          onClick={() => void openSource(citation.case_document_id, citation.page_number)}
                        >
                          {citation.source_id} · {citation.document_name}
                        </button>
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
        <form onSubmit={ask} className="mt-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_12px_35px_-18px_rgba(33,45,80,0.45)] focus-within:border-[#8f99e7]">
          <label htmlFor="ai-question" className="sr-only">Ask about this case</label>
          <textarea
            id="ai-question"
            rows={3}
            maxLength={12000}
            required
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What passport expiry date is supported by the submitted documents?"
            className="min-h-24 w-full resize-none border-0 bg-transparent px-3 py-2 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-2 pt-2">
            <p className="text-[11px] text-slate-600">
              {connected ? `${provider} · ${models?.selected_model ?? 'approved model'}` : 'Connect an approved provider to begin'}
            </p>
            <button type="submit" disabled={busy !== null || !connected} className="flex items-center gap-2 rounded-xl bg-[#5b67d8] px-4 py-2 text-sm font-medium text-white hover:bg-[#4f5bc8] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send question">
              <Send className="h-4 w-4" />
              {busy === 'message' ? 'Working…' : 'Send'}
            </button>
          </div>
        </form>
      </section>

      <section className={`${workspaceMode ? 'order-6' : ''} rounded-2xl border border-slate-200 bg-slate-50/70 p-5`} aria-labelledby="ai-form-heading">
        <h3 id="ai-form-heading" className="flex items-center gap-2 font-semibold text-gray-900">
          <FileOutput className="h-4 w-4" /> Create PDF form review draft
        </h3>
        <p className="mt-1 text-xs text-gray-600">
          Supports standard AcroForm PDFs only. IRCC XFA/barcode forms still require Adobe Acrobat Reader.
        </p>
        {models && !models.form_drafts_enabled ? (
          <p role="status" className="mt-2 text-sm text-amber-800">
            Form drafting is disabled until your firm approves exact PDF revisions.
          </p>
        ) : null}
        <label className={`mt-4 flex w-fit items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-red-500 ${busy === 'form-upload' ? 'cursor-wait opacity-50' : models?.form_drafts_enabled === false ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}>
          {busy === 'form-upload' ? 'Uploading and quarantining…' : 'Upload official PDF form'}
          <input
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            disabled={busy !== null || models?.form_drafts_enabled === false}
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
          <button type="submit" disabled={busy !== null || !connected || !formDocumentId || models?.form_drafts_enabled === false} className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
            {busy === 'form' ? 'Generating review draft…' : 'Generate review draft'}
          </button>
        </form>
        {formResult ? (
          <div role="status" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p>{formResult.warning}</p>
            <p className="mt-2 text-xs">
              Generated with {formResult.provider} / {formResult.model}. Template SHA-256:{' '}
              <code className="break-all">{formResult.sourceSha256}</code>
              {' '}Prompt: {formResult.promptVersion}.
              {formResult.requestedModel !== formResult.model
                ? ` Requested model: ${formResult.requestedModel}.`
                : ''}
              {formResult.finishReason ? ` Finish reason: ${formResult.finishReason}.` : ''}
            </p>
            {formResult.unresolved.length > 0 ? (
              <p className="mt-2">Unresolved fields: {formResult.unresolved.join(', ')}</p>
            ) : null}
            {formResult.unsupported.length > 0 ? (
              <p className="mt-2">
                Unsupported controls requiring manual completion: {formResult.unsupported.join(', ')}
              </p>
            ) : null}
            {Object.keys(formResult.evidence).length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer font-medium">
                  Populated field evidence ({Object.keys(formResult.evidence).length})
                </summary>
                <dl className="mt-2 space-y-2">
                  {Object.entries(formResult.evidence).map(([field, evidence]) => (
                    <div key={field}>
                      <dt className="font-medium">{field}</dt>
                      <dd>{evidence.value} · Sources: {evidence.sources.join(', ')}</dd>
                    </div>
                  ))}
                </dl>
                {formResult.citations.length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {formResult.citations.map((citation) => (
                      <li key={citation.source_id}>
                        <button
                          type="button"
                          className="font-medium underline"
                          onClick={() => void openSource(citation.case_document_id, citation.page_number)}
                        >
                          {citation.source_id}: {citation.document_name}
                        </button>
                        {citation.page_number ? `, page ${citation.page_number}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ) : null}
            <p className="mt-3 text-xs">
              Review the evidence and unresolved controls before downloading. This link expires in{' '}
              {Math.max(1, Math.floor(formResult.expiresInSeconds / 60))} minutes.
            </p>
            <a
              href={formResult.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
            >
              Download {formResult.fileName}
            </a>
          </div>
        ) : null}
        {formDrafts.length > 0 ? (
          <div className="mt-5">
            <h4 className="text-sm font-semibold text-gray-900">Recent review drafts</h4>
            <ul className="mt-2 space-y-2">
              {formDrafts.slice(0, 10).map((draft) => (
                <li
                  key={draft.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-gray-900">{draft.file_name}</p>
                    <p className="text-xs text-gray-600">
                      {draft.status} · {draft.provider} / {draft.model} ·{' '}
                      {draft.unresolved_fields.length} unresolved ·{' '}
                      {draft.unsupported_fields.length} unsupported
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadPriorDraft(draft.id)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    Get new download link
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
