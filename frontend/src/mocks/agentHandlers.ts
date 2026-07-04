import { http, HttpResponse } from 'msw'

const mockSessions = [
  {
    key: 'main',
    title: 'Main Session',
    projectId: null,
    createdAt: '2026-03-06T10:00:00Z',
    updatedAt: '2026-03-06T12:00:00Z',
    messageCount: 5,
    lastMessage: 'What is NVDA revenue?',
    isActive: true,
    replying: false,
  },
  {
    key: 'session-2',
    title: 'LLY Analysis',
    projectId: 'lly-project',
    createdAt: '2026-03-05T08:00:00Z',
    updatedAt: '2026-03-05T16:00:00Z',
    messageCount: 12,
    lastMessage: 'Show me the GLP-1 pipeline',
    isActive: false,
    replying: false,
  },
]

const mockHistory = [
  {
    type: 'user' as const,
    id: 'msg-1',
    text: 'What is NVDA revenue for 2024?',
    attachments: [],
    timestamp: Date.now() - 60000,
  },
  {
    type: 'agent' as const,
    id: 'msg-2',
    text: "NVIDIA reported **$60.9 billion** in revenue for fiscal year 2024, representing a **126% year-over-year increase**. The Data Center segment was the primary growth driver at $47.5B.",
    citations: [{ refId: 'nvda-10k', rowNumber: 42, sourceTitle: 'NVDA 10-K' }],
    model: 'claude-sonnet-4-5-20250514',
    provider: 'anthropic',
    durationMs: 2340,
    timestamp: Date.now() - 55000,
  },
]

export const agentHandlers = [
  http.get('*/api/sessions', () => {
    return HttpResponse.json({
      sessions: mockSessions,
      hasMore: false,
      nextCursor: null,
      total: mockSessions.length,
    })
  }),

  http.get('*/api/sessions/:key/history', () => {
    return HttpResponse.json({
      messages: mockHistory,
      hasMore: false,
      nextCursor: null,
    })
  }),

  http.get('*/api/auth/status', () => {
    return HttpResponse.json({
      authenticated: true,
      setup_required: false,
    })
  }),
]
