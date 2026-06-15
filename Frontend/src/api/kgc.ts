/**
 * KGC Lite — Frontend API Integration
 * src/api/kgc.ts
 */

// ── CONFIG ────────────────────────────────────────────────────────
const API_BASE =
  (import.meta.env.VITE_API_URL as string) ||
  (import.meta.env.PROD ? "https://mubxii-kgc-backend.hf.space" : "http://localhost:8000");

// ── TOKEN STORAGE ─────────────────────────────────────────────────
const TOKEN_KEY = "kgc_token";
const USER_KEY = "kgc_user";

export interface UserSession {
  id: string;
  email?: string | null;
  mobile?: string | null;
  auth_provider?: string;
  is_admin: boolean;
  is_onboarded?: boolean;
  name?: string | null;
}

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (t: string): void => localStorage.setItem(TOKEN_KEY, t),
  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  setUser: (u: UserSession): void => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  getUser: (): UserSession | null => {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
};

// ── BASE FETCH ────────────────────────────────────────────────────
async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let data: any;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new Event("kgc-auth-changed"));
    }
    const message = data?.detail?.message || data?.detail || "Something went wrong";
    throw new APIError(message, response.status, data?.detail);
  }

  return data as T;
}

// ── CUSTOM ERROR ──────────────────────────────────────────────────
export class APIError extends Error {
  status: number;
  detail: any;

  constructor(message: string, status: number, detail: any) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.name = "APIError";
  }
}

// ── TYPES ─────────────────────────────────────────────────────────

export interface SendOTPResponse {
  message: string;
  expires_in_minutes: number;
  otp_dev?: string; // only in dev mode
}

export interface VerifyOTPResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string | null;
  mobile: string | null;
  auth_provider: string;
  is_admin: boolean;
  is_new_user: boolean;
  is_onboarded: boolean;
  name: string | null;
}

export interface UserProfileResponse {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  age: number | null;
  gender: string | null;
  address: string | null;
  is_admin: boolean;
  mobile_verified: boolean;
  is_onboarded: boolean;
  complaints_today: number;
  created_at: string;
}

export interface ComplaintSubmitResponse {
  complaint_id: string;
  issue_id: string;
  action: "merged" | "created" | "chat";
  category: string;
  urgency: string;
  ai_summary: string;
  spam_flagged: boolean;
  message: string;
  is_chat?: boolean;
  ai_reply?: string;
  department?: string;
  response_time?: string;
  ticket_suffix?: string;
}

export interface ComplaintResponse {
  id: string;
  user_id: string;
  issue_id: string | null;
  raw_text: string;
  location_raw: string | null;
  image_url: string | null;
  category: string;
  urgency: string;
  location_extracted: string | null;
  keywords: string[];
  ai_summary: string | null;
  spam_score: number;
  spam_flagged: boolean;
  spam_reason: string | null;
  processed: boolean;
  created_at: string;
}

export interface MyComplaintsResponse {
  total: number;
  complaints: ComplaintResponse[];
}

export interface IssueResponse {
  id: string;
  title: string;
  description: string | null;
  category: string;
  department: string | null;
  location: string;
  district: string;
  ward: string | null;
  complaint_count: number;
  votes_urgent: number;
  votes_important: number;
  votes_minor: number;
  total_votes: number;
  priority_score: number;
  status: "pending" | "approved" | "rejected" | "merged" | "resolved";
  user_vote?: "urgent" | "important" | "minor" | null;
  government_response: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface IssuesListResponse {
  total: number;
  skip: number;
  limit: number;
  issues: IssueResponse[];
}

export interface VoteResponse {
  message: string;
  issue_id: string;
  vote_type: "urgent" | "important" | "minor";
  votes_urgent: number;
  votes_important: number;
  votes_minor: number;
  total_votes: number;
}

export interface MyVoteResponse {
  voted: boolean;
  vote_type: "urgent" | "important" | "minor" | null;
}

export interface AdminDashboardResponse {
  total_complaints: number;
  total_issues: number;
  pending_issues: number;
  approved_issues: number;
  resolved_issues: number;
  rejected_issues: number;
  high_priority_issues: number;
  spam_complaints: number;
  by_category: Record<string, number>;
}

// ── AUTH API ──────────────────────────────────────────────────────
export const authAPI = {
  async loginWithEmail(email: string, password: string): Promise<VerifyOTPResponse> {
    const data = await apiFetch<VerifyOTPResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this._saveAuthData(data);
    return data;
  },

  async registerWithEmail(
    email: string,
    password: string,
    name: string,
  ): Promise<VerifyOTPResponse> {
    const data = await apiFetch<VerifyOTPResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    this._saveAuthData(data);
    return data;
  },

  async loginWithGoogle(credential: string): Promise<VerifyOTPResponse> {
    const data = await apiFetch<VerifyOTPResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    });
    this._saveAuthData(data);
    return data;
  },

  async sendOTP(mobile: string): Promise<SendOTPResponse> {
    return apiFetch<SendOTPResponse>("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    });
  },

  async verifyOTP(mobile: string, otp: string): Promise<VerifyOTPResponse> {
    const data = await apiFetch<VerifyOTPResponse>("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ mobile, otp }),
    });
    this._saveAuthData(data);
    return data;
  },

  async verifyMsg91Token(msg91Token: string): Promise<VerifyOTPResponse> {
    const data = await apiFetch<VerifyOTPResponse>("/auth/msg91-widget-verify", {
      method: "POST",
      body: JSON.stringify({ token: msg91Token }),
    });
    this._saveAuthData(data);
    return data;
  },

  _saveAuthData(data: VerifyOTPResponse) {
    tokenStore.set(data.access_token);
    tokenStore.setUser({
      id: data.user_id,
      email: data.email,
      mobile: data.mobile,
      auth_provider: data.auth_provider,
      is_admin: data.is_admin,
      is_onboarded: data.is_onboarded,
      name: data.name,
    });
  },

  async getMe(): Promise<UserProfileResponse> {
    return apiFetch<UserProfileResponse>("/auth/me");
  },

  async onboardSendOTP(mobile: string): Promise<SendOTPResponse> {
    return apiFetch<SendOTPResponse>("/auth/onboard/send-otp", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    });
  },

  async onboard(data: {
    name: string;
    age: number;
    gender: string;
    address: string;
    mobile: string;
    otp?: string;
    msg91_token?: string;
  }): Promise<{ message: string; is_onboarded: boolean; name: string }> {
    return apiFetch<{ message: string; is_onboarded: boolean; name: string }>("/auth/onboard", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateProfile(data: {
    name?: string;
    mobile?: string;
    age?: number;
    gender?: string;
    address?: string;
  }): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  logout(): void {
    tokenStore.clear();
    window.location.href = "/";
  },

  isLoggedIn(): boolean {
    return !!tokenStore.get();
  },

  isAdmin(): boolean {
    return tokenStore.getUser()?.is_admin === true;
  },
};

// ── COMPLAINTS API ────────────────────────────────────────────────
export const complaintsAPI = {
  async submit(text: string, location: string | null = null): Promise<ComplaintSubmitResponse> {
    return apiFetch<ComplaintSubmitResponse>("/complaints/submit", {
      method: "POST",
      body: JSON.stringify({ text, location }),
    });
  },

  async getMine(skip = 0, limit = 20): Promise<MyComplaintsResponse> {
    return apiFetch<MyComplaintsResponse>(`/complaints/mine?skip=${skip}&limit=${limit}`);
  },
};

// ── ISSUES API ────────────────────────────────────────────────────
export interface ListIssuesParams {
  category?: string | null;
  sortBy?: "priority" | "recent" | "votes";
  location?: string | null;
  skip?: number;
  limit?: number;
}

export const issuesAPI = {
  async list({
    category,
    sortBy = "priority",
    location,
    skip = 0,
    limit = 20,
  }: ListIssuesParams = {}): Promise<IssuesListResponse> {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    params.set("sort_by", sortBy);
    params.set("skip", skip.toString());
    params.set("limit", limit.toString());
    return apiFetch<IssuesListResponse>(`/issues?${params}`);
  },

  async get(issueId: string): Promise<IssueResponse> {
    return apiFetch<IssueResponse>(`/issues/${issueId}`);
  },

  async vote(issueId: string, voteType: "urgent" | "important" | "minor"): Promise<VoteResponse> {
    return apiFetch<VoteResponse>(`/issues/${issueId}/vote`, {
      method: "POST",
      body: JSON.stringify({ vote_type: voteType }),
    });
  },

  async getMyVote(issueId: string): Promise<MyVoteResponse> {
    return apiFetch<MyVoteResponse>(`/issues/${issueId}/my-vote`);
  },
};

// ── ADMIN API ─────────────────────────────────────────────────────
export interface GetAllIssuesParams {
  status?: string | null;
  category?: string | null;
  sortBy?: "priority" | "recent" | "votes";
  skip?: number;
  limit?: number;
}

export const adminAPI = {
  async getDashboard(): Promise<AdminDashboardResponse> {
    return apiFetch<AdminDashboardResponse>("/admin/dashboard");
  },

  async getPending(category: string | null = null): Promise<IssuesListResponse> {
    const params = category ? `?category=${category}` : "";
    return apiFetch<IssuesListResponse>(`/admin/pending${params}`);
  },

  async approve(
    issueId: string,
    title: string | null = null,
    description: string | null = null,
  ): Promise<IssueResponse> {
    return apiFetch<IssueResponse>(`/admin/approve/${issueId}`, {
      method: "POST",
      body: JSON.stringify({ title, description }),
    });
  },

  async reject(issueId: string, reason: string): Promise<IssueResponse> {
    return apiFetch<IssueResponse>(`/admin/reject/${issueId}`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  async updateStatus(
    issueId: string,
    status: "resolved" | "approved",
    governmentResponse: string | null = null,
  ): Promise<IssueResponse> {
    return apiFetch<IssueResponse>(`/admin/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, government_response: governmentResponse }),
    });
  },

  async getAllIssues({
    status,
    category,
    sortBy = "priority",
    skip = 0,
    limit = 50,
  }: GetAllIssuesParams = {}): Promise<IssuesListResponse> {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    params.set("sort_by", sortBy);
    params.set("skip", skip.toString());
    params.set("limit", limit.toString());
    return apiFetch<IssuesListResponse>(`/admin/issues?${params}`);
  },

  async seedDemo(): Promise<{ message: string }> {
    return apiFetch<{ message: string }>("/admin/seed", { method: "POST" });
  },
};

// ── CHAT API ──────────────────────────────────────────────────────
export const chatAPI = {
  async sendMessage(
    sessionId: string | null,
    message: string,
    attachmentUrl: string | null = null,
    attachmentMimeType: string | null = null,
  ): Promise<ChatResponse> {
    return apiFetch<ChatResponse>("/chat/message", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        message,
        attachment_url: attachmentUrl,
        attachment_mime_type: attachmentMimeType,
      }),
    });
  },
  async uploadFile(file: File | Blob): Promise<{ url: string; mime_type: string }> {
    const formData = new FormData();
    formData.append("file", file);
    // Note: apiFetch by default sets Content-Type to application/json. We must override it or use fetch directly.
    const token = tokenStore.get();
    const response = await fetch(`${API_BASE}/chat/upload`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!response.ok) throw new Error("Upload failed");
    return response.json();
  },
  async getSessions(): Promise<ChatSessionList[]> {
    return apiFetch<ChatSessionList[]>("/chat/sessions");
  },
  async getSessionHistory(sessionId: string): Promise<ChatSessionDetail> {
    return apiFetch<ChatSessionDetail>(`/chat/sessions/${sessionId}`);
  },
  async submitFeedback(messageId: string, rating: "up" | "down"): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/chat/messages/${messageId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    });
  },
};

// ── PROPOSALS API ─────────────────────────────────────────────────
export interface Proposal {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  time: string;
  content: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  comments: number;
  image_url?: string | null;
}

export const proposalsAPI = {
  list: (limit: number = 20, offset: number = 0): Promise<Proposal[]> =>
    apiFetch<Proposal[]>(`/proposals?limit=${limit}&offset=${offset}`),

  submit: (
    content: string,
    tags: string,
    imageUrl?: string | null,
  ): Promise<{ message: string; proposal_id: string }> =>
    apiFetch<{ message: string; proposal_id: string }>("/proposals", {
      method: "POST",
      body: JSON.stringify({ content, tags, image_url: imageUrl }),
    }),

  vote: (proposalId: string, voteType: "up" | "down"): Promise<{ message: string }> =>
    apiFetch<{ message: string }>(`/proposals/${proposalId}/vote?vote_type=${voteType}`, {
      method: "POST",
    }),
};

// ── UNIFIED EXPORT ────────────────────────────────────────────────
export interface ChatMessage {
  id?: string;
  role: "user" | "model";
  text: string;
  draft_text?: string | null;
  is_violation?: boolean;
  feedback?: string | null;
  attachment_url?: string | null;
  attachment_mime_type?: string | null;
  created_at?: string;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  draft_ready: boolean;
  draft_text: string | null;
  is_violation: boolean;
}

export interface ChatSessionList {
  id: string;
  title: string;
  updated_at: string;
}

export interface ChatSessionDetail {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export const kgcAPI = {
  auth: authAPI,
  complaints: complaintsAPI,
  issues: issuesAPI,
  admin: adminAPI,
  chat: chatAPI,
  proposals: proposalsAPI,
};

export default kgcAPI;
