import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tngc/AppShell";
import { HomePage } from "@/components/tngc/pages/HomePage";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "About KGC — Karnataka Government Connect" },
      {
        name: "description",
        content: "How KGC connects 77 million citizens to 43 Karnataka government departments.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <HomePage />
    </AppShell>
  ),
});
