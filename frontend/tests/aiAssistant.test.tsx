import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockCaseWorkspace } from '../design-system/storybook/fixtures';
import { AiAssistantSection } from '../design-system/components/case-configuration/sections/AiAssistantSection';

vi.mock('@/lib/api', () => ({
  listAiProviderConnections: vi.fn(async () => []),
  listCaseAiChats: vi.fn(async () => []),
  getAiProviderModels: vi.fn(async () => ({
    provider: 'openai',
    models: ['gpt-test'],
    selected_model: 'gpt-test',
  })),
  getAiChat: vi.fn(),
  connectAiProvider: vi.fn(),
  selectAiProviderModel: vi.fn(),
  indexCaseForAi: vi.fn(),
  createCaseAiChat: vi.fn(),
  deleteAiChat: vi.fn(),
  sendAiChatMessage: vi.fn(),
  createAiFormDraft: vi.fn(),
  createCaseCustomDocument: vi.fn(),
  initiateCaseDocumentUpload: vi.fn(),
  completeCaseDocumentUpload: vi.fn(),
}));

describe('AiAssistantSection', () => {
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
});
