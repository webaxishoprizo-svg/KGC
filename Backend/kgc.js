/**
 * KGC Lite — Frontend API Integration
 * Paste this file into your Lovable/React project as: src/api/kgc.js
 *
 * Usage:
 *   import { kgcAPI } from './api/kgc'
 *
 *   // Send OTP
 *   await kgcAPI.auth.sendOTP('9876543210')
 *
 *   // Verify OTP + login
 *   const { token } = await kgcAPI.auth.verifyOTP('9876543210', '123456')
 *
 *   // Submit complaint
 *   const result = await kgcAPI.complaints.submit('No water in Ward 12', 'Ward 12 Mangaluru')
 *
 *   // Get issues
 *   const { issues } = await kgcAPI.issues.list()
 *
 *   // Vote
 *   await kgcAPI.issues.vote(issueId, 'urgent')
 */

// ── CONFIG ────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── TOKEN STORAGE ─────────────────────────────────────────────────
const TOKEN_KEY = 'kgc_token'
const USER_KEY  = 'kgc_user'

export const tokenStore = {
  get:    ()        => localStorage.getItem(TOKEN_KEY),
  set:    (t)       => localStorage.setItem(TOKEN_KEY, t),
  clear:  ()        => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY) },
  setUser:(u)       => localStorage.setItem(USER_KEY, JSON.stringify(u)),
  getUser:()        => { try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null } },
}

// ── BASE FETCH ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = tokenStore.get()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  const data = await response.json()

  if (!response.ok) {
    const message = data?.detail?.message || data?.detail || 'Something went wrong'
    throw new APIError(message, response.status, data?.detail)
  }

  return data
}

// ── CUSTOM ERROR ──────────────────────────────────────────────────
export class APIError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.status = status
    this.detail = detail
    this.name   = 'APIError'
  }
}

// ── AUTH API ──────────────────────────────────────────────────────
export const authAPI = {

  async sendOTP(mobile) {
    /**
     * Send OTP to mobile number.
     * In dev mode, OTP is also returned in response.otp_dev
     */
    return apiFetch('/auth/send-otp', {
      method: 'POST',
      body:   JSON.stringify({ mobile }),
    })
  },

  async verifyOTP(mobile, otp) {
    /**
     * Verify OTP. On success:
     * - Saves token to localStorage
     * - Returns { access_token, user_id, mobile, is_admin, is_new_user }
     */
    const data = await apiFetch('/auth/verify-otp', {
      method: 'POST',
      body:   JSON.stringify({ mobile, otp }),
    })
    tokenStore.set(data.access_token)
    tokenStore.setUser({
      id:       data.user_id,
      mobile:   data.mobile,
      is_admin: data.is_admin,
    })
    return data
  },

  async getMe() {
    return apiFetch('/auth/me')
  },

  logout() {
    tokenStore.clear()
    window.location.href = '/'
  },

  isLoggedIn() {
    return !!tokenStore.get()
  },

  isAdmin() {
    return tokenStore.getUser()?.is_admin === true
  },
}

// ── COMPLAINTS API ────────────────────────────────────────────────
export const complaintsAPI = {

  async submit(text, location = null) {
    /**
     * Submit a complaint through the full AI pipeline.
     * Returns:
     * {
     *   complaint_id, issue_id, action ("merged"|"created"),
     *   category, urgency, ai_summary, spam_flagged, message
     * }
     */
    return apiFetch('/complaints/submit', {
      method: 'POST',
      body:   JSON.stringify({ text, location }),
    })
  },

  async getMine(skip = 0, limit = 20) {
    return apiFetch(`/complaints/mine?skip=${skip}&limit=${limit}`)
  },
}

// ── ISSUES API ────────────────────────────────────────────────────
export const issuesAPI = {

  async list({ category, sortBy = 'priority', location, skip = 0, limit = 20 } = {}) {
    /**
     * List approved public issues.
     * sortBy: 'priority' | 'recent' | 'votes'
     * category: 'water' | 'electricity' | 'roads'
     */
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (location) params.set('location', location)
    params.set('sort_by', sortBy)
    params.set('skip', skip)
    params.set('limit', limit)
    return apiFetch(`/issues?${params}`)
  },

  async get(issueId) {
    return apiFetch(`/issues/${issueId}`)
  },

  async vote(issueId, voteType) {
    /**
     * Cast or change a vote.
     * voteType: 'urgent' | 'important' | 'minor'
     */
    return apiFetch(`/issues/${issueId}/vote`, {
      method: 'POST',
      body:   JSON.stringify({ vote_type: voteType }),
    })
  },

  async getMyVote(issueId) {
    return apiFetch(`/issues/${issueId}/my-vote`)
  },
}

// ── ADMIN API ─────────────────────────────────────────────────────
export const adminAPI = {

  async getDashboard() {
    return apiFetch('/admin/dashboard')
  },

  async getPending(category = null) {
    const params = category ? `?category=${category}` : ''
    return apiFetch(`/admin/pending${params}`)
  },

  async approve(issueId, title = null, description = null) {
    return apiFetch(`/admin/approve/${issueId}`, {
      method: 'POST',
      body:   JSON.stringify({ title, description }),
    })
  },

  async reject(issueId, reason) {
    return apiFetch(`/admin/reject/${issueId}`, {
      method: 'POST',
      body:   JSON.stringify({ reason }),
    })
  },

  async updateStatus(issueId, status, governmentResponse = null) {
    return apiFetch(`/admin/issues/${issueId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ status, government_response: governmentResponse }),
    })
  },

  async getAllIssues({ status, category, sortBy = 'priority', skip = 0, limit = 50 } = {}) {
    const params = new URLSearchParams()
    if (status)   params.set('status', status)
    if (category) params.set('category', category)
    params.set('sort_by', sortBy)
    params.set('skip', skip)
    params.set('limit', limit)
    return apiFetch(`/admin/issues?${params}`)
  },

  async seedDemo() {
    return apiFetch('/admin/seed', { method: 'POST' })
  },
}

// ── UNIFIED EXPORT ────────────────────────────────────────────────
export const kgcAPI = {
  auth:       authAPI,
  complaints: complaintsAPI,
  issues:     issuesAPI,
  admin:      adminAPI,
}

export default kgcAPI
