import type { Metadata } from "next";
import { LiveFeed } from "./live-feed";

export const metadata: Metadata = {
  title: "Live Scores — VUNA Football League",
  description: "Live and upcoming match scores for the VUNA Football League.",
};

export default function LivePage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-8">
      <LiveFeed />
    </main>
  );
}
