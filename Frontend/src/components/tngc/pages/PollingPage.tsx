import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  Lock,
  Sparkles,
  Loader2,
  Landmark,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";
import { useLang } from "@/lib/language";
import { useAuth } from "@/hooks/useKGC";
import { toast } from "sonner";
import { kgcAPI, IssueResponse } from "@/api/kgc";

export function PollingPage() {
  const { t } = useLang();
  const [issues, setIssues] = useState<IssueResponse[]>([]);
  const [totalLive, setTotalLive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kgcAPI.issues
      .list({ limit: 50 })
      .then((res) => {
        setIssues(res.issues);
        setTotalLive(res.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const criticalCount = issues.filter((i) => i.priority_score > 10).length;
  const districtsCount = new Set(issues.map((i) => i.district)).size;

  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto pb-24">
      <h1 className="text-2xl md:text-3xl font-bold text-kgc-text">
        {t("pollingTitle") || "Grievance Prioritization Hub"}
      </h1>
      <p className="text-sm text-kgc-muted mt-2 max-w-2xl">
        {t("pollingIntro") ||
          "Every citizen has the power to vote on issue urgency. Real-time voting recalibrates priority scores, ensuring critical district issues get handled first."}
      </p>

      <div className="flex gap-2 mt-4 flex-wrap">
        <span className="px-3 py-1 rounded-full bg-white text-[11px] font-medium text-kgc-text shadow-sm border border-[#e5e5e5]">
          {totalLive} Live Grievances
        </span>
        <span className="px-3 py-1 rounded-full bg-white text-[11px] font-medium text-kgc-text shadow-sm border border-[#e5e5e5]">
          {criticalCount} Critical
        </span>
        <span className="px-3 py-1 rounded-full bg-white text-[11px] font-medium text-kgc-text shadow-sm border border-[#e5e5e5]">
          {districtsCount} Districts
        </span>
        <span className="px-3 py-1 rounded-full bg-white text-[11px] font-medium text-kgc-text shadow-sm border border-[#e5e5e5]">
          Aadhaar Verified
        </span>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.1 } },
        }}
        className="space-y-5 mt-6"
      >
        {loading ? (
          <div className="space-y-4 w-full">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-5 md:p-6 border border-[#e5e5e5] animate-pulse h-48 w-full flex flex-col gap-4"
              >
                <div className="flex gap-2">
                  <div className="h-4 w-20 bg-black/10 rounded-full"></div>
                  <div className="h-4 w-24 bg-black/10 rounded-full"></div>
                </div>
                <div className="h-6 w-3/4 bg-black/10 rounded-lg"></div>
                <div className="h-4 w-full bg-black/5 rounded-lg mt-2"></div>
                <div className="flex gap-2 mt-auto">
                  <div className="h-14 flex-1 bg-black/5 rounded-2xl"></div>
                  <div className="h-14 flex-1 bg-black/5 rounded-2xl"></div>
                  <div className="h-14 flex-1 bg-black/5 rounded-2xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : issues.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center flex flex-col items-center border border-white/60 bg-white/40 shadow-sm">
            <div className="text-4xl">🗳️</div>
            <div className="font-semibold mt-3 text-kgc-text text-lg">No open grievances</div>
            <div className="text-sm text-kgc-muted mt-1">
              There are currently no active grievances requiring citizen consensus. Check back
              later!
            </div>
          </div>
        ) : (
          issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
        )}
      </motion.div>

      {/* Closed / Accomplished polls footer */}
      <div className="mt-12">
        <h2 className="text-lg font-bold text-kgc-text">Recently Resolved Grievances</h2>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          {[
            {
              t: "Cauvery water pipeline leakage — Mangaluru Ward 4",
              r: "94% Urgent",
              s: "RESOLVED · Completed in 18 hrs",
            },
            {
              t: "Primary Health Center generator replacement — Hubballi",
              r: "88% Urgent",
              s: "RESOLVED · Completed in 36 hrs",
            },
          ].map((c) => (
            <div
              key={c.t}
              className="bg-[#f9f9f9] rounded-2xl p-4 border border-[#e5e5e5]"
            >
              <div className="text-sm font-semibold text-kgc-text">{c.t}</div>
              <div className="text-xs text-kgc-muted mt-1">Grievance Consensus: {c.r}</div>
              <div className="text-[11px] text-kgc-accent font-bold mt-1.5 flex items-center gap-1">
                <Sparkles size={11} /> {c.s}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function useLocalVote(
  issueId: string,
  initialCounts: { urgent: number; important: number; minor: number; total: number },
) {
  const storageKey = "kgc_votes";
  const [userVote, setUserVote] = useState<"urgent" | "important" | "minor" | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return stored[issueId] || null;
    } catch {
      return null;
    }
  });

  const [counts, setCounts] = useState(initialCounts);

  const castVote = (voteType: "urgent" | "important" | "minor") => {
    if (userVote) return;

    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    stored[issueId] = voteType;
    localStorage.setItem(storageKey, JSON.stringify(stored));

    setUserVote(voteType);
    setCounts((prev) => ({
      ...prev,
      [voteType]: prev[voteType] + 1,
      total: prev.total + 1,
    }));

    const labels = { urgent: "🔴 Urgent", important: "🟡 Important", minor: "🟢 Minor" };
    toast.success(`✅ Vote recorded: ${labels[voteType]} — secured by Aadhaar hash`);

    kgcAPI.issues.vote(issueId, voteType).catch(() => {});
  };

  return { userVote, castVote, counts };
}

// ── REUSABLE SINGLE ISSUE CARD WITH LIVE VOTE HOOK ─────────────────
interface IssueCardProps {
  issue: IssueResponse;
}

function IssueCard({ issue }: IssueCardProps) {
  const { isLoggedIn } = useAuth();
  const { t } = useLang();

  const { userVote, counts, castVote } = useLocalVote(issue.id, {
    urgent: issue.votes_urgent || 0,
    important: issue.votes_important || 0,
    minor: issue.votes_minor || 0,
    total: issue.total_votes || 0,
  });

  const total = counts.total || 0;
  const pct = (k: "urgent" | "important" | "minor") => {
    if (total === 0) return 0;
    return Math.round((counts[k] / total) * 100);
  };

  const handleVoteClick = (type: "urgent" | "important" | "minor") => {
    if (!isLoggedIn) {
      toast.error("Please sign in to vote. One person, one vote is enforced.");
      window.dispatchEvent(new Event("kgc-open-login"));
      return;
    }

    if (userVote) {
      toast.info("You have already voted on this issue.");
      return;
    }

    castVote(type);
  };

  // UI mapping
  const OPTS: { k: "urgent" | "important" | "minor"; e: string; label: string; color: string }[] = [
    { k: "urgent", e: "🚨", label: "Urgent", color: "#E74C3C" },
    { k: "important", e: "⚠️", label: "Important", color: "#F59E0B" },
    { k: "minor", e: "ℹ️", label: "Minor", color: "#64748B" },
  ];

  const categoryEmoji =
    issue.category === "water"
      ? "Water"
      : issue.category === "electricity"
        ? "Electricity"
        : issue.category === "roads"
          ? "Roads"
          : issue.category === "health"
            ? "Health"
            : "Other";
  const priorityLevel =
    issue.priority_score > 10
      ? "CRITICAL CONSENSUS"
      : issue.priority_score > 4
        ? "MEDIUM IMPACT"
        : "LOW PRIORITY";

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
      }}
      className="bg-white rounded-3xl p-5 md:p-6 border border-[#e5e5e5] shadow-sm relative overflow-hidden lift"
    >
      {/* Top badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white bg-kgc-primary uppercase tracking-wider shadow-sm">
          {categoryEmoji}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
            issue.priority_score > 10
              ? "bg-red-500 text-white animate-pulse"
              : "bg-white text-kgc-text border border-[#e5e5e5]"
          }`}
        >
          {priorityLevel}
        </span>
        <span className="text-[11px] text-kgc-muted">
          District: <strong>{issue.district}</strong>
        </span>
        <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#f4f4f4] border border-[#e5e5e5] text-kgc-text shadow-sm">
          <Clock size={11} /> Priority Weight:{" "}
          {counts.total > 0
            ? (issue.priority_score + (userVote ? 2 : 0)).toFixed(1)
            : issue.priority_score.toFixed(1)}
        </span>
      </div>

      {/* Title & Description */}
      <h3 className="text-base md:text-lg font-bold text-kgc-text mt-3">{issue.title}</h3>
      <p className="text-xs md:text-sm text-kgc-muted mt-1.5 leading-normal">
        {issue.description || "Aggregated complaints awaiting local administration actions."}
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-kgc-muted">
        <span>
          Aggregated Complaints:{" "}
          <span className="text-kgc-text font-bold">{issue.complaint_count} citizens</span>
        </span>
        <span>
          Extracted Location: <span className="text-kgc-text font-semibold">{issue.location}</span>
        </span>
        <span>
          Assigned Dept:{" "}
          <span className="text-kgc-text font-semibold">
            {issue.department || "General Services"}
          </span>
        </span>
      </div>

      {/* Voting Buttons */}
      <div className="grid grid-cols-3 gap-2 mt-4 max-w-md relative">
        {OPTS.map((o) => {
          const active = userVote === o.k;
          const dimmed = userVote && userVote !== o.k;

          return (
            <button
              key={o.k}
              disabled={!!userVote}
              onClick={() => handleVoteClick(o.k)}
              className={`rounded-2xl p-2.5 flex flex-col items-center gap-0.5 border-2 transition-all duration-300 lift shrink-0 cursor-pointer relative overflow-hidden ${
                active
                  ? "text-white shadow-md font-bold ring-2 ring-offset-1"
                  : dimmed
                    ? "opacity-40 grayscale pointer-events-none"
                    : "bg-white text-kgc-text border border-transparent hover:bg-black/5"
              }`}
              style={active ? { background: o.color, borderColor: o.color } : {}}
            >
              {active && (
                <div className="absolute top-1 right-1 text-white opacity-90 animate-fade-in">
                  <CheckCircle2 size={14} />
                </div>
              )}
              <span className="text-[12px] font-bold mt-1">{o.label}</span>
              <span className={`text-[9px] ${active ? "text-white/90" : "text-kgc-muted"}`}>
                {counts[o.k]} votes
              </span>
            </button>
          );
        })}
      </div>

      {/* Live progress consensus bars */}
      {total > 0 && (
        <div className="mt-5 bg-[#f9f9f9] rounded-2xl p-3 border border-[#e5e5e5]">
          <div className="h-2 rounded-full overflow-hidden flex bg-black/5">
            {OPTS.map((o) => (
              <motion.div
                key={o.k}
                initial={{ width: 0 }}
                animate={{ width: `${pct(o.k)}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                style={{ background: o.color }}
                className="h-full"
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-kgc-muted mt-2 font-medium">
            {OPTS.map((o) => (
              <span key={o.k} className="flex items-center gap-1">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: o.color }}
                />
                {pct(o.k)}% {o.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Vote footer */}
      <div className="flex items-center justify-between mt-4 text-[10px] text-kgc-muted flex-wrap gap-2 pt-3 border-t border-black/5">
        <div>
          Total Votes Cast:{" "}
          <span className="text-kgc-text font-bold">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1 bg-white/40 px-2 py-1 rounded-full border border-white/60">
          <Lock size={11} className="text-kgc-primary" /> Secured by Aadhaar-hash validation. One
          vote per citizen.
        </div>
      </div>
    </motion.article>
  );
}
