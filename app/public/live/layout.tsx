import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Live Match",
};

export default function PublicLiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}