import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tngc/AppShell";
import { ProfilePage } from "@/components/tngc/pages/ProfilePage";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Verification — KGC" },
      {
        name: "description",
        content: "Manage your KGC profile, Aadhaar verification, and privacy.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ProfilePage />
    </AppShell>
  ),
});
