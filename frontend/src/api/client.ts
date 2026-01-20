import { getPersistedLocale } from "../i18n/locale";

export const API_BASE =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ;

export function setToken(token: string) {
  localStorage.setItem("skh_token", token);
}
export function getToken(): string | null {
  return localStorage.getItem("skh_token");
}
export function clearToken() {
  localStorage.removeItem("skh_token");
}

async function request(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as any),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const locale = getPersistedLocale();
  if (locale) headers["Accept-Language"] = locale;

  let res: Response;
  const url = `${API_BASE}${path}`;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err: any) {
    throw new Error(`Backend unreachable at ${url}`);
  }
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = contentType.includes("application/json") ? await res.json() : await res.text();
      msg =
        (data && typeof data === "object" && "detail" in data && (data as any).detail) ||
        (typeof data === "string" && data) ||
        msg;
    } catch {
      // ignore parse errors
    }
    throw new Error(`${msg} (${url})`);
  }

  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

export type DocumentSummary = {
  id: number;
  area_id: number;
  title: string;
  original_name: string;
  mime_type: string;
  tags: string[];
  latest_version: number;
  created_at: string;
  deleted_at?: string | null;
};

export type DocumentVersion = {
  id: number;
  version: number;
  original_name: string;
  mime_type: string;
  created_at: string;
};

export type DocumentDetail = DocumentSummary & {
  versions: DocumentVersion[];
};

export type AreaMembership = { area_id: number; can_read: boolean; can_manage: boolean };
export type Area = { id: number; key: string; name: string; color?: string | null };
export type TagCategory = { id: number; key: string; name: string; description?: string | null };
export type Tag = {
  id: number;
  category_id: number;
  key: string;
  label: string;
  deprecated: boolean;
  category?: TagCategory | null;
};
export type TagSuggestion = {
  id: number;
  category_id: number;
  label: string;
  note?: string | null;
  status: string;
  created_at: string;
};
export type KnowledgeBaseArea = { id: number; key: string; name: string; description?: string | null; order_index: number };
export type KnowledgeBaseCollection = {
  id: number;
  area_id: number;
  name: string;
  description?: string | null;
  order_index: number;
};
export type TagRef = { id: number; key: string; label: string; category_key: string; category_name: string };
export type ContentItem = {
  id: number;
  area_id: number;
  collection_id?: number | null;
  title: string;
  body: string;
  summary?: string | null;
  status: "DRAFT" | "APPROVED" | "ARCHIVED";
  language: string;
  owner_user_id?: number | null;
  owner_name?: string | null;
  metrics?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  tags: TagRef[];
};
export type AccuracyLevel = "LOW" | "MEDIUM" | "HIGH";
export type AnswerTone = "TECHNICAL" | "EXECUTIVE" | "COLLOQUIAL";
export type Highlight = { start: number; end: number };
export type CopilotSource = {
  chunk_id?: number;
  document_id: number;
  document_title?: string;
  version_id?: number;
  chunk_index: number;
  chunk_text: string;
  heading_path?: string;
  score: number;
   area_id?: number | null;
   area_name?: string | null;
   area_color?: string | null;
  highlights?: Highlight[];
};
export type CopilotMeta = {
  accuracy_level: AccuracyLevel;
  answer_tone: AnswerTone;
  evidence_level?: string;
  latency_ms?: number;
  timings?: Record<string, number>;
  tone_reference?: string;
  tone_preview?: string;
  confidence_percent?: number;
  confidence_label?: string;
  confidence_explanation?: string;
  tokens_in?: number | null;
  tokens_out?: number | null;
  conversation_id?: string | null;
   accuracy_percent?: number | null;
   areas?: { id?: number | null; name?: string | null; color?: string | null }[] | null;
};
export type CopilotAskResponse = {
  answer: string;
  matches: CopilotSource[];
  sources: CopilotSource[];
  accuracy_level: AccuracyLevel;
  answer_tone: AnswerTone;
  best_score?: number;
  meta?: CopilotMeta;
  conversation_id?: string;
  message_id?: string;
  user_message_id?: string;
};
export type Conversation = {
  id: string;
  title?: string | null;
  area_id?: number | null;
  workspace_id?: number | null;
  created_by_user_id: number;
  created_at: string;
  updated_at: string;
  last_message_preview?: string | null;
};
export type ConversationMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, any> | null;
  created_at: string;
};
export type ConversationDetail = Conversation & { messages: ConversationMessage[] };
export type AreaAccess = {
  id: number;
  user_id: number;
  area_id: number;
  granted_by_user_id: number | null;
  source: string;
  created_at: string;
  area?: Area;
};
export type AccessRequest = {
  id: number;
  requester_user_id: number;
  area_id: number;
  status: string;
  message?: string | null;
  decided_by_user_id?: number | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  created_at: string;
  area: Area;
  requester?: {
    id: number;
    email: string;
    full_name: string;
    role: string;
  } | null;
};

export type LegalDocumentStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "SIGNED"
  | "ARCHIVED"
  | "REJECTED";

export type LegalApprovalDecision = "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";

export type LegalAuditLog = {
  id: number;
  document_id?: number | null;
  actor_id?: number | null;
  action: string;
  metadata?: Record<string, any> | null;
  created_at: string;
};

export type LegalApproval = {
  id: number;
  document_id: number;
  step_number: number;
  approver_id: number;
  decision: LegalApprovalDecision;
  comment?: string | null;
  decided_at?: string | null;
};

export type LegalVersion = {
  id: number;
  document_id: number;
  version_number: number;
  content: string;
  variables?: Record<string, any> | null;
  created_by?: number | null;
  created_at: string;
};

export type LegalDocument = {
  id: number;
  title: string;
  type: string;
  counterparty_name?: string | null;
  counterparty_email?: string | null;
  owner_id: number;
  owner_name?: string | null;
  owner_email?: string | null;
  status: LegalDocumentStatus;
  content: string;
  variables?: Record<string, any> | null;
  due_date?: string | null;
  expiry_date?: string | null;
  created_at: string;
  updated_at: string;
};

export type LegalDocumentDetail = LegalDocument & { approvals: LegalApproval[] };

export type LegalTemplate = {
  id: number;
  name: string;
  type: string;
  body: string;
  variables: string[];
  default_approvers: number[];
  created_at: string;
  updated_at: string;
};

export type UserRef = { id: number; email: string; full_name: string; role: string };

export type LegalExampleStatus = "UPLOADED" | "EXTRACTING" | "READY" | "FAILED";
export type LegalExampleScope = "GLOBAL" | "TEMPLATE" | "CLIENT";

export type LegalExample = {
  id: string;
  title: string;
  document_type: string;
  template_id?: number | null;
  scope: LegalExampleScope;
  client_name?: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_by_name?: string | null;
  uploaded_by_email?: string | null;
  uploaded_at: string;
  updated_at: string;
  status: LegalExampleStatus;
  error_message?: string | null;
  tags: string[];
};

export type LegalExamplesList = { items: LegalExample[]; total: number };

export type LegalOverview = {
  counts: Record<string, number>;
  expiring_soon: number;
  recent_activity: LegalAuditLog[];
};

export const api = {
  login: (email: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),

  me: () => request("/auth/me"),

  listAreas: () => request("/areas"),
  listAllAreas: () => request("/areas/catalog"),
  myMemberships: () => request("/areas/me"),
  createAccessRequests: (area_ids: number[], message?: string) =>
    request("/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area_ids, message }),
    }),
  myAccessRequests: () => request("/access-requests/me"),
  cancelAccessRequest: (id: number) => request(`/access-requests/${id}/cancel`, { method: "POST" }),

  listDocuments: (params: {
    areaId?: number | null;
    q?: string;
    tags?: string[];
    sort?: "latest" | "name";
    includeDeleted?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.areaId) qs.set("area_id", String(params.areaId));
    if (params.q) qs.set("q", params.q);
    if (params.tags && params.tags.length) qs.set("tags", params.tags.join(","));
    if (params.sort) qs.set("sort", params.sort);
    if (params.includeDeleted) qs.set("include_deleted", "true");
    return request(`/documents${qs.toString() ? `?${qs.toString()}` : ""}`);
  },

  getDocument: (id: number) => request(`/documents/${id}`) as Promise<DocumentDetail>,

  updateDocument: (id: number, payload: { title?: string; tags?: string[] }) =>
    request(`/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  deleteDocument: (id: number) => request(`/documents/${id}`, { method: "DELETE" }),

  uploadDocument: async (area_id: number, title: string, file: File, tags: string[]) => {
    const fd = new FormData();
    fd.append("area_id", String(area_id));
    fd.append("title", title);
    fd.append("file", file);
    if (tags.length) fd.append("tags", JSON.stringify(tags));
    return request("/documents/upload", { method: "POST", body: fd });
  },

  uploadVersion: async (docId: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(`/documents/${docId}/versions`, { method: "POST", body: fd });
  },

  copilotAsk: (
    question: string,
    areaScope?: number | number[] | null,
    options?: { top_k?: number; accuracy_level?: AccuracyLevel; answer_tone?: AnswerTone; conversation_id?: string }
  ): Promise<CopilotAskResponse> => {
    const payload: Record<string, any> = {
      question,
      top_k: options?.top_k ?? 6,
      accuracy_level: options?.accuracy_level ?? "MEDIUM",
      answer_tone: options?.answer_tone ?? "EXECUTIVE",
    };
    if (Array.isArray(areaScope)) {
      payload.area_ids = areaScope;
    } else if (areaScope !== null && areaScope !== undefined) {
      payload.area_ids = [areaScope];
    }
    if (options?.conversation_id) payload.conversation_id = options.conversation_id;

    return request("/copilot/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  listConversations: () => request(`/conversations`),
  getConversation: (conversationId: string) =>
    request(`/conversations/${conversationId}`) as Promise<ConversationDetail>,
  createConversation: (area_id?: number | null, title?: string | null) =>
    request("/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area_id, title }),
    }),
  updateConversation: (conversationId: string, payload: { title?: string }) =>
    request(`/conversations/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  deleteConversation: (conversationId: string) => request(`/conversations/${conversationId}`, { method: "DELETE" }),

  analyticsOverview: (params: { range?: string; start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams();
    if (params.range) qs.set("range", params.range);
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);
    return request(`/analytics/overview${qs.toString() ? `?${qs.toString()}` : ""}`);
  },
  analyticsTopDocuments: (params: { range?: string; start_date?: string; end_date?: string; area_id?: number | null }) => {
    const qs = new URLSearchParams();
    if (params.range) qs.set("range", params.range);
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);
    if (params.area_id !== null && params.area_id !== undefined) qs.set("area_id", String(params.area_id));
    return request(`/analytics/top-documents${qs.toString() ? `?${qs.toString()}` : ""}`);
  },
  analyticsTopQuestions: (params: {
    range?: string;
    start_date?: string;
    end_date?: string;
    accuracy_level?: AccuracyLevel | null;
    answer_tone?: AnswerTone | null;
  }) => {
    const qs = new URLSearchParams();
    if (params.range) qs.set("range", params.range);
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);
    if (params.accuracy_level) qs.set("accuracy_level", params.accuracy_level);
    if (params.answer_tone) qs.set("answer_tone", params.answer_tone);
    return request(`/analytics/top-questions?${qs.toString()}`);
  },
  analyticsUnanswered: (params: {
    range?: string;
    start_date?: string;
    end_date?: string;
    accuracy_level?: AccuracyLevel | null;
    answer_tone?: AnswerTone | null;
  }) => {
    const qs = new URLSearchParams();
    if (params.range) qs.set("range", params.range);
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);
    if (params.accuracy_level) qs.set("accuracy_level", params.accuracy_level);
    if (params.answer_tone) qs.set("answer_tone", params.answer_tone);
    return request(`/analytics/unanswered?${qs.toString()}`);
  },
  analyticsQuestionsSummary: (params: { area_id: number; range?: string; start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams({ area_id: String(params.area_id) });
    if (params.range) qs.set("range", params.range);
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);
    return request(`/analytics/questions/summary?${qs.toString()}`);
  },
  analyticsQuestionsTrends: (params: { area_id: number; days?: number; range?: string; start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams({ area_id: String(params.area_id) });
    if (params.days) qs.set("days", String(params.days));
    if (params.range) qs.set("range", params.range);
    if (params.start_date) qs.set("start_date", params.start_date);
    if (params.end_date) qs.set("end_date", params.end_date);
    return request(`/analytics/questions/trends?${qs.toString()}`);
  },

  downloadUrl: (docId: number, version?: number) =>
    `${API_BASE}/documents/${docId}/download${version ? `?version=${version}` : ""}`,

  // Fetches the file with auth headers and returns a blob + filename for download.
  downloadDocument: async (docId: number, version?: number) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE}/documents/${docId}/download${version ? `?version=${version}` : ""}`;
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") || "";

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = contentType.includes("application/json") ? await res.json() : await res.text();
        msg =
          (data && typeof data === "object" && "detail" in data && (data as any).detail) ||
          (typeof data === "string" && data) ||
          msg;
      } catch {
        // ignore parse errors
      }
      throw new Error(msg);
    }

    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = (match && match[1]) || `document-${docId}${version ? `-v${version}` : ""}`;
    const blob = await res.blob();
    return { blob, filename };
  },

  legalOverview: () => request("/api/legal/overview") as Promise<LegalOverview>,
  listLegalDocuments: (params?: {
    q?: string;
    status?: LegalDocumentStatus | "";
    type?: string;
    owner_id?: number;
    counterparty?: string;
    sort?: "updated" | "expiry";
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    if (params?.owner_id) qs.set("owner_id", String(params.owner_id));
    if (params?.counterparty) qs.set("counterparty", params.counterparty);
    if (params?.sort) qs.set("sort", params.sort);
    return request(`/api/legal/documents${qs.toString() ? `?${qs.toString()}` : ""}`) as Promise<LegalDocument[]>;
  },
  createLegalDocument: (payload: {
    title: string;
    type: string;
    counterparty_name?: string;
    counterparty_email?: string;
    content?: string;
    variables?: Record<string, any>;
    due_date?: string | null;
    expiry_date?: string | null;
  }) =>
    request("/api/legal/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as Promise<LegalDocument>,
  getLegalDocument: (id: number) => request(`/api/legal/documents/${id}`) as Promise<LegalDocumentDetail>,
  updateLegalDocument: (
    id: number,
    payload: Partial<{
      title: string;
      counterparty_name: string;
      counterparty_email: string;
      content: string;
      variables: Record<string, any>;
      due_date: string | null;
      expiry_date: string | null;
    }>
  ) =>
    request(`/api/legal/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as Promise<LegalDocument>,
  duplicateLegalDocument: (id: number) =>
    request(`/api/legal/documents/${id}/duplicate`, { method: "POST" }) as Promise<LegalDocument>,
  submitLegalDocumentForReview: (id: number, payload?: { approver_ids?: number[] }) =>
    request(`/api/legal/documents/${id}/submit-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }) as Promise<LegalDocumentDetail>,
  approveLegalDocument: (id: number, payload?: { comment?: string }) =>
    request(`/api/legal/documents/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }) as Promise<LegalDocumentDetail>,
  requestChangesLegalDocument: (id: number, payload?: { comment?: string }) =>
    request(`/api/legal/documents/${id}/request-changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    }) as Promise<LegalDocumentDetail>,
  markSignedLegalDocument: (id: number) =>
    request(`/api/legal/documents/${id}/mark-signed`, { method: "POST" }) as Promise<LegalDocument>,
  archiveLegalDocument: (id: number) =>
    request(`/api/legal/documents/${id}/archive`, { method: "POST" }) as Promise<LegalDocument>,
  getLegalAudit: (id: number) => request(`/api/legal/documents/${id}/audit`) as Promise<LegalAuditLog[]>,
  getLegalVersions: (id: number) => request(`/api/legal/documents/${id}/versions`) as Promise<LegalVersion[]>,

  listLegalTemplates: () => request("/api/legal/templates") as Promise<LegalTemplate[]>,
  getLegalTemplate: (id: number) => request(`/api/legal/templates/${id}`) as Promise<LegalTemplate>,
  createLegalTemplate: (payload: { name: string; type: string; body: string; variables?: string[]; default_approvers?: number[] }) =>
    request("/api/legal/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as Promise<LegalTemplate>,
  updateLegalTemplate: (
    id: number,
    payload: Partial<{ name: string; type: string; body: string; variables: string[]; default_approvers: number[] }>
  ) =>
    request(`/api/legal/templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as Promise<LegalTemplate>,
  deleteLegalTemplate: (id: number) => request(`/api/legal/templates/${id}`, { method: "DELETE" }) as Promise<void>,
  generateLegalTemplate: (id: number, payload: { variables: Record<string, any>; selected_example_ids?: string[]; title?: string; counterparty_name?: string }) =>
    request(`/api/legal/templates/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as Promise<{ content: string; variables: Record<string, any>; used_example_ids: string[]; used_snippets: string[] }>,

  listLegalUsers: () => request("/api/legal/users") as Promise<UserRef[]>,

  uploadLegalExamples: async (payload: {
    files: File[];
    document_type: string;
    template_id?: number | null;
    title?: string;
    scope?: LegalExampleScope;
    client_name?: string;
    tags?: string[];
  }) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const form = new FormData();
    payload.files.forEach((f) => form.append("files", f));
    form.set("document_type", payload.document_type);
    if (payload.template_id !== undefined && payload.template_id !== null) form.set("template_id", String(payload.template_id));
    if (payload.title) form.set("title", payload.title);
    if (payload.scope) form.set("scope", payload.scope);
    if (payload.client_name) form.set("client_name", payload.client_name);
    if (payload.tags && payload.tags.length) form.set("tags", payload.tags.join(","));

    const url = `${API_BASE}/api/legal/examples`;
    const res = await fetch(url, { method: "POST", headers, body: form });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = contentType.includes("application/json") ? await res.json() : await res.text();
        msg =
          (data && typeof data === "object" && "detail" in data && (data as any).detail) ||
          (typeof data === "string" && data) ||
          msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    return (await res.json()) as LegalExample[];
  },
  listLegalExamples: (params?: {
    q?: string;
    document_type?: string;
    template_id?: number;
    status?: LegalExampleStatus;
    scope?: LegalExampleScope;
    counterparty_name?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.document_type) qs.set("document_type", params.document_type);
    if (params?.template_id) qs.set("template_id", String(params.template_id));
    if (params?.status) qs.set("status", params.status);
    if (params?.scope) qs.set("scope", params.scope);
    if (params?.counterparty_name) qs.set("counterparty_name", params.counterparty_name);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    return request(`/api/legal/examples${qs.toString() ? `?${qs.toString()}` : ""}`) as Promise<LegalExamplesList>;
  },
  getLegalExample: (id: string, params?: { counterparty_name?: string }) => {
    const qs = new URLSearchParams();
    if (params?.counterparty_name) qs.set("counterparty_name", params.counterparty_name);
    return request(`/api/legal/examples/${id}${qs.toString() ? `?${qs.toString()}` : ""}`) as Promise<LegalExample>;
  },
  updateLegalExample: (id: string, payload: Partial<{ title: string; document_type: string; template_id: number | null; scope: LegalExampleScope; client_name: string | null; tags: string[] }>) =>
    request(`/api/legal/examples/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }) as Promise<LegalExample>,
  deleteLegalExample: (id: string) => request(`/api/legal/examples/${id}`, { method: "DELETE" }) as Promise<void>,
  retryLegalExample: (id: string) => request(`/api/legal/examples/${id}/retry`, { method: "POST" }) as Promise<{ id: string; status: LegalExampleStatus }>,
  listTemplateExamples: (templateId: number) => request(`/api/legal/templates/${templateId}/examples`) as Promise<LegalExample[]>,
  downloadLegalExample: async (id: string, params?: { counterparty_name?: string }) => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const qs = new URLSearchParams();
    if (params?.counterparty_name) qs.set("counterparty_name", params.counterparty_name);
    const url = `${API_BASE}/api/legal/examples/${id}/download${qs.toString() ? `?${qs.toString()}` : ""}`;
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = contentType.includes("application/json") ? await res.json() : await res.text();
        msg =
          (data && typeof data === "object" && "detail" in data && (data as any).detail) ||
          (typeof data === "string" && data) ||
          msg;
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = (match && match[1]) || `legal-example-${id}`;
    const blob = await res.blob();
    return { blob, filename };
  },

  exportLegalDocument: async (id: number, format: "txt" | "pdf" | "docx" = "txt") => {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const url = `${API_BASE}/api/legal/documents/${id}/export?format=${format}`;
    const res = await fetch(url, { headers });
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const data = contentType.includes("application/json") ? await res.json() : await res.text();
        msg =
          (data && typeof data === "object" && "detail" in data && (data as any).detail) ||
          (typeof data === "string" && data) ||
          msg;
      } catch {
        // ignore parse errors
      }
      throw new Error(msg);
    }
    const disposition = res.headers.get("content-disposition") || "";
    const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
    const filename = (match && match[1]) || `legal-document-${id}.${format}`;
    const blob = await res.blob();
    return { blob, filename };
  },

  adminListUsers: () => request("/admin/users"),
  adminCreateUser: (payload: { email: string; full_name: string; password: string; role: string; area_ids: number[] }) =>
    request("/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  adminUpdateUser: (userId: number, payload: Partial<{ full_name: string; role: string; password: string }>) =>
    request(`/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  adminGrantAreas: (userId: number, area_ids: number[], source = "MANUAL") =>
    request(`/admin/users/${userId}/areas/grant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area_ids, source }),
    }),
  adminRevokeAreas: (userId: number, area_ids: number[]) =>
    request(`/admin/users/${userId}/areas/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area_ids }),
    }),
  adminListAccessRequests: (status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return request(`/admin/access-requests${qs}`);
  },
  adminApproveRequest: (id: number) => request(`/admin/access-requests/${id}/approve`, { method: "POST" }),
  adminRejectRequest: (id: number, reason?: string) =>
    request(`/admin/access-requests/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    }),

  listKbAreas: () => request("/kb/areas") as Promise<KnowledgeBaseArea[]>,
  createKbArea: (payload: {
    key: string;
    name: string;
    description?: string;
    order_index?: number;
  }) =>
    request("/kb/areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateKbArea: (id: number, payload: { key: string; name: string; description?: string; order_index?: number }) =>
    request(`/kb/areas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listKbCollections: (areaId?: number | null) => {
    const qs = new URLSearchParams();
    if (areaId) qs.set("area_id", String(areaId));
    return request(`/kb/collections${qs.toString() ? `?${qs.toString()}` : ""}`) as Promise<KnowledgeBaseCollection[]>;
  },
  createKbCollection: (payload: {
    area_id: number;
    name: string;
    description?: string;
    order_index?: number;
  }) =>
    request("/kb/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateKbCollection: (
    id: number,
    payload: { area_id: number; name: string; description?: string; order_index?: number }
  ) =>
    request(`/kb/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listContentItems: (params: {
    q?: string;
    areaId?: number | null;
    collectionId?: number | null;
    status?: string;
    language?: string;
    updatedSince?: string;
    tagIds?: number[];
    includeArchived?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.areaId) qs.set("area_id", String(params.areaId));
    if (params.collectionId) qs.set("collection_id", String(params.collectionId));
    if (params.status) qs.set("status", params.status);
    if (params.language) qs.set("language", params.language);
    if (params.updatedSince) qs.set("updated_since", params.updatedSince);
    if (params.tagIds && params.tagIds.length) qs.set("tag_ids", params.tagIds.join(","));
    if (params.includeArchived) qs.set("include_archived", "true");
    return request(`/kb/content${qs.toString() ? `?${qs.toString()}` : ""}`) as Promise<ContentItem[]>;
  },
  getContentItem: (id: number) => request(`/kb/content/${id}`) as Promise<ContentItem>,
  createContentItem: (payload: {
    area_id: number;
    collection_id?: number | null;
    title: string;
    body: string;
    summary?: string | null;
    status?: string;
    language?: string;
    owner_user_id?: number | null;
    owner_name?: string | null;
    metrics?: string | null;
    tag_ids?: number[];
  }) =>
    request("/kb/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateContentItem: (id: number, payload: Partial<ContentItem> & { tag_ids?: number[] }) =>
    request(`/kb/content/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  archiveContentItem: (id: number) => request(`/kb/content/${id}`, { method: "DELETE" }),

  listTagCategories: () => request("/tags/categories") as Promise<TagCategory[]>,
  listTags: (params?: { categoryId?: number; categoryKey?: string; includeDeprecated?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.categoryId) qs.set("category_id", String(params.categoryId));
    if (params?.categoryKey) qs.set("category_key", params.categoryKey);
    if (params?.includeDeprecated === false) qs.set("include_deprecated", "false");
    return request(`/tags${qs.toString() ? `?${qs.toString()}` : ""}`) as Promise<Tag[]>;
  },
  createTag: (payload: { category_id: number; key: string; label: string }) =>
    request("/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  updateTag: (id: number, payload: { key?: string; label?: string; deprecated?: boolean }) =>
    request(`/tags/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  createTagSuggestion: (payload: { category_id?: number; category_key?: string; label: string; note?: string }) =>
    request("/tags/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  listTagSuggestions: (status?: string) => {
    const qs = status ? `?status=${status}` : "";
    return request(`/tags/suggestions${qs}`) as Promise<TagSuggestion[]>;
  },

  runPlayground: (payload: {
    objective: string;
    context?: string;
    filters: {
      sector?: Array<string | number>;
      use_case?: Array<string | number>;
      audience?: Array<string | number>;
      funnel_stage?: Array<string | number>;
      geography?: Array<string | number>;
      persona?: Array<string | number>;
      industry_subvertical?: Array<string | number>;
      product_line?: Array<string | number>;
      compliance?: Array<string | number>;
      price_tier?: Array<string | number>;
      language?: string;
    };
  }) =>
    request("/playground/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  submitPlaygroundFeedback: (runId: number, payload: { rating: string; comment?: string }) =>
    request(`/playground/runs/${runId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
