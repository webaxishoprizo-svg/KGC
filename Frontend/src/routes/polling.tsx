import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tngc/AppShell";
import { PollingPage } from "@/components/tngc/pages/PollingPage";

export const Route = createFileRoute("/polling")({
  head: () => ({
    meta: [
      { title: "Public Polling — KGC" },
      {
        name: "description",
        content: "Vote on Karnataka government projects before they are built.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PollingPage />
    </AppShell>
  ),
});
