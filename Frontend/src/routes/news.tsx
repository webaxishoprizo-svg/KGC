import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tngc/AppShell";
import { NewsPage } from "@/components/tngc/pages/NewsPage";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Government News — KGC" },
      {
        name: "description",
        content: "Latest project announcements from Karnataka government departments.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <NewsPage />
    </AppShell>
  ),
});
