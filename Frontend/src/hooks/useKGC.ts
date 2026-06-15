/**
 * KGC Lite — React Hooks
 * src/hooks/useKGC.ts
 */

import { useState, useEffect, useCallback } from "react";
import {
  kgcAPI,
  tokenStore,
  APIError,
  UserSession,
  IssueResponse,
  IssuesListResponse,
  UserProfileResponse,
  ComplaintResponse,
} from "../api/kgc";

declare global {
  interface Window {
    sendOtp: (
      identifier: string,
      successCb?: (data: any) => void,
      failureCb?: (error: any) => void,
    ) => void;
    verifyOtp: (
      otp: string,
      successCb?: (data: any) => void,
      failureCb?: (error: any) => void,
    ) => void;
    initSendOTP: (config: any) => void;
    configuration: any;
    handleMsg91Success?: (data: any) => void;
    handleMsg91Failure?: (error: any) => void;
  }
}

// ── useAuth ───────────────────────────────────────────────────────
export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(() => tokenStore.getUser());

  useEffect(() => {
    const handleStorage = () => setUser(tokenStore.getUser());
    window.addEventListener("storage", handleStorage);
    window.addEventListener("kgc-auth-changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("kgc-auth-changed", handleStorage);
    };
  }, []);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [devOTP, setDevOTP] = useState<string | null>(null); // dev mode only

  const sendOTP = useCallback(async (mobile: string) => {
    setLoading(true);
    setError(null);
    return new Promise((resolve, reject) => {
      if (!window.sendOtp) {
        setLoading(false);
        setError("OTP widget not initialized. Please refresh.");
        reject(new Error("OTP widget not initialized"));
        return;
      }

      try {
        // Assume India prefix for MSG91 widget
        window.sendOtp(`91${mobile}`);
        setOtpSent(true);
        setLoading(false);
        resolve(true);
      } catch (err: any) {
        setError(err?.message || "Failed to send OTP");
        setLoading(false);
        reject(err);
      }
    });
  }, []);

  const verifyOTP = useCallback(async (mobile: string, otp: string) => {
    setLoading(true);
    setError(null);
    return new Promise<string>((resolve, reject) => {
      if (!window.verifyOtp) {
        setLoading(false);
        setError("OTP widget not initialized. Please refresh.");
        reject(new Error("OTP widget not initialized"));
        return;
      }

      // Assign global callbacks for the widget
      window.handleMsg91Success = (data: any) => {
        setLoading(false);
        resolve(data.message); // Return the MSG91 access-token
      };

      window.handleMsg91Failure = (err: any) => {
        setError(err?.message || "Invalid OTP");
        setLoading(false);
        reject(err);
      };

      try {
        window.verifyOtp(otp);
      } catch (err: any) {
        window.handleMsg91Failure(err);
      }
    });
  }, []);

  const logout = useCallback(() => {
    kgcAPI.auth.logout();
    setUser(null);
  }, []);

  return {
    user,
    isLoggedIn: !!user,
    isAdmin: user?.is_admin === true,
    loading,
    error,
    otpSent,
    devOTP,
    sendOTP,
    verifyOTP,
    logout,
  };
}

// ── useIssues ─────────────────────────────────────────────────────
export interface IssuesFilters {
  category?: string | null;
  sortBy?: "priority" | "recent" | "votes";
  location?: string | null;
  skip?: number;
  limit?: number;
}

export function useIssues(initialFilters: IssuesFilters = {}) {
  const [issues, setIssues] = useState<IssueResponse[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Required<IssuesFilters>>({
    category: null,
    sortBy: "priority",
    location: null,
    skip: 0,
    limit: 20,
    ...initialFilters,
  });

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await kgcAPI.issues.list(filters);
      setIssues(res.issues);
      setTotal(res.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const updateFilter = (key: keyof IssuesFilters, value: any) =>
    setFilters((prev) => ({ ...prev, [key]: value, skip: 0 }));

  const loadMore = () => setFilters((prev) => ({ ...prev, skip: prev.skip + prev.limit }));

  return { issues, total, loading, error, filters, updateFilter, loadMore, refetch: fetchIssues };
}

// ── useIssue ──────────────────────────────────────────────────────
export function useIssue(issueId: string | undefined) {
  const [issue, setIssue] = useState<IssueResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIssue = useCallback(async () => {
    if (!issueId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await kgcAPI.issues.get(issueId);
      setIssue(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    fetchIssue();
  }, [fetchIssue]);

  return { issue, loading, error, refetch: fetchIssue };
}

// ── useVote ───────────────────────────────────────────────────────
export function useVote(issueId: string) {
  const [voting, setVoting] = useState<boolean>(false);
  const [userVote, setUserVote] = useState<"urgent" | "important" | "minor" | null>(null);
  const [voteCounts, setVoteCounts] = useState<{
    urgent: number;
    important: number;
    minor: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing vote on mount
  useEffect(() => {
    if (!issueId || !tokenStore.get()) return;
    kgcAPI.issues
      .getMyVote(issueId)
      .then((res) => setUserVote(res.voted ? res.vote_type : null))
      .catch(() => {}); // silently ignore if not logged in
  }, [issueId]);

  const castVote = useCallback(
    async (voteType: "urgent" | "important" | "minor") => {
      if (voting) return;
      setVoting(true);
      setError(null);
      try {
        const res = await kgcAPI.issues.vote(issueId, voteType);
        setUserVote(voteType);
        setVoteCounts({
          urgent: res.votes_urgent,
          important: res.votes_important,
          minor: res.votes_minor,
          total: res.total_votes,
        });
        return res;
      } catch (e: any) {
        setError(e.message);
        throw e;
      } finally {
        setVoting(false);
      }
    },
    [issueId, voting],
  );

  return { voting, userVote, voteCounts, error, castVote };
}

// ── useComplaintSubmit ────────────────────────────────────────────
export type ComplaintStage = "submitting" | "analyzing" | "routing" | "done" | "error";

export function useComplaintSubmit() {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<ComplaintStage | null>(null);

  const submit = useCallback(async (text: string, location: string | null) => {
    setSubmitting(true);
    setError(null);
    setResult(null);
    setStage("submitting");

    try {
      // Simulate frontend processing stages for enhanced micro-animations & UX
      await delay(600);
      setStage("analyzing");

      const res = await kgcAPI.complaints.submit(text, location);

      setStage("routing");
      await delay(900);
      setStage("done");
      setResult(res);
      return res;
    } catch (e: any) {
      setStage("error");
      if (e instanceof APIError && e.detail?.error === "spam_detected") {
        setError(`Spam detected: ${e.detail?.reason || e.message}`);
      } else {
        setError(e.message);
      }
      throw e;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const reset = () => {
    setResult(null);
    setError(null);
    setStage(null);
  };

  return { submitting, result, error, stage, submit, reset };
}

// ── useMyComplaints ───────────────────────────────────────────────
export function useMyComplaints() {
  const [complaints, setComplaints] = useState<ComplaintResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyComplaints = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await kgcAPI.complaints.getMine(0, 50);
      setComplaints(res.complaints);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyComplaints();
  }, [fetchMyComplaints]);

  return { complaints, loading, error, refetch: fetchMyComplaints };
}

// ── useAdminDashboard ─────────────────────────────────────────────
export function useAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await kgcAPI.admin.getDashboard();
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}

// ── usePendingIssues ──────────────────────────────────────────────
export function usePendingIssues() {
  const [issues, setIssues] = useState<IssueResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await kgcAPI.admin.getPending();
      setIssues(res.issues);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const approve = async (issueId: string, title: string | null, description: string | null) => {
    await kgcAPI.admin.approve(issueId, title, description);
    fetchPending(); // refresh list
  };

  const reject = async (issueId: string, reason: string) => {
    await kgcAPI.admin.reject(issueId, reason);
    fetchPending();
  };

  const updateStatus = async (
    issueId: string,
    status: "resolved" | "approved",
    governmentResponse: string | null = null,
  ) => {
    await kgcAPI.admin.updateStatus(issueId, status, governmentResponse);
    fetchPending();
  };

  return { issues, loading, error, approve, reject, updateStatus, refetch: fetchPending };
}

// ── HELPER ────────────────────────────────────────────────────────
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
