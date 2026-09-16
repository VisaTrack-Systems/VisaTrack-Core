import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockCaseWorkspace } from '../design-system/storybook/fixtures';
import { AiAssistantSection } from '../design-system/components/case-configuration/sections/AiAssistantSection';
import {
  disconnectAiProvider,
  getAiChat,
  listAiProviderConnections,
  listCaseAiChats,
  sendAiChatMessage,
} from '@/lib/api';

vi.mock('@/lib/api', () => ({
  listAiProviderConnections: vi.fn(async () => []),
  listCaseAiChats: vi.fn(async () => []),
  getAiProviderModels: vi.fn(async () => ({
    provider: 'openai',
    models: ['gpt-test'],
    selected_model: 'gpt-test',
    recommended_model: 'gpt-test',
    form_drafts_enabled: false,
  })),
  getAiChat: vi.fn(),
  getCaseDocumentViewUrl: vi.fn(),
  connectAiProvider: vi.fn(),
  selectAiProviderModel: vi.fn(),
  indexCaseForAi: vi.fn(),
  createCaseAiChat: vi.fn(),
  deleteAiChat: vi.fn(),
  disconnectAiProvider: vi.fn(),
  sendAiChatMessage: vi.fn(),
  createAiFormDraft: vi.fn(),
  createCaseCustomDocument: vi.fn(),
  initiateCaseDocumentUpload: vi.fn(),
  completeCaseDocumentUpload: vi.fn(),
}));

describe('AiAssistantSection', () => {
  beforeEach(() => {
    vi.mocked(listAiProviderConnections).mockResolvedValue([]);
    vi.mocked(listCaseAiChats).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('explains provider approval, citations, and form review boundaries', async () => {
    render(<AiAssistantSection workspace={mockCaseWorkspace} onWorkspaceRefresh={async () => {}} />);

    expect(await screen.findByRole('heading', { name: 'Case AI Assistant' })).toBeInTheDocument();
    expect(screen.getByText(/AI output may be incomplete or wrong/)).toBeInTheDocument();
    expect(screen.getByText(/firm approved this provider/)).toBeInTheDocument();
    expect(screen.getByText(/Supports standard AcroForm PDFs only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  });

  it('binds requests to the visible provider and can remove its stored key', async () => {
    const chat = {
      id: 'chat-1',
      case_id: mockCaseWorkspace.case.id,
      title: 'Case assistant',
      created_at: '2026-09-16T00:00:00Z',
      updated_at: '2026-09-16T00:00:00Z',
      messages: [],
    };
    vi.mocked(listAiProviderConnections).mockResolvedValue([
      {
        provider: 'openai',
        key_hint: '…1234',
        selected_model: 'gpt-test',
        last_verified_at: '2026-09-16T00:00:00Z',
        data_processing_acknowledged_at: '2026-09-16T00:00:00Z',
        acknowledgement_version: '2026-09-16-v1',
      },
    ]);
    vi.mocked(listCaseAiChats).mockResolvedValue([chat]);
    vi.mocked(getAiChat).mockResolvedValue(chat);
    vi.mocked(sendAiChatMessage).mockResolvedValue({
      id: 'message-1',
      role: 'assistant',
      content: 'Answer',
      citations: [],
      provider: 'openai',
      model: 'gpt-test',
      prompt_version: 'chat-2026-09-16-v1',
      created_at: '2026-09-16T00:00:00Z',
    });
    vi.mocked(disconnectAiProvider).mockResolvedValue();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AiAssistantSection workspace={mockCaseWorkspace} onWorkspaceRefresh={async () => {}} />);

    const question = await screen.findByLabelText('Ask about this case');
    expect(screen.getByText(/Form drafting is disabled/)).toBeInTheDocument();
    await userEvent.type(question, 'What is supported?');
    await userEvent.click(screen.getByRole('button', { name: 'Send question' }));

    await waitFor(() => {
      expect(sendAiChatMessage).toHaveBeenCalledWith(
        'chat-1',
        'What is supported?',
        'openai'
      );
    });

    await userEvent.click(screen.getByRole('button', { name: 'Disconnect provider' }));
    await waitFor(() => {
      expect(disconnectAiProvider).toHaveBeenCalledWith('openai');
    });
  });
});
