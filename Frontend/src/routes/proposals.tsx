import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tngc/AppShell";
import { ProposalsPage } from "@/components/tngc/pages/ProposalsPage"; // Fixed: Forced TS language server re-parse

export const Route = createFileRoute("/proposals")({
  head: () => ({
    meta: [
      { title: "Public Proposals — KGC" },
      {
        name: "description",
        content: "Submit ideas for Karnataka's development. Community votes. Government listens.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ProposalsPage />
    </AppShell>
  ),
});
