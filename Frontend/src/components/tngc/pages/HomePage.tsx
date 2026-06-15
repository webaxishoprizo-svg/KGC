import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, Lock, Shield, Languages, EyeOff } from "lucide-react";
import { Logo } from "../Logo";
import { DEPARTMENTS } from "@/lib/mock-data";
import { useLang } from "@/lib/language";

const STATS = [
  { v: "77M", l: "Citizens Served" },
  { v: "43", l: "Departments Connected" },
  { v: "38", l: "Districts Covered" },
  { v: "99%", l: "Spam Filtered" },
];

const STEPS = [
  { e: "1", t: "Open the Chat", d: "Talk to our AI in Kannada or English" },
  { e: "2", t: "AI Understands", d: "AI identifies your issue and the right department" },
  { e: "3", t: "Auto-Routed", d: "Your complaint reaches the exact department in seconds" },
  { e: "4", t: "Get Updates", d: "Track status via SMS and the app" },
];

const FEATURES = [
  {
    icon: Lock,
    t: "Aadhaar Secured",
    d: "Zero fake accounts. Every citizen verified with Aadhaar OTP. One person, one vote — enforced absolutely.",
  },
  {
    icon: Shield,
    t: "Zero Spam",
    d: "5-layer AI spam filter. Only real complaints reach government officers. 99%+ accuracy.",
  },
  {
    icon: Languages,
    t: "Kannada First",
    d: "Full Kannada voice and text AI. Built with Sarvam AI, Bhashini, and AI4Bharat — all Indian, all free.",
  },
  {
    icon: EyeOff,
    t: "Zero Profiling",
    d: "Your complaints are tickets, not records. We never build a citizen profile. DPDP 2023 compliant.",
  },
];

export function HomePage() {
  const { t, lang } = useLang();
  const ticker = [...DEPARTMENTS, ...DEPARTMENTS];
  return (
    <div className="px-4 md:px-8 py-8 md:py-12 max-w-6xl mx-auto">
      {/* Hero */}
      <section className="text-center pt-4 md:pt-10">
        <div className="flex justify-center animate-float">
          <Logo size={88} />
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-kgc-text mt-6 leading-tight tracking-tight">
          {lang === "kn" ? (
            <>
              தமிழ்நாட்டின் முதல் AI
              <br className="hidden md:block" />
              <span className="text-kgc-primary"> அரசு இணைப்பு தளம்</span>
            </>
          ) : (
            <>
              Karnataka's First AI
              <br className="hidden md:block" />
              <span className="text-kgc-primary"> Government Connect Platform</span>
            </>
          )}
        </h1>
        <p className="text-xl md:text-2xl text-kgc-secondary mt-3 font-medium">
          {t("appTagline")}
        </p>
        <p className="text-sm md:text-base text-kgc-muted max-w-2xl mx-auto mt-5">
          One platform to file grievances and vote on government projects — powered by Kannada AI,
          secured by Aadhaar, trusted by 77 million citizens.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-7">
          <Link
            to="/"
            className="px-5 py-3 rounded-full bg-kgc-primary text-white font-semibold flex items-center gap-2 lift shadow-lg"
          >
            Start Chatting <ArrowRight size={16} />
          </Link>
          <a
            href="#how"
            className="px-5 py-3 rounded-full glass font-semibold text-kgc-primary lift"
          >
            Learn How It Works
          </a>
        </div>
        <div className="mt-10 flex justify-center text-kgc-muted text-xs">
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="flex flex-col items-center"
          >
            Scroll to learn more <ChevronDown size={14} />
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-12">
        {STATS.map((s) => (
          <div key={s.l} className="glass rounded-2xl p-5 text-center lift">
            <div className="text-2xl md:text-3xl font-bold text-kgc-primary">{s.v}</div>
            <div className="text-xs text-kgc-muted mt-1">{s.l}</div>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section id="how" className="mt-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-kgc-text">
          How KGC Works
        </h2>
        <p className="text-center text-kgc-muted text-sm mt-2">
          Four steps from complaint to resolution.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
          {STEPS.map((s, i) => (
            <div key={s.t} className="glass rounded-2xl p-5 relative lift">
              <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-kgc-primary text-white font-bold grid place-items-center text-sm shadow-lg">
                {i + 1}
              </div>
              <div className="text-4xl text-center mt-2 font-bold text-gray-300">{s.e}</div>
              <div className="font-semibold text-kgc-text text-center mt-3">{s.t}</div>
              <div className="text-xs text-kgc-muted text-center mt-1">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-kgc-text">
          Built on four guarantees
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.t} className="glass rounded-2xl p-6 lift">
                <div className="w-11 h-11 rounded-2xl bg-kgc-primary text-white grid place-items-center">
                  <Icon size={20} />
                </div>
                <div className="font-bold text-kgc-text mt-3 text-lg">{f.t}</div>
                <div className="text-sm text-kgc-muted mt-1">{f.d}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Departments ticker */}
      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-kgc-text">
          Connected to all 43 Karnataka Departments
        </h2>
        <div className="mt-6 glass rounded-3xl py-4 overflow-hidden">
          <div className="flex gap-3 w-max animate-ticker">
            {ticker.map((d, i) => (
              <span
                key={i}
                className="shrink-0 px-4 py-2 rounded-full bg-white border border-[#e5e5e5] text-sm font-medium text-[#212121]"
              >
                {d.name}
              </span>
            ))}
            <span className="shrink-0 px-4 py-2 rounded-full bg-kgc-primary text-white text-sm font-semibold">
              + 33 more
            </span>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="mt-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-kgc-text">
          Built for Trust
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {[
            { t: "Built on Indian AI", d: "Sarvam AI + Bhashini + AI4Bharat" },
            {
              t: "TNeGA Partnership",
              d: "Designed in alignment with Karnataka e-Governance Agency",
            },
            { t: "Fully Compliant", d: "DPDP Act 2023 + IT Act 2000" },
          ].map((t) => (
            <div key={t.t} className="glass rounded-2xl p-5 text-center lift">
              <div className="font-semibold text-kgc-text mt-2">{t.t}</div>
              <div className="text-xs text-kgc-muted mt-1">{t.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-16 pt-8 border-t border-white/60 text-center">
        <div className="flex justify-center">
          <Logo size={42} />
        </div>
        <div className="font-bold text-kgc-text mt-3">KGC</div>
        <div className="text-xs text-kgc-muted">{t("appTagline")}</div>
        <div className="text-[11px] text-kgc-muted mt-3">
          © 2026 KGC · Privacy · Terms · DPDP Act 2023
        </div>
      </footer>
    </div>
  );
}
