// =====================================================
// App-wide Constants
// =====================================================

module.exports = {
  // ── Roles ──
  ROLES: {
    CLIENT: 'client',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin',
  },

  // ── Agent Limits per Plan ──
  PLAN_LIMITS: {
    free: { agents: 1, callMinutes: 10, chatMessages: 100, documents: 2, tools: 2 },
    bronze: { agents: 3, callMinutes: 100, chatMessages: 1000, documents: 10, tools: 5 },
    silver: { agents: 5, callMinutes: 500, chatMessages: 5000, documents: 50, tools: 15 },
    gold: { agents: 10, callMinutes: 2000, chatMessages: 20000, documents: 200, tools: 50 },
  },

  // ── Embedding ──
  EMBEDDING_MODEL: 'text-embedding-3-small',
  EMBEDDING_DIMENSIONS: 1536,
  CHUNK_SIZE: 800,
  CHUNK_OVERLAP: 200,

  // ── File Upload ──
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'],

  // ── Tool Calling ──
  TOOL_TIMEOUT_DEFAULT: 5000,
  TOOL_TIMEOUT_MAX: 30000,
  TOOL_RETRIES_MAX: 3,

  // ── Queue Names ──
  QUEUES: {
    ANALYSIS: 'call-analysis',
    EXTRACTION: 'variable-extraction',
    EMBEDDING: 'document-embedding',
    WEBHOOK: 'outgoing-webhooks',
    NOTIFICATION: 'notifications',
  },

  // ── Pagination ──
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};
