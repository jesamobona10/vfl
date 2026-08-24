import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://leagueforge.vercel.app"
  ),
  title: {
    default: "LeagueForge",
    template: "%s · LeagueForge",
  },
  description:
    "School Football League Management System — competitions, teams, players, fixtures, and live standings.",
  applicationName: "LeagueForge",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    type: "website",
    siteName: "LeagueForge",
    title: "LeagueForge",
    description:
      "School Football League Management System — competitions, teams, players, fixtures, and live standings.",
  },
  twitter: {
    card: "summary",
    title: "LeagueForge",
    description:
      "School Football League Management System — competitions, teams, players, fixtures, and live standings.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head />
      <body className="font-sans antialiased">
        <QueryProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
