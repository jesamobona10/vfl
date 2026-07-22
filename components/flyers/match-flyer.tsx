"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import type { Match, Team } from "@/lib/types";


interface MatchFlyerProps {
  match: Match;
  homeTeam: Team | undefined;
  awayTeam: Team | undefined;
  onClose: () => void;
}

const INITIALS_CSS = `
  .flyer-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.5);
  }
  .flyer-card {
    width: 390px;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    font-family: system-ui, -apple-system, sans-serif;
  }
  .flyer-header {
    background: linear-gradient(135deg, #0a5d34, #0f7c45);
    padding: 32px;
    text-align: center;
    color: white;
  }
  .flyer-header h2 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0.8;
  }
  .flyer-teams {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 20px 32px 0;
  }
  .flyer-team {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 120px;
  }
  .flyer-logo {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    object-fit: contain;
    background: rgba(255,255,255,0.15);
  }
  .flyer-logo-fallback {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    background: #e8f5e9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 700;
    color: #0f7c45;
  }
  .flyer-team-name {
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    color: #111;
  }
  .flyer-vs {
    font-size: 20px;
    font-weight: 800;
    color: #ccc;
  }
  .flyer-details {
    padding: 20px 32px 32px;
    text-align: center;
  }
  .flyer-divider {
    width: 80px;
    height: 2px;
    background: #e0e0e0;
    margin: 0 auto 16px;
  }
  .flyer-date {
    font-size: 15px;
    font-weight: 600;
    color: #333;
  }
  .flyer-time {
    font-size: 13px;
    color: #666;
    margin-top: 4px;
  }
  .flyer-venue {
    font-size: 13px;
    color: #888;
    margin-top: 4px;
  }
`;

export function MatchFlyer({ match, homeTeam, awayTeam, onClose }: MatchFlyerProps) {
  const flyerRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);

  const handleDownload = async () => {
    if (!flyerRef.current) return;
    setCapturing(true);
    try {
      const canvas = await html2canvas(flyerRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        allowTaint: true,
      });
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flyer-${match.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Flyer capture failed", e);
    } finally {
      setCapturing(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "TBD";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="flyer-container" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{INITIALS_CSS}</style>
      <div className="flyer-card">
        <div ref={flyerRef}>
          <div className="flyer-header">
            <h2>Match Day</h2>
          </div>

          <div className="flyer-teams">
            <div className="flyer-team">
              {homeTeam?.logo_url ? (
                <img src={homeTeam.logo_url} alt="" className="flyer-logo" crossOrigin="anonymous" />
              ) : (
                <div className="flyer-logo-fallback">
                  {homeTeam?.name?.charAt(0) || "?"}
                </div>
              )}
              <div className="flyer-team-name">{homeTeam?.name || "Home"}</div>
            </div>

            <div className="flyer-vs">VS</div>

            <div className="flyer-team">
              {awayTeam?.logo_url ? (
                <img src={awayTeam.logo_url} alt="" className="flyer-logo" crossOrigin="anonymous" />
              ) : (
                <div className="flyer-logo-fallback">
                  {awayTeam?.name?.charAt(0) || "?"}
                </div>
              )}
              <div className="flyer-team-name">{awayTeam?.name || "Away"}</div>
            </div>
          </div>

          <div className="flyer-details">
            <div className="flyer-divider" />
            <div className="flyer-date">{formatDate(match.date)}</div>
            <div className="flyer-time">{match.time || "Time TBD"}</div>
            <div className="flyer-venue">{match.venue || "Venue TBD"}</div>
          </div>
        </div>

        <div style={{ padding: "0 32px 24px", display: "flex", gap: 8 }}>
          <button
            onClick={handleDownload}
            disabled={capturing}
            className="btn-primary flex-1 justify-center text-sm"
          >
            {capturing ? (
              <> <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> Generating...</>
            ) : (
              "Download Flyer"
            )}
          </button>
          <button onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
