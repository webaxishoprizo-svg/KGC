import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "kn";

type Dict = Record<string, { en: string; ta: string }>;

export const STRINGS = {
  appName: { en: "KGC", ta: "KGC" },
  appTagline: { en: "Karnataka Government Connect", ta: "தமிழ்நாடு அரசு இணைப்பு" },
  verified: { en: "Verified", ta: "சரிபார்க்கப்பட்டது" },

  // Nav
  navChat: { en: "Chat", ta: "அரட்டை" },
  navHome: { en: "Home", ta: "முகப்பு" },
  navNews: { en: "News", ta: "செய்திகள்" },
  navPolling: { en: "Polling", ta: "வாக்கெடுப்பு" },
  navProposals: { en: "Proposals", ta: "யோசனைகள்" },
  navDashboard: { en: "Dashboard", ta: "டாஷ்போர்டு" },
  navProfile: { en: "Profile", ta: "சுயவிவரம்" },

  // Chat
  chatTitle: { en: "KGC AI Assistant", ta: "KGC AI உதவியாளர்" },
  online: { en: "Online", ta: "ஆன்லைன்" },
  newChat: { en: "New Chat", ta: "புதிய உரையாடல்" },
  greeting: { en: "Hello", ta: "வணக்கம்" },
  greetingSub: { en: "How can I help you today?", ta: "இன்று நான் உங்களுக்கு எப்படி உதவலாம்?" },
  chatIntro: {
    en: "File a complaint, track your issue, or get government information.",
    ta: "புகார் பதிவு செய்யுங்கள், நிலையைக் கண்காணியுங்கள், அரசு தகவல்களைப் பெறுங்கள்.",
  },
  suggestWater: {
    en: "No water supply in Ward 12, Mangaluru for 3 days.",
    ta: "திருச்சி வார்டு 12-ல் 3 நாட்களாக குடிநீர் விநியோகம் இல்லை.",
  },
  suggestElectricity: {
    en: "Street light not working in Belagavi Main Road.",
    ta: "சேலம் மெயின் ரோட்டில் தெருவிளக்கு எரியவில்லை.",
  },
  suggestRoads: {
    en: "Huge pothole causing traffic near Hubballi Junction.",
    ta: "மதுரை ஜங்ஷன் அருகே பெரிய பள்ளம் போக்குவரத்தை பாதிக்கிறது.",
  },
  inputPlaceholder: { en: "Type your complaint.", ta: "உங்கள் புகாரை தட்டச்சு செய்யவும்." },
  dataNotice: {
    en: "Your data is encrypted and protected under TN Data Policy · KGC-2026",
    ta: "உங்கள் தரவு குறியாக்கம் செய்யப்பட்டு TN தரவுக் கொள்கையின் கீழ் பாதுகாக்கப்படுகிறது · KGC-2026",
  },

  // News
  newsTitle: {
    en: "Government News & Project Updates",
    ta: "அரசு செய்திகள் & திட்ட புதுப்பிப்புகள்",
  },
  searchAnnouncements: { en: "Search announcements…", ta: "அறிவிப்புகளைத் தேடுங்கள்…" },
  featured: { en: "FEATURED", ta: "சிறப்பு" },
  voteOnThis: { en: "Vote on This", ta: "வாக்களியுங்கள்" },
  views: { en: "views", ta: "பார்வைகள்" },
  comments: { en: "comments", ta: "கருத்துகள்" },

  // Polling & Proposals
  proposalsTitle: { en: "Citizen Proposals", ta: "மக்கள் யோசனைகள்" },
  pollingTitle: { en: "Public Polling", ta: "பொது வாக்கெடுப்பு" },
  pollingIntro: {
    en: "Vote on government projects before they are built. Your voice shapes Karnataka.",
    ta: "திட்டங்கள் தொடங்குவதற்கு முன் வாக்களியுங்கள். உங்கள் குரல் தமிழ்நாட்டை வடிவமைக்கிறது.",
  },
  recentlyClosed: { en: "Recently Closed", ta: "சமீபத்தில் முடிந்தவை" },
  support: { en: "Support", ta: "ஆதரவு" },
  oppose: { en: "Oppose", ta: "எதிர்ப்பு" },
  modify: { en: "Modify", ta: "மாற்று" },
  neutral: { en: "Neutral", ta: "நடுநிலை" },

  // Profile
  settings: { en: "Settings", ta: "அமைப்புகள்" },
  languagePref: { en: "Language Preference", ta: "மொழி விருப்பம்" },
  languageHelp: {
    en: "Choose how content is shown across KGC.",
    ta: "KGC முழுவதும் உள்ளடக்கம் காட்டப்படும் முறையைத் தேர்ந்தெடுக்கவும்.",
  },
  english: { en: "English", ta: "English" },
  kannada: { en: "தமிழ்", ta: "தமிழ்" },
  signOut: { en: "Sign Out", ta: "வெளியேறு" },
} satisfies Dict;

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof STRINGS) => string;
};

const LangCtx = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kgc.lang");
      if (saved === "en" || saved === "kn") setLangState(saved);
    } catch {}
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try {
      localStorage.setItem("kgc.lang", l);
    } catch {}
  }

  function t(key: keyof typeof STRINGS) {
    return STRINGS[key][lang];
  }

  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
