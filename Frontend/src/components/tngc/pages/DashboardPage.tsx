import { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  AlertTriangle,
  Check,
  X,
  Sparkles,
  UserCircle,
  LayoutDashboard,
  Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useKGC";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const TABS = ["📋 My Complaints", "🗳️ My Votes", "🔔 Notifications"];
const STAGES = ["Submitted", "Assigned", "In Progress", "Resolved"];

const CITIZEN_MOCK_COMPLAINTS = [
  {
    id: "cmpl-1",
    category: "water",
    spam_flagged: false,
    issue_id: "issue-1",
    created_at: "2026-05-28T10:00:00Z",
    ai_summary: "No water in Ward 12 for 3 days",
    location_extracted: "Ward 12",
    statusStr: "RESOLVED",
    statusColor: "#10B981",
    stageIdx: 3,
  },
  {
    id: "cmpl-2",
    category: "electricity",
    spam_flagged: false,
    issue_id: "issue-2",
    created_at: "2026-05-29T14:30:00Z",
    ai_summary: "Streetlight not working causing safety issues",
    location_extracted: "Main Road",
    statusStr: "IN PROGRESS",
    statusColor: "#F59E0B",
    stageIdx: 2,
  },
  {
    id: "cmpl-3",
    category: "roads",
    spam_flagged: false,
    issue_id: null,
    created_at: "2026-05-30T09:15:00Z",
    ai_summary: "Deep pothole near elementary school",
    location_extracted: "Anna Nagar",
    statusStr: "SUBMITTED",
    statusColor: "#1B4F8A",
    stageIdx: 0,
  },
];

const MOCK_PENDING_ISSUES = [
  {
    id: "pi-1",
    category: "water",
    location: "Mangaluru Ward 12",
    complaint_count: 14,
    title: "Severe Water Shortage in Ward 12",
    description: "Multiple complaints about no water supply for 3 days.",
  },
  {
    id: "pi-2",
    category: "roads",
    location: "Hubballi Junction",
    complaint_count: 8,
    title: "Deep Pothole causing traffic",
    description: "Large pothole reported near the main junction causing accidents.",
  },
];

const MOCK_RESOLVED_ISSUES = [
  {
    id: "ri-1",
    ticket: "KGC-2026-TNE-102938",
    title: "Transformer failure replaced",
    department: "TNEB",
    sla: "18 hrs",
  },
  {
    id: "ri-2",
    ticket: "KGC-2026-WAT-938271",
    title: "Cauvery pipeline repaired",
    department: "Water Board",
    sla: "36 hrs",
  },
  {
    id: "ri-3",
    ticket: "KGC-2026-ROA-482910",
    title: "Street pothole patched",
    department: "Highways",
    sla: "4 days",
  },
];

export function DashboardPage() {
  const { user, isLoggedIn } = useAuth();
  const [isAdminView, setIsAdminView] = useState(false);

  if (!isLoggedIn) {
    return <DemoDashboardPreview />;
  }

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 md:right-8 z-10 flex items-center gap-2">
        <span className="text-xs font-semibold text-kgc-text">Officer View</span>
        <button
          onClick={() => setIsAdminView(!isAdminView)}
          className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isAdminView ? "bg-kgc-primary" : "bg-gray-300"}`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isAdminView ? "translate-x-6" : "translate-x-0"}`}
          />
        </button>
      </div>

      {isAdminView ? <OfficerDashboard /> : <CitizenDashboard user={user} />}
    </div>
  );
}

// ── 1. DEMO DASHBOARD PREVIEW ─────────────────────────────────────
function DemoDashboardPreview() {
  const [isAdminView, setIsAdminView] = useState(false);

  const handleSignInTrigger = () => {
    window.dispatchEvent(new Event("kgc-open-login"));
  };

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 md:right-8 z-20 flex flex-col items-end gap-2">
        <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 shadow-sm animate-pulse">
          Demo Mode - Showing Sample Dashboard
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs font-semibold text-kgc-text">Officer View</span>
          <button
            onClick={() => setIsAdminView(!isAdminView)}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isAdminView ? "bg-kgc-primary" : "bg-gray-300"} cursor-pointer`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isAdminView ? "translate-x-6" : "translate-x-0"}`}
            />
          </button>
        </div>
      </div>

      {isAdminView ? <OfficerDashboard /> : <CitizenDashboard user={{ mobile: "DemoUser" }} />}

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-black/10 p-4 z-50 flex items-center justify-between shadow-[0_-8px_30px_rgba(0,0,0,0.05)]">
        <div>
          <h3 className="font-bold text-kgc-text text-sm">Sign in to save your progress</h3>
          <p className="text-xs text-kgc-muted">Secure login via MSG91 OTP</p>
        </div>
        <button
          onClick={handleSignInTrigger}
          className="py-2 px-6 rounded-xl bg-kgc-primary hover:opacity-95 text-white font-semibold text-sm shadow-md lift cursor-pointer"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}

// ── 2. CITIZEN DASHBOARD ─────────────────────────────────────────────
function CitizenDashboard({ user }: { user: any }) {
  const [tab, setTab] = useState(TABS[0]);
  const complaints = CITIZEN_MOCK_COMPLAINTS;

  const initials = "C";
  const name = `Citizen User (${user?.mobile?.slice(-4) || ""})`;

  const stats = [
    { e: "📋", l: "Grievances Filed", v: 3 },
    { e: "🗳️", l: "Verified Votes", v: 2 },
    { e: "✅", l: "Resolved", v: 1 },
  ];

  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto animate-fade-in pb-24">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-kgc-text">My Grievance Dashboard</h1>
        <p className="text-kgc-secondary mt-1 text-xs font-semibold uppercase tracking-wider">
          Citizen Control Room
        </p>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <div className="w-12 h-12 rounded-full gradient-blue text-white grid place-items-center font-bold text-lg shadow-sm">
          {initials}
        </div>
        <div>
          <div className="font-semibold text-kgc-text">Welcome back, {name}</div>
          <div className="flex items-center gap-1 text-xs text-kgc-accent font-semibold">
            <CheckCircle2 size={12} /> Aadhaar OTP Secured
          </div>
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {stats.map((s) => (
          <div
            key={s.l}
            className="glass rounded-2xl p-4 border border-white/60 bg-white/40 shadow-sm relative overflow-hidden"
          >
            <div className="text-lg">{s.e}</div>
            <div className="text-xl md:text-2xl font-bold text-kgc-text mt-1">{s.v}</div>
            <div className="text-[10px] md:text-xs text-kgc-muted font-medium">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-8 overflow-x-auto scrollbar-hide pb-1 border-b border-black/5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              tab === t ? "bg-[#212121] text-white" : "bg-[#f4f4f4] border border-[#e5e5e5] text-[#888] hover:bg-[#e5e5e5]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === TABS[0] && <CitizenComplaintsList complaints={complaints} />}
        {tab === TABS[1] && (
          <div className="glass rounded-3xl p-8 text-center border border-white/60 bg-white/40">
            <div className="text-4xl mb-3">🗳️</div>
            <div className="font-bold text-kgc-text">Your Voting History</div>
            <div className="mt-4 space-y-3 max-w-lg mx-auto text-left">
              <div className="bg-[#f9f9f9] border border-[#e5e5e5] p-3 rounded-xl text-sm text-[#212121]">
                <div className="font-bold text-kgc-text">
                  Deep Potholes on Highway causing Accidents
                </div>
                <div className="text-xs text-kgc-muted mt-1">
                  Voted: <span className="font-bold text-red-600">🚨 URGENT</span> on May 29, 2026
                </div>
              </div>
              <div className="bg-[#f9f9f9] border border-[#e5e5e5] p-3 rounded-xl text-sm text-[#212121]">
                <div className="font-bold text-kgc-text">
                  Frequent Power Cuts during School Hours
                </div>
                <div className="text-xs text-kgc-muted mt-1">
                  Voted: <span className="font-bold text-yellow-600">⚠️ IMPORTANT</span> on May 28,
                  2026
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === TABS[2] && <NotificationsList />}
      </div>
    </div>
  );
}

function CitizenComplaintsList({ complaints }: { complaints: any[] }) {
  return (
    <div className="space-y-4">
      {complaints.map((c) => {
        const categoryEmoji =
          c.category === "water"
            ? "💧"
            : c.category === "electricity"
              ? "⚡"
              : c.category === "roads"
                ? "🛣️"
                : "🏛️";

        return (
          <article
            key={c.id}
            className="glass rounded-2xl p-5 border border-white/60 bg-white/40 shadow-sm relative overflow-hidden lift"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-kgc-muted">
                ID: {c.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#f4f4f4] text-[10px] font-bold text-[#555] uppercase border border-[#e5e5e5]">
                {categoryEmoji} {c.category}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-bold text-white uppercase"
                style={{ background: c.statusColor }}
              >
                {c.statusStr}
              </span>
              <span className="ml-auto text-[10px] text-kgc-muted">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
            </div>

            <div className="font-bold text-kgc-text mt-3 text-sm md:text-base">{c.ai_summary}</div>

            {/* Live Progress Bar */}
            <div className="mt-5">
              <div className="flex items-center justify-between text-[9px] text-kgc-muted font-bold px-1">
                {STAGES.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
              <div className="relative mt-2 h-1.5 rounded-full bg-black/5">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000"
                  style={{ width: `${(c.stageIdx / 3) * 100}%`, background: c.statusColor }}
                />
                {STAGES.map((_, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm transition-all duration-300"
                    style={{
                      left: `calc(${(i / 3) * 100}% - 7px)`,
                      background: i <= c.stageIdx ? c.statusColor : "#E5E7EB",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mt-5 pt-3 border-t border-black/5 text-[10px] text-kgc-muted flex-wrap gap-2">
              <div>
                📍 Extracted:{" "}
                <span className="text-kgc-text font-semibold">{c.location_extracted}</span>
              </div>
              <div>
                Submitted via: <span className="text-kgc-text font-bold">AI Chatbot Gateway</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ── CITIZEN NOTIFICATIONS LIST ──────────────────────────────────────
function NotificationsList() {
  const list = [
    {
      id: "1",
      icon: "✅",
      text: "Your water grievance leakage issue has been formally Approved and published.",
      time: "2 hours ago",
    },
    {
      id: "2",
      icon: "🗳️",
      text: "Your vote was registered successfully. Thank you for prioritizing your community.",
      time: "1 day ago",
    },
    {
      id: "3",
      icon: "🎫",
      text: "New ticket KGC-2026-ROA-83921 has been assigned to Highways Dept.",
      time: "2 days ago",
    },
  ];

  return (
    <div className="space-y-3 mt-4">
      {list.map((n) => (
        <div
          key={n.id}
          className="glass rounded-2xl p-4 border border-white/60 bg-white/40 flex items-start gap-3 shadow-sm lift"
        >
          <div className="text-lg shrink-0">{n.icon}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-kgc-text">{n.text}</div>
            <div className="text-[10px] text-kgc-muted mt-0.5">{n.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 3. OFFICER DASHBOARD (ADMIN) ─────────────────────────────────────
function OfficerDashboard() {
  const [pendingIssues, setPendingIssues] = useState(MOCK_PENDING_ISSUES);
  const resolvedIssues = MOCK_RESOLVED_ISSUES;

  const handleApproveSubmit = (id: string) => {
    toast.success("Grievance approved and published!");
    setPendingIssues(pendingIssues.filter((i) => i.id !== id));
  };

  const handleRejectSubmit = (id: string) => {
    toast.success("Grievance rejected.");
    setPendingIssues(pendingIssues.filter((i) => i.id !== id));
  };

  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto animate-fade-in pb-24">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-kgc-text">
          Officer Administration Panel
        </h1>
        <p className="text-kgc-secondary mt-1 text-xs font-semibold uppercase tracking-wider">
          Karnataka Grievance Intelligence System
        </p>
      </div>

      {/* KPI Dashboard Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <div className="glass p-4 rounded-2xl border border-white/60 bg-white/40 shadow-sm">
          <div className="text-[10px] font-bold text-kgc-muted uppercase flex items-center gap-1">
            <CheckCircle2 size={12} /> Resolved Today
          </div>
          <div className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">28</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-white/60 bg-white/40 shadow-sm">
          <div className="text-[10px] font-bold text-kgc-muted uppercase flex items-center gap-1">
            <Clock size={12} /> Average SLA
          </div>
          <div className="text-xl md:text-2xl font-bold text-kgc-primary mt-1">3.4 Days</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-white/60 bg-white/40 shadow-sm">
          <div className="text-[10px] font-bold text-kgc-muted uppercase">Active Public Polls</div>
          <div className="text-xl md:text-2xl font-bold text-kgc-text mt-1">5</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-white/60 bg-white/40 shadow-sm">
          <div className="text-[10px] font-bold text-kgc-muted uppercase">High Priority</div>
          <div className="text-xl md:text-2xl font-bold text-red-600 mt-1">2</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mt-8">
        {/* Pending Approval Queue */}
        <div>
          <h2 className="text-lg font-bold text-kgc-text flex items-center gap-2">
            📥 Pending Approvals
            {pendingIssues.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] grid place-items-center font-bold">
                {pendingIssues.length}
              </span>
            )}
          </h2>
          <p className="text-[11px] text-kgc-muted mt-1 leading-normal mb-4">
            AI automatically aggregates similar semantic complaints into single issue models. Review
            and publish.
          </p>

          <div className="space-y-4">
            <AnimatePresence>
              {pendingIssues.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="glass rounded-3xl p-8 text-center border border-white/60 bg-white/40"
                >
                  <CheckCircle2 size={24} className="mx-auto text-emerald-600 mb-2" />
                  <div className="font-bold text-kgc-text text-sm">Queue Clear</div>
                </motion.div>
              )}
              {pendingIssues.map((issue) => {
                const categoryEmoji =
                  issue.category === "water"
                    ? "💧"
                    : issue.category === "electricity"
                      ? "⚡"
                      : issue.category === "roads"
                        ? "🛣️"
                        : "🏛️";
                return (
                  <motion.article
                    key={issue.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="glass rounded-2xl p-4 border border-amber-200 bg-amber-50/40 shadow-sm flex flex-col gap-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-800 bg-amber-200 uppercase tracking-wider">
                        {categoryEmoji} {issue.category}
                      </span>
                      <span className="text-[10px] text-kgc-muted font-semibold">
                        📍 {issue.location}
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#f4f4f4] border border-[#e5e5e5] text-[#555]">
                        {issue.complaint_count} Complaints
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-kgc-text mt-1">{issue.title}</h3>
                    <p className="text-[11px] text-kgc-muted leading-normal line-clamp-2">
                      {issue.description}
                    </p>

                    <div className="flex gap-2 mt-2 w-full justify-end border-t border-black/5 pt-2">
                      <button
                        onClick={() => handleRejectSubmit(issue.id)}
                        className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 bg-red-50/50 text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-red-50"
                      >
                        <X size={12} /> Reject
                      </button>
                      <button
                        onClick={() => handleApproveSubmit(issue.id)}
                        className="px-3 py-1.5 rounded-xl bg-kgc-primary text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:opacity-95"
                      >
                        <Check size={12} /> Publish Live
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Resolved Issues Table */}
        <div>
          <h2 className="text-lg font-bold text-kgc-text flex items-center gap-2">
            ✅ Recently Resolved
          </h2>
          <p className="text-[11px] text-kgc-muted mt-1 leading-normal mb-4">
            Grievances successfully addressed by respective departments.
          </p>

          <div className="glass rounded-2xl overflow-hidden border border-white/60 shadow-sm bg-white/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/50 text-kgc-muted font-bold uppercase text-[9px]">
                <tr>
                  <th className="px-4 py-3">Ticket / Issue</th>
                  <th className="px-4 py-3">Dept</th>
                  <th className="px-4 py-3 text-right">SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/40">
                {resolvedIssues.map((ri) => (
                  <tr key={ri.id} className="hover:bg-white/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-kgc-primary text-[10px]">{ri.ticket}</div>
                      <div className="font-semibold text-kgc-text truncate max-w-[150px] mt-0.5">
                        {ri.title}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-kgc-muted">{ri.department}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{ri.sla}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
