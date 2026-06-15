import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tngc/AppShell";
import { DashboardPage } from "@/components/tngc/pages/DashboardPage";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — KGC" },
      { name: "description", content: "Your complaints, votes, proposals, and notifications." },
    ],
  }),
  component: () => (
    <AppShell>
      <DashboardPage />
    </AppShell>
  ),
});
