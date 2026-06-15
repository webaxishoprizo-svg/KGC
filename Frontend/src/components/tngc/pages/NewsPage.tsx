import { useMemo, useState, useEffect } from "react";
import {
  Search,
  Eye,
  MessageCircle,
  Share2,
  ArrowRight,
  X,
  ThumbsUp,
  ThumbsDown,
  Vote,
  Gavel,
  ExternalLink,
  RefreshCw,
  HelpCircle,
} from "lucide-react";
import { NEWS, AUCTIONS } from "@/lib/mock-data";
import { useLang } from "@/lib/language";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const INITIAL_VOTES: Record<string, any> = {
  n1: { Support: 8420, Oppose: 312, Modify: 890, Neutral: 420 },
  n2: { Support: 12300, Oppose: 89, Modify: 340, Neutral: 210 },
  n3: { Support: 6700, Oppose: 450, Modify: 1200, Neutral: 380 },
  n4: { Support: 9800, Oppose: 120, Modify: 560, Neutral: 290 },
  n5: { Support: 15200, Oppose: 680, Modify: 2100, Neutral: 890 },
};

function useNewsVote(newsId: string) {
  const storageKey = "kgc_news_votes";
  const [vote, setVote] = useState<string | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return stored[newsId] || null;
    } catch {
      return null;
    }
  });

  const initial = INITIAL_VOTES[newsId] || { Support: 0, Oppose: 0, Modify: 0, Neutral: 0 };
  const [counts, setCounts] = useState(initial);

  useEffect(() => {
    // Sync counts when newsId changes, and if already voted, increment that count
    const initial = INITIAL_VOTES[newsId] || { Support: 0, Oppose: 0, Modify: 0, Neutral: 0 };
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const savedVote = stored[newsId];
      if (savedVote) {
        setCounts({ ...initial, [savedVote]: initial[savedVote] + 1 });
        setVote(savedVote);
      } else {
        setCounts(initial);
        setVote(null);
      }
    } catch {
      setCounts(initial);
      setVote(null);
    }
  }, [newsId]);

  const castVote = (type: string) => {
    if (vote) return;
    const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
    stored[newsId] = type;
    localStorage.setItem(storageKey, JSON.stringify(stored));

    setVote(type);
    setCounts((prev: any) => ({ ...prev, [type]: prev[type] + 1 }));
  };

  return { vote, counts, castVote };
}

const CATS = [
  "All",
  "Infrastructure",
  "Health",
  "Education",
  "Agriculture",
  "Water",
  "Transport",
  "Urban",
];

export function NewsPage() {
  const { t, lang } = useLang();
  const [tab, setTab] = useState<"News" | "Auctions">("News");
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [voteModalOpen, setVoteModalOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<any>(null);

  const { vote, counts, castVote } = useNewsVote(selectedNews?.id || "");

  const handleOpenVote = (news: any) => {
    setSelectedNews(news);
    setVoteModalOpen(true);
  };

  const submitVote = (type: string) => {
    castVote(type);
    toast.success(`✅ Vote recorded`);
  };
  const featured = NEWS.find((n) => n.featured)!;
  const list = useMemo(
    () =>
      NEWS.filter((n) => !n.featured)
        .filter((n) => cat === "All" || n.category === cat)
        .filter((n) => n.title.toLowerCase().includes(q.toLowerCase())),
    [cat, q],
  );

  return (
    <div className="px-4 md:px-8 py-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold text-kgc-text">
          {t("newsTitle") || "Government News"}
        </h1>
        <div className="flex items-center bg-gray-100 rounded-full p-1 border border-black/5 self-start">
          <button
            onClick={() => setTab("News")}
            className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all ${tab === "News" ? "bg-white shadow-sm text-kgc-primary" : "text-kgc-muted hover:text-kgc-text"}`}
          >
            News & Updates
          </button>
          <button
            onClick={() => setTab("Auctions")}
            className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${tab === "Auctions" ? "bg-white shadow-sm text-kgc-primary" : "text-kgc-muted hover:text-kgc-text"}`}
          >
            <Gavel size={14} /> E-Auctions
          </button>
        </div>
      </div>

      {tab === "News" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mt-5 glass rounded-2xl px-4 py-2.5 flex items-center gap-2">
            <Search size={16} className="text-kgc-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("searchAnnouncements")}
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-kgc-muted"
            />
          </div>

          <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide pb-1">
            {CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  cat === c ? "bg-[#212121] text-white" : "bg-[#f4f4f4] text-[#888] border border-[#e5e5e5] hover:bg-[#e5e5e5]"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Featured */}
          <article
            className="relative overflow-hidden rounded-3xl mt-6 lift"
            style={{ minHeight: 240 }}
          >
            <div className="absolute inset-0 gradient-blue" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.25), transparent 60%)",
              }}
            />
            <div className="relative p-6 md:p-8 text-white">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-kgc-warning text-[10px] font-bold tracking-wider">
                ★ {t("featured")}
              </span>
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-full bg-white/20">{featured.dept}</span>
                <span>· {featured.district}</span>
                <span>· {featured.date}</span>
              </div>
              <h2 className="text-xl md:text-3xl font-bold mt-3 max-w-2xl">
                {lang === "kn" ? featured.kannada : featured.title}
              </h2>
              {lang === "en" && (
                <p className="text-sm md:text-base text-white/85 mt-2 max-w-2xl">
                  {featured.summary}
                </p>
              )}
              <div className="flex items-center justify-between mt-5">
                <div className="text-xs text-white/80 flex items-center gap-3">
                  <span>
                    <Eye size={12} className="inline" /> {featured.views.toLocaleString()}
                  </span>
                  <span>
                    <MessageCircle size={12} className="inline" /> {featured.comments}
                  </span>
                </div>
                <button
                  onClick={() => handleOpenVote(featured)}
                  className="px-4 py-2 rounded-full bg-white text-kgc-primary text-xs font-semibold flex items-center gap-1.5 lift"
                >
                  {t("voteOnThis")} <ArrowRight size={12} />
                </button>
              </div>
            </div>
          </article>

          <div className="space-y-4 mt-6">
            {list.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center">
                <div className="text-4xl">📭</div>
                <div className="font-semibold mt-2 text-kgc-text">
                  No announcements yet in this category
                </div>
                <div className="text-sm text-kgc-muted">
                  Check back soon or browse other categories.
                </div>
              </div>
            ) : (
              list.map((n) => (
                <article key={n.id} className="glass rounded-2xl p-5 lift">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-white"
                        style={{ background: n.deptColor }}
                      >
                        {n.dept}
                      </span>
                      <span className="text-[11px] text-kgc-muted">📍 {n.district}</span>
                    </div>
                    <span className="text-[11px] text-kgc-muted">{n.date}</span>
                  </div>
                  <h3 className="font-bold text-kgc-text mt-2.5 text-lg leading-tight">
                    {lang === "kn" ? n.kannada : n.title}
                  </h3>
                  {lang === "en" && (
                    <p className="text-sm text-kgc-muted mt-1.5 line-clamp-3">{n.summary}</p>
                  )}
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-kgc-muted flex items-center gap-4">
                      <span>
                        <Eye size={12} className="inline" /> {n.views.toLocaleString()} {t("views")}
                      </span>
                      <span>
                        <MessageCircle size={12} className="inline" /> {n.comments} {t("comments")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="w-9 h-9 rounded-full bg-white border border-[#e5e5e5] grid place-items-center text-[#888] hover:bg-[#f9f9f9] lift">
                        <Share2 size={14} />
                      </button>
                      <button
                        onClick={() => handleOpenVote(n)}
                        className="px-3 py-1.5 rounded-full bg-kgc-primary text-white text-xs font-semibold flex items-center gap-1 lift"
                      >
                        {t("voteOnThis")} <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </motion.div>
      )}

      {tab === "Auctions" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8">
          <p className="text-sm text-kgc-muted mb-6">
            Live official e-Auctions and tenders from the Government of Karnataka.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUCTIONS.map((a) => (
              <article
                key={a.id}
                className="glass rounded-2xl p-5 lift flex flex-col h-full border border-black/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-kgc-primary bg-blue-50 border border-blue-100 uppercase tracking-wider">
                    {a.dept}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${a.status === "Live" ? "text-emerald-700 bg-emerald-50 border border-emerald-200" : "text-orange-700 bg-orange-50 border border-orange-200"}`}
                  >
                    {a.status}
                  </span>
                </div>
                <h3 className="font-bold text-kgc-text mt-3 text-lg leading-tight">{a.title}</h3>
                <div className="flex flex-col gap-1.5 mt-4 flex-1">
                  <div className="text-[13px] flex items-center gap-2 text-kgc-muted">
                    <span className="font-semibold text-kgc-text min-w-[70px]">District:</span>{" "}
                    {a.district}
                  </div>
                  <div className="text-[13px] flex items-center gap-2 text-kgc-muted">
                    <span className="font-semibold text-kgc-text min-w-[70px]">Base Price:</span>{" "}
                    <span className="font-mono text-kgc-primary font-bold">{a.basePrice}</span>
                  </div>
                  <div className="text-[13px] flex items-center gap-2 text-kgc-muted">
                    <span className="font-semibold text-kgc-text min-w-[70px]">End Date:</span>{" "}
                    {a.endDate}
                  </div>
                </div>
                <div className="mt-5 pt-4 border-t border-black/5 flex justify-end">
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-kgc-primary hover:bg-kgc-accent text-white rounded-xl text-[12px] font-bold flex items-center gap-2 lift shadow-sm transition"
                  >
                    View Official Listing <ExternalLink size={12} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </motion.div>
      )}

      {/* Vote Modal */}
      <AnimatePresence>
        {voteModalOpen && selectedNews && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVoteModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-4 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2 text-kgc-primary font-bold">
                  <Vote size={16} /> Quick Opinion Poll
                </div>
                <button
                  onClick={() => setVoteModalOpen(false)}
                  className="px-3 py-1.5 rounded-full hover:bg-black/5 transition text-kgc-muted font-semibold text-sm"
                >
                  {vote ? "✅ Vote Recorded" : <X size={18} />}
                </button>
              </div>

              <div className="p-6 text-center">
                <h3 className="font-bold text-kgc-text leading-tight">
                  {lang === "kn" ? selectedNews.kannada : selectedNews.title}
                </h3>
                <p className="text-xs text-kgc-muted mt-2">
                  Do you support this government initiative?
                </p>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  {[
                    {
                      label: "Support",
                      icon: ThumbsUp,
                      color: "emerald",
                      active: vote === "Support",
                      count: counts.Support,
                    },
                    {
                      label: "Oppose",
                      icon: ThumbsDown,
                      color: "red",
                      active: vote === "Oppose",
                      count: counts.Oppose,
                    },
                    {
                      label: "Modify",
                      icon: RefreshCw,
                      color: "orange",
                      active: vote === "Modify",
                      count: counts.Modify,
                    },
                    {
                      label: "Neutral",
                      icon: HelpCircle,
                      color: "gray",
                      active: vote === "Neutral",
                      count: counts.Neutral,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      disabled={!!vote}
                      onClick={() => submitVote(opt.label)}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                        opt.active
                          ? `border-${opt.color}-500 bg-${opt.color}-500 text-white shadow-md scale-[1.02]`
                          : vote
                            ? "border-black/5 bg-black/5 text-gray-400 opacity-50 cursor-not-allowed"
                            : `border-${opt.color}-100 bg-${opt.color}-50 text-${opt.color}-600 hover:bg-${opt.color}-100 hover:border-${opt.color}-200 lift cursor-pointer`
                      }`}
                    >
                      <opt.icon size={24} />
                      <span className="font-bold text-sm">{opt.label}</span>
                      <span
                        className={`text-[10px] font-medium ${opt.active ? "text-white/90" : "text-kgc-muted"}`}
                      >
                        {opt.count.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 text-xs font-semibold text-kgc-muted">
                  Total votes:{" "}
                  {Object.values(counts as Record<string, number>)
                    .reduce((a, b) => a + b, 0)
                    .toLocaleString()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
