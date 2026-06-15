import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tngc/AppShell";
import { ChatPage } from "@/components/tngc/pages/ChatPage";

export const Route = createFileRoute("/")({
  component: () => (
    <AppShell>
      <ChatPage />
    </AppShell>
  ),
});
