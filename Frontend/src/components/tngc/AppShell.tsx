import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  MessageCircle,
  Home,
  Newspaper,
  Vote,
  LayoutDashboard,
  User as UserIcon,
  CheckCircle2,
  Menu,
  LogOut,
  KeyRound,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Plus,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { OnboardingModal } from "./OnboardingModal";
import { AuthModal } from "./AuthModal";
import { Logo } from "./Logo";
import { useLang } from "@/lib/language";
import { useAuth } from "@/hooks/useKGC";
import { toast } from "sonner";
import { kgcAPI, ChatSessionList } from "@/api/kgc";
import { AnimatePresence, motion } from "framer-motion";

type NavItem = {
  to: string;
  key:
    | "navChat"
    | "navHome"
    | "navNews"
    | "navPolling"
    | "navProposals"
    | "navDashboard"
    | "navProfile";
  icon: typeof Home;
  exact?: boolean;
};
const NAV: NavItem[] = [
  { to: "/", key: "navChat", icon: MessageCircle, exact: true },
  { to: "/home", key: "navHome", icon: Home },
  { to: "/news", key: "navNews", icon: Newspaper },
  { to: "/polling", key: "navPolling", icon: Vote },
  { to: "/proposals", key: "navProposals", icon: Lightbulb },
  { to: "/dashboard", key: "navDashboard", icon: LayoutDashboard },
  { to: "/profile", key: "navProfile", icon: UserIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { t } = useLang();

  const { user, isLoggedIn, isAdmin, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true);
  const [sessions, setSessions] = useState<ChatSessionList[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const loadSessions = async () => {
    if (isLoggedIn) {
      try {
        const data = await kgcAPI.chat.getSessions();
        setSessions(data);
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    loadSessions();
  }, [isLoggedIn]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  // Global window event listener to open login modal from other components
  useEffect(() => {
    const handleSessionsChanged = () => loadSessions();
    const handleSessionSelected = (e: any) => setActiveSessionId(e.detail);

    window.addEventListener("kgc-sessions-changed", handleSessionsChanged);
    window.addEventListener("kgc-session-selected", handleSessionSelected);

    return () => {
      window.removeEventListener("kgc-sessions-changed", handleSessionsChanged);
      window.removeEventListener("kgc-session-selected", handleSessionSelected);
    };
  }, [isLoggedIn]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  const isChat = pathname === "/";

  // Mobile bottom nav: exclude Chat, Profile, and Dashboard
  const BOTTOM_NAV = NAV.filter(
    (n) => n.to !== "/" && n.to !== "/profile" && n.to !== "/dashboard",
  );

  const initials = isLoggedIn ? (isAdmin ? "O" : "C") : "?";
  const displayName = isLoggedIn
    ? isAdmin
      ? "Officer Dashboard"
      : `Citizen (${user?.mobile?.slice(-4) || ""})`
    : "";

  const triggerLogin = () => {
    window.dispatchEvent(new Event("kgc-open-login"));
  };

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex sticky top-0 h-screen w-[260px] flex-col p-4 gap-2 shrink-0 bg-[#f9f9f9] border-r border-black/5">
        <Link to="/" className="flex items-center gap-3 px-2 py-3">
          <Logo size={32} />
          <div className="leading-tight">
            <div className="text-[18px] font-bold text-kgc-text">KGC</div>
            <div className="text-[11px] text-kgc-muted font-medium">{t("appTagline")}</div>
          </div>
        </Link>
        <div className="h-px bg-black/5 my-1" />
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;

            if (item.key === "navChat") {
              return (
                <div key={item.to} className="flex flex-col gap-1">
                  <div
                    className={`flex flex-col rounded-lg transition-all ${active ? "bg-white border border-black/5 shadow-sm" : ""}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <Link
                        to={item.to as never}
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("kgc-select-session", { detail: null }),
                          )
                        }
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium flex-1 ${!active ? "text-kgc-text hover:bg-black/5 rounded-lg" : "rounded-l-lg"}`}
                      >
                        <Icon size={18} />
                        <span>{t(item.key)}</span>
                      </Link>
                      <button
                        onClick={() => setChatExpanded(!chatExpanded)}
                        className={`p-2.5 rounded-r-lg ${active ? "hover:bg-black/5" : "text-kgc-text hover:bg-black/5"}`}
                      >
                        {chatExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Sub-menu (History) */}
                  <AnimatePresence>
                    {chatExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex flex-col gap-0.5 pl-9 pr-2 overflow-hidden mt-1 mb-2"
                      >
                        <button
                          onClick={() => {
                            navigate({ to: "/" });
                            window.dispatchEvent(
                              new CustomEvent("kgc-select-session", { detail: null }),
                            );
                          }}
                          className="flex items-center gap-2 text-left py-2 px-2 rounded-lg text-[13px] font-medium text-kgc-text hover:bg-black/5 transition"
                        >
                          <Plus size={14} /> New Chat
                        </button>

                        {sessions.length === 0 ? (
                          <div className="py-2 px-2 text-[10px] text-kgc-muted italic text-center mt-1">
                            History not available
                          </div>
                        ) : (
                          <div className="max-h-[180px] overflow-y-auto scrollbar-hide flex flex-col gap-0.5 mt-1">
                            {sessions.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  navigate({ to: "/" });
                                  window.dispatchEvent(
                                    new CustomEvent("kgc-select-session", { detail: s.id }),
                                  );
                                }}
                                className={`flex items-center gap-2 text-left py-2 px-2 rounded-lg text-[13px] truncate transition-all ${activeSessionId === s.id ? "bg-[#ebebeb] text-kgc-text font-medium" : "text-kgc-text hover:bg-black/5"}`}
                              >
                                <MessageSquare size={10} className="shrink-0" />
                                <span className="truncate">{s.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to as never}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-[#ebebeb] text-kgc-text font-medium"
                    : "text-kgc-text hover:bg-black/5"
                }`}
              >
                <Icon size={18} />
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Auth profile block */}
        <div className="mt-auto">
          {isLoggedIn ? (
            <div className="flex flex-col gap-1.5">
              <Link
                to="/profile"
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 transition"
              >
                <div className="w-9 h-9 rounded-full bg-[#e0e0e0] text-kgc-text grid place-items-center text-sm font-medium">
                  {initials}
                </div>
                <div className="leading-tight flex-1 min-w-0">
                  <div className="text-sm font-semibold text-kgc-text truncate">{displayName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-kgc-accent font-medium">
                    <CheckCircle2 size={12} /> {t("verified")}
                  </div>
                </div>
              </Link>
              <button
                onClick={logout}
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-xs font-semibold text-red-600 hover:bg-red-50/50 hover:text-red-700 transition"
              >
                <LogOut size={13} /> {t("signOut") || "Sign Out"}
              </button>
            </div>
          ) : (
            <button
              onClick={triggerLogin}
              className="flex items-center justify-center gap-2 w-full p-2.5 rounded-lg bg-[#212121] text-white hover:bg-[#333333] transition-all"
            >
              <KeyRound size={16} />
              <span className="text-sm font-medium">Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile floating hamburger menu */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="w-11 h-11 grid place-items-center rounded-2xl bg-white/70 backdrop-blur-md shadow-sm border border-black/10 text-kgc-text hover:bg-white/90 transition-all">
              <Menu size={22} />
            </button>
          </SheetTrigger>
          <SheetContent
            {...({ side: "left" } as any)}
            className="p-0 w-[280px] flex flex-col bg-white/95 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 px-4 py-4 border-b border-black/5">
              <Logo size={36} />
              <div className="leading-tight">
                <div className="text-[17px] font-bold text-kgc-text">KGC</div>
                <div className="text-[11px] text-kgc-muted">{t("appTagline")}</div>
              </div>
            </div>
            <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
              {NAV.map((item) => {
                const active = isActive(item.to, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to as never}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition-all ${
                      active
                        ? "bg-kgc-primary text-white"
                        : "text-kgc-muted hover:bg-black/5 hover:text-kgc-text"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{t(item.key)}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-black/5">
              {isLoggedIn ? (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-2xl hover:bg-black/5"
                  >
                    <div className="w-10 h-10 rounded-full bg-kgc-primary text-white grid place-items-center text-sm font-semibold">
                      {initials}
                    </div>
                    <div className="leading-tight flex-1 min-w-0">
                      <div className="text-sm font-semibold text-kgc-text truncate">
                        {displayName}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-kgc-accent font-medium">
                        <CheckCircle2 size={12} /> {t("verified")}
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                  >
                    <LogOut size={13} /> {t("signOut") || "Sign Out"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    triggerLogin();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-kgc-primary text-white text-sm font-semibold"
                >
                  <KeyRound size={15} /> Sign In
                </button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <main
        className={`flex-1 min-w-0 md:pt-0 ${isChat ? "pt-0" : "pt-20 pb-24"} md:pb-0 relative bg-white flex flex-col h-screen overflow-y-auto`}
      >
        <div className="flex-1 w-full mx-auto relative h-full flex flex-col">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="h-full w-full flex-1 flex flex-col"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile bottom nav — hidden on chat page */}
      {!isChat && (
        <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-white border border-[#e5e5e5] shadow-[0_2px_10px_rgba(0,0,0,0.1)] rounded-2xl px-2 py-2 flex items-center justify-around overflow-x-auto scrollbar-hide">
          {BOTTOM_NAV.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as never}
                activeOptions={{ exact: item.exact }}
                className={`group flex flex-col items-center gap-1 px-3 py-2 rounded-2xl shrink-0 transition-all duration-300 ${
                  active
                    ? "bg-kgc-primary/10 text-kgc-primary"
                    : "text-kgc-muted hover:bg-black/5 hover:text-kgc-text"
                }`}
              >
                <Icon
                  size={20}
                  className={active ? "text-kgc-primary" : "text-kgc-muted transition-colors"}
                />
                <span className={`text-[10px] font-semibold ${active ? "text-kgc-primary" : ""}`}>
                  {t(item.key)}
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      <AuthModal />
      <OnboardingModal />
    </div>
  );
}
