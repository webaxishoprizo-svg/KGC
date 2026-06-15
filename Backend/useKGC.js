/**
 * KGC Lite — React Hooks
 * Paste as: src/hooks/useKGC.js
 *
 * Ready-to-use hooks for every feature.
 * Handles loading, error, and data states automatically.
 */

import { useState, useEffect, useCallback } from 'react'
import { kgcAPI, tokenStore, APIError } from '../api/kgc'

// ── useAuth ───────────────────────────────────────────────────────
export function useAuth() {
  const [user,    setUser]    = useState(tokenStore.getUser())
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [otpSent, setOtpSent] = useState(false)
  const [devOTP,  setDevOTP]  = useState(null) // dev mode only

  const sendOTP = useCallback(async (mobile) => {
    setLoading(true); setError(null)
    try {
      const res = await kgcAPI.auth.sendOTP(mobile)
      setOtpSent(true)
      if (res.otp_dev) setDevOTP(res.otp_dev) // dev mode
      return res
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const verifyOTP = useCallback(async (mobile, otp) => {
    setLoading(true); setError(null)
    try {
      const res = await kgcAPI.auth.verifyOTP(mobile, otp)
      setUser(tokenStore.getUser())
      return res
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    kgcAPI.auth.logout()
    setUser(null)
  }, [])

  return {
    user,
    loading,
    error,
    otpSent,
    devOTP,
    isLoggedIn: !!user,
    isAdmin:    user?.is_admin === true,
    sendOTP,
    verifyOTP,
    logout,
  }
}

// ── useIssues ─────────────────────────────────────────────────────
export function useIssues(initialFilters = {}) {
  const [issues,  setIssues]  = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filters, setFilters] = useState({
    category: null,
    sortBy:   'priority',
    skip:     0,
    limit:    20,
    ...initialFilters,
  })

  const fetch = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await kgcAPI.issues.list(filters)
      setIssues(res.issues)
      setTotal(res.total)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetch() }, [fetch])

  const updateFilter = (key, value) =>
    setFilters(prev => ({ ...prev, [key]: value, skip: 0 }))

  const loadMore = () =>
    setFilters(prev => ({ ...prev, skip: prev.skip + prev.limit }))

  return { issues, total, loading, error, filters, updateFilter, loadMore, refetch: fetch }
}

// ── useIssue ──────────────────────────────────────────────────────
export function useIssue(issueId) {
  const [issue,   setIssue]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!issueId) return
    setLoading(true)
    kgcAPI.issues.get(issueId)
      .then(setIssue)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [issueId])

  return { issue, loading, error }
}

// ── useVote ───────────────────────────────────────────────────────
export function useVote(issueId) {
  const [voting,    setVoting]    = useState(false)
  const [userVote,  setUserVote]  = useState(null)
  const [voteCounts, setVoteCounts] = useState(null)
  const [error,     setError]     = useState(null)

  // Load existing vote on mount
  useEffect(() => {
    if (!issueId || !tokenStore.get()) return
    kgcAPI.issues.getMyVote(issueId)
      .then(res => setUserVote(res.voted ? res.vote_type : null))
      .catch(() => {}) // silently ignore if not logged in
  }, [issueId])

  const castVote = useCallback(async (voteType) => {
    if (voting) return
    setVoting(true); setError(null)
    try {
      const res = await kgcAPI.issues.vote(issueId, voteType)
      setUserVote(voteType)
      setVoteCounts({
        urgent:    res.votes_urgent,
        important: res.votes_important,
        minor:     res.votes_minor,
        total:     res.total_votes,
      })
      return res
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setVoting(false)
    }
  }, [issueId, voting])

  return { voting, userVote, voteCounts, error, castVote }
}

// ── useComplaintSubmit ────────────────────────────────────────────
export function useComplaintSubmit() {
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState(null)
  const [error,      setError]      = useState(null)

  // Processing stages for UI animation
  const [stage, setStage] = useState(null)
  // stages: null → 'submitting' → 'analyzing' → 'routing' → 'done' → 'error'

  const submit = useCallback(async (text, location) => {
    setSubmitting(true); setError(null); setResult(null)
    setStage('submitting')

    try {
      // Simulate AI processing stages for UX
      await delay(400)
      setStage('analyzing')

      const res = await kgcAPI.complaints.submit(text, location)

      setStage('routing')
      await delay(600)
      setStage('done')
      setResult(res)
      return res
    } catch (e) {
      setStage('error')
      if (e instanceof APIError && e.detail?.error === 'spam_detected') {
        setError(`Spam detected: ${e.detail?.reason || e.message}`)
      } else {
        setError(e.message)
      }
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [])

  const reset = () => { setResult(null); setError(null); setStage(null) }

  return { submitting, result, error, stage, submit, reset }
}

// ── useMyComplaints ───────────────────────────────────────────────
export function useMyComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return }
    kgcAPI.complaints.getMine()
      .then(res => setComplaints(res.complaints))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { complaints, loading, error }
}

// ── useAdminDashboard ─────────────────────────────────────────────
export function useAdminDashboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await kgcAPI.admin.getDashboard()
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ── usePendingIssues ──────────────────────────────────────────────
export function usePendingIssues() {
  const [issues,  setIssues]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await kgcAPI.admin.getPending()
      setIssues(res.issues)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const approve = async (issueId, title, description) => {
    await kgcAPI.admin.approve(issueId, title, description)
    fetch() // refetch list
  }

  const reject = async (issueId, reason) => {
    await kgcAPI.admin.reject(issueId, reason)
    fetch()
  }

  return { issues, loading, error, approve, reject, refetch: fetch }
}

// ── HELPER ────────────────────────────────────────────────────────
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
