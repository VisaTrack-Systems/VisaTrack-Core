import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiFormDraft, sendAiChatMessage } from '@/lib/api';


describe('AI API request controls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends an explicit provider and idempotency key for chat', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          id: 'message-1',
          role: 'assistant',
          content: 'Answer',
          citations: [],
          provider: 'openai',
          model: 'gpt-test',
          prompt_version: 'chat-2026-09-16-v1',
          created_at: '2026-09-16T00:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await sendAiChatMessage(
      'chat-1',
      'Question',
      'openai',
      'chat-request-1234'
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
      'chat-request-1234'
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      content: 'Question',
      provider: 'openai',
    });
  });

  it('sends provider provenance and idempotency for form drafts', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          id: 'draft-1',
          source_document_id: 'document-1',
          file_name: 'draft.pdf',
          download_url: 'https://example.test/draft',
          expires_in_seconds: 900,
          provider: 'anthropic',
          model: 'claude-test',
          prompt_version: 'form-2026-09-16-v1',
          source_sha256: 'a'.repeat(64),
          populated_fields: [],
          unresolved_fields: [],
          unsupported_fields: [],
          field_evidence: {},
          citations: [],
          warning: 'Review',
          created_at: '2026-09-16T00:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    await createAiFormDraft(
      'C-1',
      'document-1',
      'anthropic',
      null,
      'form-request-1234'
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(
      'form-request-1234'
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      source_document_id: 'document-1',
      provider: 'anthropic',
      instructions: null,
    });
  });
});
