import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Share2,
  Plus,
  X,
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useKGC";
import { toast } from "sonner";
import { kgcAPI } from "@/api/kgc";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLang } from "@/lib/language";

type Proposal = {
  id: string;
  author: string;
  handle: string;
  time: string;
  avatar: string;
  content: string;
  tags: string[];
  upvotes: number;
  downvotes: number;
  comments: number;
  imageUrl?: string | null;
};

const MOCK_PROPOSALS: Proposal[] = [
  {
    id: "prop-1",
    author: "Karthik R.",
    handle: "@karthik_r",
    time: "2h",
    avatar: "KR",
    content:
      "We should mandate rainwater harvesting in all new commercial buildings across Bengaluru. With summer droughts getting worse, this is non-negotiable for future water security.",
    tags: ["#WaterSecurity", "#Bengaluru"],
    upvotes: 1240,
    downvotes: 45,
    comments: 128,
  },
  {
    id: "prop-2",
    author: "Priya S.",
    handle: "@priya_edu",
    time: "4h",
    avatar: "PS",
    content:
      "Introduce free breakfast schemes in all government-aided schools, not just fully government ones. Many students in aided schools also come from economically weaker sections.",
    tags: ["#Education", "#Equality"],
    upvotes: 3402,
    downvotes: 12,
    comments: 450,
  },
  {
    id: "prop-3",
    author: "Manoj Kumar",
    handle: "@manoj_tech",
    time: "8h",
    avatar: "MK",
    content:
      "Digital grievance tracking is great, but we need physical 'E-Sevai' kiosks in every village panchayat for citizens who don't have smartphones to log their issues easily.",
    tags: ["#DigitalIndia", "#Accessibility"],
    upvotes: 890,
    downvotes: 67,
    comments: 92,
  },
  {
    id: "prop-4",
    author: "Lakshmi V.",
    handle: "@lakshmi_agri",
    time: "12h",
    avatar: "LV",
    content:
      "Subsidize solar water pumps for delta region farmers. The current electricity grid is too unreliable during peak summer sowing seasons.",
    tags: ["#Agriculture", "#FarmersFirst"],
    upvotes: 2150,
    downvotes: 88,
    comments: 210,
  },
  {
    id: "prop-5",
    author: "Arun T.",
    handle: "@arun_transpo",
    time: "1d",
    avatar: "AT",
    content:
      "Implement dedicated bus lanes on OMR during peak hours. Traffic is costing thousands of hours of productivity every single day.",
    tags: ["#Traffic", "#OMR", "#Bengaluru"],
    upvotes: 5600,
    downvotes: 340,
    comments: 890,
  },
  {
    id: "prop-6",
    author: "Divya N.",
    handle: "@divya_health",
    time: "1d",
    avatar: "DN",
    content:
      "Every taluk hospital should have a mandatory 24/7 snake-bite anti-venom stock. Too many rural lives are lost during transit to district HQs.",
    tags: ["#RuralHealth", "#Healthcare"],
    upvotes: 4520,
    downvotes: 5,
    comments: 320,
  },
];

export function ProposalsPage() {
  const { isLoggedIn, user } = useAuth();
  const { t, lang } = useLang();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    try {
      const data = await kgcAPI.proposals.list();
      setProposals(data);
    } catch (error) {
      console.error("Failed to load proposals", error);
      // Fallback to mock if API fails
      setProposals(MOCK_PROPOSALS);
    } finally {
      setLoading(false);
    }
  };
  // Form state
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [district, setDistrict] = useState("Bengaluru");
  const [submitting, setSubmitting] = useState(false);

  const DISTRICTS = [
    "Ariyalur",
    "Chengalpattu",
    "Bengaluru",
    "Mysuru",
    "Cuddalore",
    "Dharmapuri",
    "Dindigul",
    "Erode",
    "Kallakurichi",
    "Kancheepuram",
    "Karur",
    "Krishnagiri",
    "Hubballi",
    "Mayiladuthurai",
    "Nagapattinam",
    "Namakkal",
    "Nilgiris",
    "Perambalur",
    "Pudukkottai",
    "Ramanathapuram",
    "Ranipet",
    "Belagavi",
    "Sivaganga",
    "Tenkasi",
    "Thanjavur",
    "Theni",
    "Thoothukudi",
    "Tiruchirappalli",
    "Tirunelveli",
    "Tirupattur",
    "Tiruppur",
    "Tiruvallur",
    "Tiruvannamalai",
    "Tiruvarur",
    "Vellore",
    "Villupuram",
    "Virudhunagar",
  ];

  const CATEGORIES = [
    "🛣️ Infrastructure",
    "💧 Water",
    "🌿 Environment",
    "🏫 Education",
    "🏥 Health",
    "🌾 Agriculture",
    "🏘️ Urban",
    "💡 Innovation",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category || description.trim().length < 20) {
      toast.error(
        "Please provide a title, select a category, and enter at least 20 characters for description.",
      );
      return;
    }

    if (!isLoggedIn) {
      toast.error("Please sign in to submit a proposal.");
      window.dispatchEvent(new Event("kgc-open-login"));
      return;
    }

    setSubmitting(true);
    try {
      const fullContent = `${title}\n\n${description}\n\nDistrict: ${district}`;
      // Use existing submit API endpoint
      const res = await kgcAPI.proposals.submit(fullContent, category, null);

      const newProposal: Proposal = {
        id: res.proposal_id || `prop-new-${Date.now()}`,
        author: user?.name || "Citizen User",
        handle: `@citizen_${user?.mobile?.slice(-4) || "user"}`,
        time: "Just now",
        avatar: (user?.name || "C").charAt(0).toUpperCase(),
        content: fullContent,
        tags: [category.split(" ")[1] ? `#${category.split(" ")[1]}` : category],
        upvotes: 0,
        downvotes: 0,
        comments: 0,
      };

      setProposals([newProposal, ...proposals]);
      toast.success("✅ Proposal submitted — under AI review");

      setIsModalOpen(false);
      setTitle("");
      setCategory("");
      setDescription("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit proposal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-0 md:px-8 py-4 md:py-8 max-w-2xl mx-auto pb-24">
      <div className="px-4 md:px-0 border-b border-black/5 pb-3 mb-4">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-kgc-text">
              {t("proposalsTitle") || "Citizen Proposals"}
            </h1>
            <p className="text-xs text-kgc-muted mt-0.5">
              {lang === "kn" ? "மக்கள் யோசனைகள்" : "Voice your ideas for a better Karnataka"}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-4 md:px-0 mb-6">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-kgc-muted"
          />
          <input
            type="text"
            placeholder="Search proposals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-full border border-black/10 bg-white/50 text-sm focus:outline-none focus:ring-2 focus:ring-kgc-primary/20"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="px-4 md:px-0">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-3.5 rounded-2xl bg-kgc-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition lift cursor-pointer mb-4"
        >
          <span className="text-lg">+</span>{" "}
          {lang === "kn" ? "யோசனை சமர்ப்பிக்க" : "Submit Your Proposal"}
        </button>
      </div>

      {/* Feed */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.1 } },
        }}
        className="space-y-4 md:space-y-6"
      >
        {proposals.filter(
          (p) =>
            p.content.toLowerCase().includes(search.toLowerCase()) ||
            p.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())),
        ).length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center flex flex-col items-center">
            <div className="text-4xl">🔍</div>
            <div className="font-semibold mt-3 text-kgc-text text-lg">No proposals found</div>
            <div className="text-sm text-kgc-muted mt-1">
              Try adjusting your search terms or be the first to submit this idea!
            </div>
          </div>
        ) : (
          proposals
            .filter(
              (p) =>
                p.content.toLowerCase().includes(search.toLowerCase()) ||
                p.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase())),
            )
            .map((proposal, idx) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                isLast={idx === proposals.length - 1}
              />
            ))
        )}
      </motion.div>

      {/* Submit Form Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border border-[#e5e5e5] shadow-xl rounded-2xl bg-white">
          <div className="h-2 w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
          <div className="p-6">
            <DialogHeader className="mb-4">
              <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Submit a Proposal
              </DialogTitle>
              <DialogDescription className="text-kgc-muted">
                {lang === "kn" ? "யோசனை சமர்ப்பிக்கவும்" : "Share your idea to improve our state."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-kgc-text">Proposal Title</label>
                <input
                  type="text"
                  placeholder="What is your idea for Karnataka?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-kgc-primary/50 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-kgc-text">Category</label>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        category === c
                          ? "bg-kgc-primary text-white"
                          : "bg-black/5 text-kgc-text hover:bg-black/10"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-kgc-text">Description</label>
                <textarea
                  placeholder="Describe the problem and your proposed solution... (Kannada or English)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-kgc-primary/50 text-sm resize-none"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-kgc-text">District</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 focus:outline-none focus:ring-2 focus:ring-kgc-primary/50 text-sm bg-transparent"
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-kgc-primary text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 mt-2 cursor-pointer"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Submit Proposal →
              </button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function useProposalVote(proposalId: string, initialUp: number, initialDown: number) {
  const storageKey = "kgc_proposal_votes";

  const [vote, setVote] = useState<"up" | "down" | null>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      return stored[proposalId] || null;
    } catch {
      return null;
    }
  });

  const [upCount, setUpCount] = useState(initialUp);
  const [downCount, setDownCount] = useState(initialDown);

  const castVote = (type: "up" | "down") => {
    if (vote) return; // Cannot vote twice

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
      const newStored = { ...stored, [proposalId]: type };
      localStorage.setItem(storageKey, JSON.stringify(newStored));

      setVote(type);
      if (type === "up") {
        const newUp = upCount + 1;
        setUpCount(newUp);
        if ([1000, 5000, 10000].includes(newUp)) {
          toast.success(`🏆 This proposal reached ${newUp} votes!`);
        }
      } else {
        setDownCount((p) => p + 1);
      }

      // Fire API in background without blocking
      kgcAPI.proposals.vote(proposalId, type).catch(() => {});
    } catch (e) {
      console.error(e);
    }
  };

  return { vote, upCount, downCount, castVote };
}

function ProposalCard({ proposal, isLast }: { proposal: Proposal; isLast: boolean }) {
  const { isLoggedIn } = useAuth();
  const { vote, upCount, downCount, castVote } = useProposalVote(
    proposal.id,
    proposal.upvotes,
    proposal.downvotes,
  );

  const handleVote = (type: "up" | "down") => {
    if (!isLoggedIn) {
      toast.error("Please sign in to vote on proposals.");
      window.dispatchEvent(new Event("kgc-open-login"));
      return;
    }
    castVote(type);
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 25 } },
      }}
      className="bg-white border border-[#e5e5e5] shadow-sm rounded-3xl p-5 md:p-6 flex gap-4 transition-all hover:bg-[#f9f9f9] lift relative overflow-hidden group"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-kgc-primary/20 group-hover:bg-kgc-primary/50 transition-colors" />
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full gradient-blue shrink-0 flex items-center justify-center text-white font-bold text-base shadow-md">
        {proposal.avatar}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-kgc-text text-[15px] hover:underline cursor-pointer">
            {proposal.author}
          </span>
          <span className="text-kgc-muted text-[13px]">{proposal.handle}</span>
          <span className="text-kgc-muted text-[13px]">· {proposal.time}</span>
        </div>

        <p className="text-[15px] text-kgc-text mt-1 leading-relaxed">{proposal.content}</p>

        {proposal.imageUrl && (
          <div className="mt-3 rounded-2xl overflow-hidden border border-black/5">
            <img
              src={`${import.meta.env.VITE_API_URL || "http://localhost:8000"}${proposal.imageUrl}`}
              alt="Proposal Attachment"
              className="max-w-full h-auto max-h-80 object-cover"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 mt-2">
          {proposal.tags.map((tag) => (
            <span
              key={tag}
              className="text-kgc-primary text-[13px] hover:underline cursor-pointer"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Interaction Bar */}
        <div className="flex items-center justify-between mt-4 text-kgc-muted max-w-md pr-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleVote("up")}
            className={`flex items-center gap-1.5 text-[13px] font-medium transition-colors p-2 rounded-full hover:bg-blue-50 hover:text-blue-600 cursor-pointer ${vote === "up" ? "text-white bg-blue-600 ring-1 ring-blue-600" : ""}`}
          >
            {vote === "up" ? <CheckCircle2 size={16} /> : <ThumbsUp size={16} />}
            <span>{upCount}</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleVote("down")}
            className={`flex items-center gap-1.5 text-[13px] font-medium transition-colors p-2 rounded-full hover:bg-red-50 hover:text-red-600 cursor-pointer ${vote === "down" ? "text-white bg-red-600 ring-1 ring-red-600" : ""}`}
          >
            {vote === "down" ? <CheckCircle2 size={16} /> : <ThumbsDown size={16} />}
            <span>{downCount}</span>
          </motion.button>

          <button className="flex items-center gap-1.5 text-[13px] font-medium transition-colors p-1.5 rounded-full hover:bg-kgc-primary/10 hover:text-kgc-primary">
            <MessageSquare size={16} />
            <span>{proposal.comments}</span>
          </button>

          <button className="flex items-center gap-1.5 text-[13px] font-medium transition-colors p-1.5 rounded-full hover:bg-green-50 hover:text-green-600">
            <Share2 size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
