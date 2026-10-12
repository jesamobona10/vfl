import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/public-manifest.json",
  title: "Live Fixtures & Scores",
  description:
    "Follow live football match scores and updates across school leagues without an account.",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
