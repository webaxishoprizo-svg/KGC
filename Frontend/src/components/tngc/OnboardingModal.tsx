import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useKGC";
import { kgcAPI, tokenStore } from "@/api/kgc";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

export function OnboardingModal() {
  const { user, isLoggedIn } = useAuth();

  // We need to show this if the user is logged in but NOT onboarded
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    address: "",
    mobile: "",
  });

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("kgc-open-onboarding", handleOpen);

    // Also check on mount/user change
    if (isLoggedIn && user && user.is_onboarded === false) {
      setOpen(true);
    } else {
      setOpen(false);
    }

    return () => window.removeEventListener("kgc-open-onboarding", handleOpen);
  }, [user, isLoggedIn]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGenderChange = (value: string) => {
    setFormData((prev) => ({ ...prev, gender: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.name ||
      !formData.age ||
      !formData.gender ||
      !formData.address ||
      !formData.mobile
    ) {
      toast.error("Please fill out all fields.");
      return;
    }
    if (formData.mobile.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    try {
      await kgcAPI.auth.onboard({
        name: formData.name,
        age: parseInt(formData.age, 10),
        gender: formData.gender,
        address: formData.address,
        mobile: formData.mobile,
      });

      toast.success("Profile completed successfully!");
      setOpen(false);

      // Update local storage and force a reload to reflect name and onboarded status
      const currentUser = tokenStore.getUser();
      if (currentUser) {
        tokenStore.setUser({
          ...currentUser,
          is_onboarded: true,
        });
      }
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Prevent closing if they aren't onboarded
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && (!user || user.is_onboarded === false)) {
      toast.error("Please complete your profile to continue.");
      return;
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border border-[#e5e5e5] shadow-xl rounded-3xl bg-white">
        <div className="bg-gradient-to-br from-kgc-primary to-kgc-primary/80 p-6 text-white">
          <DialogHeader className="mb-0">
            <DialogTitle className="text-2xl font-bold">Welcome to KGC</DialogTitle>
            <DialogDescription className="text-white/80">
              We're glad to have you! Please complete your profile to access all features.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-6 bg-white">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold text-kgc-text">
                Full Name
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                className="rounded-xl border-black/10 focus-visible:ring-kgc-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age" className="text-sm font-semibold text-kgc-text">
                  Age
                </Label>
                <Input
                  id="age"
                  name="age"
                  type="number"
                  placeholder="25"
                  value={formData.age}
                  onChange={handleChange}
                  className="rounded-xl border-black/10 focus-visible:ring-kgc-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender" className="text-sm font-semibold text-kgc-text">
                  Gender
                </Label>
                <Select value={formData.gender} onValueChange={handleGenderChange}>
                  <SelectTrigger className="rounded-xl border-black/10 focus:ring-kgc-primary">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-semibold text-kgc-text">
                Residential Address
              </Label>
              <Textarea
                id="address"
                name="address"
                placeholder="123, Anna Salai, Bengaluru"
                value={formData.address}
                onChange={handleChange}
                className="resize-none rounded-xl border-black/10 focus-visible:ring-kgc-primary"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile" className="text-sm font-semibold text-kgc-text">
                Mobile Number (10 Digits)
              </Label>
              <div className="flex rounded-xl overflow-hidden border border-black/10 focus-within:ring-2 focus-within:ring-kgc-primary">
                <div className="bg-slate-50 px-3 py-2 flex items-center justify-center border-r border-black/10 text-slate-500 font-medium text-sm">
                  +91
                </div>
                <input
                  type="tel"
                  id="mobile"
                  name="mobile"
                  placeholder="9999999999"
                  value={formData.mobile}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                    }))
                  }
                  className="flex-1 px-3 py-2 outline-none text-sm"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="submit"
                disabled={loading || formData.mobile.length !== 10}
                className="w-full flex items-center justify-center rounded-xl bg-kgc-primary hover:bg-kgc-primary/90 text-white font-semibold py-6 shadow-lg hover:shadow-xl transition-all"
              >
                {loading && <Loader2 className="animate-spin mr-2" size={18} />}
                Complete Profile
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
