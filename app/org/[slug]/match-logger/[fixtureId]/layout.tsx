import { Barlow_Condensed } from "next/font/google";
import styles from "@/components/match-logger/match-logger.module.css";

const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-ml-display",
  display: "swap",
});

/**
 * Focus wrapper for the Match Logger. Applies the logger's own design tokens
 * and condensed display font, and gives the screen a full-height dark canvas
 * that is independent of the app theme.
 */
export default function MatchLoggerFocusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`${styles.root} ${barlow.variable}`}>{children}</div>;
}
