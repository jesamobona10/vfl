import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/public-manifest.json",
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
