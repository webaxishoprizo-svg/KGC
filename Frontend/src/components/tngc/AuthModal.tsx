import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useKGC";
import { kgcAPI } from "@/api/kgc";
import { toast } from "sonner";
import { Loader2, Mail, Smartphone, ArrowRight } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";

export function AuthModal() {
  const [open, setOpen] = useState(false);
  const { isLoggedIn } = useAuth();
  const [activeTab, setActiveTab] = useState("google");

  useEffect(() => {
    const handleOpenLogin = () => setOpen(true);
    window.addEventListener("kgc-open-login", handleOpenLogin);
    return () => window.removeEventListener("kgc-open-login", handleOpenLogin);
  }, []);

  useEffect(() => {
    if (isLoggedIn) setOpen(false);
  }, [isLoggedIn]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md w-[90vw] p-0 overflow-hidden border border-[#e5e5e5] shadow-xl rounded-3xl bg-white">
        <div className="bg-gradient-to-br from-kgc-primary to-kgc-primary/80 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Welcome to KGC</DialogTitle>
            <DialogDescription className="text-white/80">
              Sign in to participate in grievance resolution and voting.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 bg-white">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/50">
              <TabsTrigger
                value="google"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Google
              </TabsTrigger>
              <TabsTrigger
                value="email"
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                Email
              </TabsTrigger>
            </TabsList>

            <TabsContent value="google" className="mt-0">
              <div className="flex flex-col items-center justify-center py-6 gap-6">
                <div className="text-sm text-center text-slate-500 mb-2">
                  Fastest way to get started. No password to remember.
                </div>
                <div className="flex justify-center w-full">
                  <GoogleLogin
                    onSuccess={async (credentialResponse) => {
                      try {
                        if (!credentialResponse.credential) throw new Error("No credential");
                        const res = await kgcAPI.auth.loginWithGoogle(
                          credentialResponse.credential,
                        );
                        toast.success("Signed in successfully!");
                        if (res.is_new_user || !res.is_onboarded) {
                          window.dispatchEvent(new Event("kgc-open-onboarding"));
                        } else {
                          window.dispatchEvent(new Event("kgc-auth-changed"));
                        }
                        setOpen(false);
                      } catch (err: any) {
                        toast.error(err.message || "Failed to sign in with Google");
                      }
                    }}
                    onError={() => {
                      toast.error("Google login failed");
                    }}
                    useOneTap
                    theme="filled_blue"
                    shape="pill"
                    text="continue_with"
                    width="280"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="email" className="mt-0">
              <EmailAuthForm onSuccess={() => setOpen(false)} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmailAuthForm({ onSuccess }: { onSuccess: () => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegister && !name)) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await kgcAPI.auth.registerWithEmail(email, password, name);
      } else {
        res = await kgcAPI.auth.loginWithEmail(email, password);
      }
      toast.success("Signed in successfully!");
      if (res.is_new_user || !res.is_onboarded) {
        window.dispatchEvent(new Event("kgc-open-onboarding"));
      } else {
        window.dispatchEvent(new Event("kgc-auth-changed"));
      }
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isRegister && (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 uppercase">Full Name</label>
          <Input
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 uppercase">Email Address</label>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 uppercase">Password</label>
        <Input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full mt-2 bg-kgc-primary hover:bg-kgc-primary/90 text-white rounded-xl h-11"
      >
        {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
        {isRegister ? "Create Account" : "Sign In"}
      </Button>

      <div className="text-center mt-2">
        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          className="text-sm text-kgc-primary hover:underline font-medium"
        >
          {isRegister ? "Already have an account? Sign In" : "Don't have an account? Register"}
        </button>
      </div>
    </form>
  );
}
