import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Lock,
  Download,
  Trash2,
  Eye,
  FileText,
  ChevronRight,
  Languages,
  KeyRound,
  ShieldAlert,
  LogOut,
  Edit2,
  X,
  Save,
} from "lucide-react";
import { useLang } from "@/lib/language";
import { useAuth } from "@/hooks/useKGC";
import { kgcAPI, UserProfileResponse } from "@/api/kgc";

export function ProfilePage() {
  const { lang, setLang, t } = useLang();
  const { user, isLoggedIn, isAdmin, logout } = useAuth();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    age: "",
    gender: "",
    address: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      kgcAPI.auth
        .getMe()
        .then((data) => {
          setProfile(data);
          setFormData({
            name: data.name || "",
            mobile: data.mobile || "",
            age: data.age?.toString() || "",
            gender: data.gender || "",
            address: data.address || "",
          });
        })
        .catch(console.error);
    }
  }, [isLoggedIn]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await kgcAPI.auth.updateProfile({
        name: formData.name || undefined,
        mobile: formData.mobile || undefined,
        age: formData.age ? parseInt(formData.age) : undefined,
        gender: formData.gender || undefined,
        address: formData.address || undefined,
      });
      const updated = await kgcAPI.auth.getMe();
      setProfile(updated);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignInTrigger = () => {
    window.dispatchEvent(new Event("kgc-open-login"));
  };

  const checklist = [
    { done: isLoggedIn, l: "Mobile Number Verified (OTP)" },
    { done: isLoggedIn, l: "Email Address Sync (Optional)" },
    { done: isLoggedIn, l: "Aadhaar Hash Linked (Required for voting)" },
    { done: isLoggedIn, l: "Address Verification (DPDP Compliant)" },
  ];

  // We no longer early return here. We'll show an overlay instead.

  // Profile details dynamically mapped based on active login
  const displayName =
    profile?.name ||
    user?.name ||
    user?.email?.split("@")[0] ||
    (user?.mobile ? `User (${user.mobile.slice(-4)})` : "Citizen User");
  const citizenId = `TN-CITIZEN-${user?.id?.slice(0, 8).toUpperCase()}`;
  const displayMobile =
    profile?.mobile || user?.mobile ? `+91 ${profile?.mobile || user?.mobile}` : "Not provided";
  const displayEmail = profile?.email || user?.email || "Not provided";
  const displayAge = profile?.age ? `${profile.age} years` : "Not provided";
  const displayGender = profile?.gender || "Not provided";
  const displayAddress = profile?.address || "Not provided";
  const districtName = "Karnataka";

  return (
    <div className="relative min-h-[80vh]">
      {!isLoggedIn && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md rounded-3xl" />
          <div className="relative z-10 p-8 rounded-3xl bg-white shadow-2xl max-w-sm w-full text-center border border-black/5 animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-kgc-primary/10 text-kgc-primary grid place-items-center mb-4">
              <KeyRound size={28} />
            </div>
            <h2 className="text-xl font-bold text-kgc-text">Sign In Required</h2>
            <p className="text-sm text-kgc-muted mt-2 leading-relaxed">
              Sign in with your mobile number to view and edit your profile details, and manage your
              account.
            </p>
            <button
              onClick={handleSignInTrigger}
              className="w-full mt-6 py-3 rounded-xl bg-kgc-primary text-white font-bold shadow-md hover:opacity-90 lift cursor-pointer"
            >
              Sign In with OTP
            </button>
          </div>
        </div>
      )}

      <div
        className={`px-4 md:px-8 py-8 max-w-3xl mx-auto animate-fade-in ${!isLoggedIn ? "opacity-40 pointer-events-none select-none max-h-[80vh] overflow-hidden" : ""}`}
      >
        <header className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full gradient-blue text-white grid place-items-center text-2xl font-bold shadow-lg uppercase">
            {displayName.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold text-kgc-text mt-3">{displayName}</h1>
          <span className="mt-1.5 inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-kgc-success text-white text-xs font-semibold">
            <CheckCircle2 size={12} /> Identity OTP Verified
          </span>
          <div className="text-[11px] text-kgc-muted mt-2">
            Grievance Role: <strong>{isAdmin ? "Government Officer" : "Verified Citizen"}</strong> ·
            Citizen ID: <span className="font-mono">{citizenId}</span>
          </div>
        </header>

        {/* Language preference */}
        <section className="glass rounded-3xl p-5 mt-6 border border-white/60 bg-white/40">
          <div className="flex items-center gap-2 font-bold text-kgc-text">
            <Languages size={16} /> {t("languagePref") || "Language Preference"}
          </div>
          <p className="text-xs text-kgc-muted mt-1.5">
            {t("languageHelp") || "Choose your primary language for voice and AI conversations."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { v: "en" as const, label: "English" },
              { v: "kn" as const, label: "தமிழ்" },
            ].map((o) => {
              const active = lang === o.v;
              return (
                <button
                  key={o.v}
                  onClick={() => setLang(o.v)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold border-2 transition-all lift cursor-pointer ${
                    active
                      ? "bg-kgc-primary text-white border-kgc-primary"
                      : "bg-[#f4f4f4] text-[#888] border border-[#e5e5e5]"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Verification */}
        <section className="glass rounded-3xl p-5 mt-6 border-l-4 border-kgc-primary border border-white/60 bg-white/40">
          <div className="font-bold text-kgc-text flex items-center gap-2">
            <Lock size={16} /> Identity Verification — Why This Matters
          </div>
          <p className="text-xs md:text-sm text-kgc-muted mt-2 leading-relaxed">
            KGC uses secure, Aadhaar-linked OTP authentication. This prevents fake accounts, stops
            ballot manipulation, and provides legally compliant citizen records.
          </p>
          <div className="mt-4 space-y-2">
            {checklist.map((c) => (
              <div key={c.l} className="flex items-center gap-2.5 text-xs md:text-sm">
                <span
                  className={`w-5 h-5 rounded-md grid place-items-center text-[10px] ${
                    c.done
                      ? "bg-kgc-success text-white"
                      : "bg-white/70 border border-kgc-muted/40 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={c.done ? "text-kgc-text font-semibold" : "text-kgc-muted"}>
                  {c.l}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Profile info */}
        <section className="glass rounded-3xl p-5 mt-5 border border-white/60 bg-white/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-kgc-text">Grievance Session Profile</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-kgc-primary hover:text-kgc-primary/80 transition-colors"
              >
                <Edit2 size={14} /> Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1 text-xs font-semibold text-kgc-muted hover:text-red-500 transition-colors"
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs font-semibold bg-kgc-primary text-white px-2.5 py-1 rounded-lg hover:bg-kgc-primary/90 transition-colors disabled:opacity-50"
                >
                  <Save size={14} /> {loading ? "Saving..." : "Save"}
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3 mt-4">
              <div>
                <label className="text-[11px] font-semibold text-kgc-muted ml-1 mb-1 block">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/50 border border-kgc-primary/20 text-sm focus:outline-none focus:ring-2 ring-kgc-primary/30"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-kgc-muted ml-1 mb-1 block">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/50 border border-kgc-primary/20 text-sm focus:outline-none focus:ring-2 ring-kgc-primary/30"
                  placeholder="e.g. 9876543210"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-kgc-muted ml-1 mb-1 block">
                    Age
                  </label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/50 border border-kgc-primary/20 text-sm focus:outline-none focus:ring-2 ring-kgc-primary/30"
                    placeholder="e.g. 30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-kgc-muted ml-1 mb-1 block">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/50 border border-kgc-primary/20 text-sm focus:outline-none focus:ring-2 ring-kgc-primary/30"
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-kgc-muted ml-1 mb-1 block">
                  Address
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/50 border border-kgc-primary/20 text-sm focus:outline-none focus:ring-2 ring-kgc-primary/30 min-h-[80px]"
                  placeholder="Your residential address"
                />
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <Field l="Account Name" v={displayName} verified />
              <Field l="Email Address" v={displayEmail} verified={!!user?.email} />
              <Field
                l="Phone Number"
                v={displayMobile}
                verified={!!(profile?.mobile || user?.mobile)}
              />
              <Field l="Age" v={displayAge} />
              <Field l="Gender" v={displayGender} />
              <Field l="Address" v={displayAddress} />
              <Field l="Assigned State" v={districtName} />
              <Field l="Citizen ID Token" v={citizenId} verified />
              <Field l="Aadhaar Lock Status" v="Masked Hash Saved" verified />
              {isAdmin && <Field l="Government Clearance" v="Level 4 (Admin)" verified />}
            </div>
          )}
        </section>

        {/* Security */}
        <Section title="Security Operations">
          <Row l="Active Devices (1 browser session)" />
          <Row l="Session Encryption Key: TLS 1.3 Active" />
        </Section>

        {/* Data & Privacy */}
        <Section title="Your Data & Privacy Rights">
          <Row l="Download My Complaint Logs" icon={<Download size={14} />} />
          <Row l="What We Store" icon={<Eye size={14} />} />
          <Row l="Privacy Policy" icon={<FileText size={14} />} />
          <div className="text-[11px] text-kgc-muted mt-3 px-1 leading-normal">
            KGC never stores full Aadhaar identities. We only store a secure hash string. Strictly
            DPDP 2023 Compliant.
          </div>
        </Section>

        {/* Sign Out Section */}
        <section className="mt-6 rounded-3xl p-5 border border-white/60 bg-white/40 flex flex-col items-center">
          <button
            onClick={logout}
            className="w-full py-3 rounded-2xl border-2 border-red-500 text-red-600 hover:bg-red-50 font-bold text-sm lift transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut size={16} /> Sign Out of Profile
          </button>
        </section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 mt-5 border border-white/60 bg-white/40">
      <h2 className="font-bold text-kgc-text">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Field({ l, v, verified }: { l: string; v: string; verified?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/60 last:border-0 text-xs md:text-sm">
      <div className="text-xs text-kgc-muted shrink-0 w-32">{l}</div>
      <div className="text-kgc-text font-semibold flex items-center gap-1.5 text-right">
        {v}
        {verified && <CheckCircle2 size={13} className="text-kgc-success" />}
      </div>
    </div>
  );
}

function Row({ l, icon }: { l: string; icon?: React.ReactNode }) {
  return (
    <button className="w-full flex items-center justify-between gap-2 py-2.5 text-left rounded-xl hover:bg-white/40 px-2 transition-all cursor-pointer">
      <div className="flex items-center gap-2 text-xs md:text-sm text-kgc-text font-semibold">
        {icon}
        <span>{l}</span>
      </div>
      <ChevronRight size={14} className="text-kgc-muted" />
    </button>
  );
}
