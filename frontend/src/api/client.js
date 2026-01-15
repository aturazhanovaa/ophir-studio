export const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
export function setToken(token) {
    localStorage.setItem("skh_token", token);
}
export function getToken() {
    return localStorage.getItem("skh_token");
}
export function clearToken() {
    localStorage.removeItem("skh_token");
}
async function request(path, init = {}) {
    const token = getToken();
    const headers = {
        ...init.headers,
    };
    if (token)
        headers["Authorization"] = `Bearer ${token}`;
    let res;
    const url = `${API_BASE}${path}`;
    try {
        res = await fetch(url, { ...init, headers });
    }
    catch (err) {
        throw new Error(`Backend unreachable at ${url}`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const data = contentType.includes("application/json") ? await res.json() : await res.text();
            msg =
                (data && typeof data === "object" && "detail" in data && data.detail) ||
                    (typeof data === "string" && data) ||
                    msg;
        }
        catch {
            // ignore parse errors
        }
        throw new Error(`${msg} (${url})`);
    }
    if (contentType.includes("application/json"))
        return res.json();
    return res.text();
}
export const api = {
    login: (email, password) => request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    }),
    me: () => request("/auth/me"),
    listAreas: () => request("/areas"),
    listAllAreas: () => request("/areas/catalog"),
    myMemberships: () => request("/areas/me"),
    createAccessRequests: (area_ids, message) => request("/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_ids, message }),
    }),
    myAccessRequests: () => request("/access-requests/me"),
    cancelAccessRequest: (id) => request(`/access-requests/${id}/cancel`, { method: "POST" }),
    listDocuments: (params) => {
        const qs = new URLSearchParams();
        if (params.areaId)
            qs.set("area_id", String(params.areaId));
        if (params.q)
            qs.set("q", params.q);
        if (params.tags && params.tags.length)
            qs.set("tags", params.tags.join(","));
        if (params.sort)
            qs.set("sort", params.sort);
        if (params.includeDeleted)
            qs.set("include_deleted", "true");
        return request(`/documents${qs.toString() ? `?${qs.toString()}` : ""}`);
    },
    getDocument: (id) => request(`/documents/${id}`),
    updateDocument: (id, payload) => request(`/documents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
    uploadDocument: async (area_id, title, file, tags) => {
        const fd = new FormData();
        fd.append("area_id", String(area_id));
        fd.append("title", title);
        fd.append("file", file);
        if (tags.length)
            fd.append("tags", JSON.stringify(tags));
        return request("/documents/upload", { method: "POST", body: fd });
    },
    uploadVersion: async (docId, file) => {
        const fd = new FormData();
        fd.append("file", file);
        return request(`/documents/${docId}/versions`, { method: "POST", body: fd });
    },
    copilotAsk: (question, areaScope, options) => {
        const payload = {
            question,
            top_k: options?.top_k ?? 6,
            accuracy_level: options?.accuracy_level ?? "MEDIUM",
            answer_tone: options?.answer_tone ?? "EXECUTIVE",
        };
        if (Array.isArray(areaScope)) {
            payload.area_ids = areaScope;
        }
        else if (areaScope !== null && areaScope !== undefined) {
            payload.area_ids = [areaScope];
        }
        if (options?.conversation_id)
            payload.conversation_id = options.conversation_id;
        return request("/copilot/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    },
    listConversations: () => request(`/conversations`),
    getConversation: (conversationId) => request(`/conversations/${conversationId}`),
    createConversation: (area_id, title) => request("/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_id, title }),
    }),
    updateConversation: (conversationId, payload) => request(`/conversations/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    deleteConversation: (conversationId) => request(`/conversations/${conversationId}`, { method: "DELETE" }),
    analyticsOverview: (params) => {
        const qs = new URLSearchParams();
        if (params.range)
            qs.set("range", params.range);
        if (params.start_date)
            qs.set("start_date", params.start_date);
        if (params.end_date)
            qs.set("end_date", params.end_date);
        return request(`/analytics/overview${qs.toString() ? `?${qs.toString()}` : ""}`);
    },
    analyticsTopDocuments: (params) => {
        const qs = new URLSearchParams();
        if (params.range)
            qs.set("range", params.range);
        if (params.start_date)
            qs.set("start_date", params.start_date);
        if (params.end_date)
            qs.set("end_date", params.end_date);
        if (params.area_id !== null && params.area_id !== undefined)
            qs.set("area_id", String(params.area_id));
        return request(`/analytics/top-documents${qs.toString() ? `?${qs.toString()}` : ""}`);
    },
    analyticsTopQuestions: (params) => {
        const qs = new URLSearchParams();
        if (params.range)
            qs.set("range", params.range);
        if (params.start_date)
            qs.set("start_date", params.start_date);
        if (params.end_date)
            qs.set("end_date", params.end_date);
        if (params.accuracy_level)
            qs.set("accuracy_level", params.accuracy_level);
        if (params.answer_tone)
            qs.set("answer_tone", params.answer_tone);
        return request(`/analytics/top-questions?${qs.toString()}`);
    },
    analyticsUnanswered: (params) => {
        const qs = new URLSearchParams();
        if (params.range)
            qs.set("range", params.range);
        if (params.start_date)
            qs.set("start_date", params.start_date);
        if (params.end_date)
            qs.set("end_date", params.end_date);
        if (params.accuracy_level)
            qs.set("accuracy_level", params.accuracy_level);
        if (params.answer_tone)
            qs.set("answer_tone", params.answer_tone);
        return request(`/analytics/unanswered?${qs.toString()}`);
    },
    analyticsQuestionsSummary: (params) => {
        const qs = new URLSearchParams({ area_id: String(params.area_id) });
        if (params.range)
            qs.set("range", params.range);
        if (params.start_date)
            qs.set("start_date", params.start_date);
        if (params.end_date)
            qs.set("end_date", params.end_date);
        return request(`/analytics/questions/summary?${qs.toString()}`);
    },
    analyticsQuestionsTrends: (params) => {
        const qs = new URLSearchParams({ area_id: String(params.area_id) });
        if (params.days)
            qs.set("days", String(params.days));
        if (params.range)
            qs.set("range", params.range);
        if (params.start_date)
            qs.set("start_date", params.start_date);
        if (params.end_date)
            qs.set("end_date", params.end_date);
        return request(`/analytics/questions/trends?${qs.toString()}`);
    },
    downloadUrl: (docId, version) => `${API_BASE}/documents/${docId}/download${version ? `?version=${version}` : ""}`,
    // Fetches the file with auth headers and returns a blob + filename for download.
    downloadDocument: async (docId, version) => {
        const token = getToken();
        const headers = {};
        if (token)
            headers["Authorization"] = `Bearer ${token}`;
        const url = `${API_BASE}/documents/${docId}/download${version ? `?version=${version}` : ""}`;
        const res = await fetch(url, { headers });
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
            let msg = `HTTP ${res.status}`;
            try {
                const data = contentType.includes("application/json") ? await res.json() : await res.text();
                msg =
                    (data && typeof data === "object" && "detail" in data && data.detail) ||
                        (typeof data === "string" && data) ||
                        msg;
            }
            catch {
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
    adminListUsers: () => request("/admin/users"),
    adminCreateUser: (payload) => request("/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    adminUpdateUser: (userId, payload) => request(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    adminGrantAreas: (userId, area_ids, source = "MANUAL") => request(`/admin/users/${userId}/areas/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_ids, source }),
    }),
    adminRevokeAreas: (userId, area_ids) => request(`/admin/users/${userId}/areas/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area_ids }),
    }),
    adminListAccessRequests: (status) => {
        const qs = status ? `?status=${status}` : "";
        return request(`/admin/access-requests${qs}`);
    },
    adminApproveRequest: (id) => request(`/admin/access-requests/${id}/approve`, { method: "POST" }),
    adminRejectRequest: (id, reason) => request(`/admin/access-requests/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
    }),
    listKbAreas: () => request("/kb/areas"),
    createKbArea: (payload) => request("/kb/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    updateKbArea: (id, payload) => request(`/kb/areas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    listKbCollections: (areaId) => {
        const qs = new URLSearchParams();
        if (areaId)
            qs.set("area_id", String(areaId));
        return request(`/kb/collections${qs.toString() ? `?${qs.toString()}` : ""}`);
    },
    createKbCollection: (payload) => request("/kb/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    updateKbCollection: (id, payload) => request(`/kb/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    listContentItems: (params) => {
        const qs = new URLSearchParams();
        if (params.q)
            qs.set("q", params.q);
        if (params.areaId)
            qs.set("area_id", String(params.areaId));
        if (params.collectionId)
            qs.set("collection_id", String(params.collectionId));
        if (params.status)
            qs.set("status", params.status);
        if (params.language)
            qs.set("language", params.language);
        if (params.updatedSince)
            qs.set("updated_since", params.updatedSince);
        if (params.tagIds && params.tagIds.length)
            qs.set("tag_ids", params.tagIds.join(","));
        if (params.includeArchived)
            qs.set("include_archived", "true");
        return request(`/kb/content${qs.toString() ? `?${qs.toString()}` : ""}`);
    },
    getContentItem: (id) => request(`/kb/content/${id}`),
    createContentItem: (payload) => request("/kb/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    updateContentItem: (id, payload) => request(`/kb/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    archiveContentItem: (id) => request(`/kb/content/${id}`, { method: "DELETE" }),
    listTagCategories: () => request("/tags/categories"),
    listTags: (params) => {
        const qs = new URLSearchParams();
        if (params?.categoryId)
            qs.set("category_id", String(params.categoryId));
        if (params?.categoryKey)
            qs.set("category_key", params.categoryKey);
        if (params?.includeDeprecated === false)
            qs.set("include_deprecated", "false");
        return request(`/tags${qs.toString() ? `?${qs.toString()}` : ""}`);
    },
    createTag: (payload) => request("/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    updateTag: (id, payload) => request(`/tags/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    createTagSuggestion: (payload) => request("/tags/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    listTagSuggestions: (status) => {
        const qs = status ? `?status=${status}` : "";
        return request(`/tags/suggestions${qs}`);
    },
    runPlayground: (payload) => request("/playground/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
    submitPlaygroundFeedback: (runId, payload) => request(`/playground/runs/${runId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }),
};
