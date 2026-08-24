"use client";

import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import type { Match, Team } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { useCompetition } from "@/lib/hooks/use-competitions";
import { CalendarClock } from "lucide-react";

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
    background: rgba(0,0,0,0.5);
    overflow-y: auto;
    padding: 24px 16px;
  }
  .flyer-card {
    width: 390px;
    max-width: 100%;
    margin: auto;
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    font-family: system-ui, -apple-system, sans-serif;
  }
  .flyer-header {
    background: linear-gradient(135deg, var(--brand-dark), var(--brand));
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
    background: var(--brand-50);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 700;
    color: var(--brand);
  }
  .flyer-team-name {
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    color: var(--ink);
  }
  .flyer-vs {
    font-size: 20px;
    font-weight: 800;
    color: var(--ink-3);
  }
  .flyer-details {
    padding: 20px 32px 32px;
    text-align: center;
  }
  .flyer-divider {
    width: 80px;
    height: 2px;
    background: var(--line);
    margin: 0 auto 16px;
  }
  .flyer-date {
    font-size: 15px;
    font-weight: 600;
    color: var(--ink);
  }
  .flyer-time {
    font-size: 13px;
    color: var(--ink-2);
    margin-top: 4px;
  }
  .flyer-venue {
    font-size: 13px;
    color: var(--ink-3);
    margin-top: 4px;
  }
  .flyer-custom {
    position: relative;
    width: 390px;
    min-height: 520px;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .flyer-custom-body {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
    gap: 12px;
    color: var(--flyer-text, #ffffff);
  }
  .flyer-custom-teams {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
    width: 100%;
  }
  .flyer-custom-team {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 130px;
  }
  .flyer-custom-team-name {
    font-size: 16px;
    font-weight: 800;
    text-align: center;
    color: var(--flyer-text, #ffffff);
  }
  .flyer-custom-vs {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 0.05em;
    color: var(--flyer-text, #ffffff);
  }
  .flyer-custom-details {
    text-align: center;
    margin-top: 8px;
  }
  .flyer-custom-date {
    font-size: 16px;
    font-weight: 700;
    color: var(--flyer-text, #ffffff);
  }
  .flyer-custom-time {
    font-size: 14px;
    margin-top: 4px;
    color: var(--flyer-text, #ffffff);
  }
  .flyer-custom-venue {
    font-size: 14px;
    margin-top: 4px;
    color: var(--flyer-text, #ffffff);
    opacity: 0.9;
  }
`;

const FIXED_VENUE = "School Stadium";

export function MatchFlyer({ match, homeTeam, awayTeam, onClose }: MatchFlyerProps) {
  const flyerRef = useRef<HTMLDivElement>(null);
  const [capturing, setCapturing] = useState(false);
  const [date, setDate] = useState(match.date || "");
  const [time, setTime] = useState(match.time || "");
  const [venue, setVenue] = useState(match.venue || FIXED_VENUE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(match.date && match.time));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = useAppStore((s) => s.isAdmin);
  const userProfile = useAppStore((s) => s.userProfile);
  const updateMatch = useAppStore((s) => s.updateMatch);

  const { data: competition } = useCompetition(match.competition_id || undefined);
  const flyerSettings = (() => {
    const s = (
      competition?.settings && typeof competition.settings === "object" ? competition.settings : {}
    ) as Record<string, unknown>;
    const f = (s.flyer && typeof s.flyer === "object" ? s.flyer : {}) as Record<string, unknown>;
    return f;
  })();
  const customBg =
    typeof flyerSettings.background_url === "string" && flyerSettings.background_url
      ? flyerSettings.background_url
      : null;
  const customTextColor =
    typeof flyerSettings.text_color === "string" && flyerSettings.text_color
      ? flyerSettings.text_color
      : "#ffffff";

  const canEdit = isAdmin || userProfile?.role === "org_admin";
  const hasSchedule = Boolean(date && time);
  const downloadDisabled = capturing || !hasSchedule || !saved || saving;

  const handleDateChange = (value: string) => {
    setDate(value);
    setDirty(true);
    setSaved(false);
    setError("");
  };

  const handleTimeChange = (value: string) => {
    setTime(value);
    setDirty(true);
    setSaved(false);
    setError("");
  };

  const handleSave = async () => {
    if (!date || !time) {
      setError("Both date and time are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/fixtures/${match.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time, venue: FIXED_VENUE }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Unable to save.");
        return;
      }
      updateMatch(match.id, "date", date);
      updateMatch(match.id, "time", time);
      updateMatch(match.id, "venue", FIXED_VENUE);
      setVenue(FIXED_VENUE);
      setSaved(true);
      setDirty(false);
    } catch {
      setError("Unable to save. Check your connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    if (!flyerRef.current || !hasSchedule || !saved) return;
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
    <div
      className="flyer-container"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{INITIALS_CSS}</style>
      <div className="flyer-card">
        <div ref={flyerRef}>
          {customBg ? (
            <div
              className="flyer-custom"
              style={{
                backgroundImage: `url(${customBg})`,
                ["--flyer-text" as string]: customTextColor,
              }}
            >
              <div className="flyer-custom-body">
                <div className="flyer-custom-teams">
                  <div className="flyer-custom-team">
                    {homeTeam?.logo_url ? (
                      <img
                        src={homeTeam.logo_url}
                        alt=""
                        className="flyer-logo"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="flyer-logo-fallback">{homeTeam?.name?.charAt(0) || "?"}</div>
                    )}
                    <div className="flyer-custom-team-name">{homeTeam?.name || "Home"}</div>
                  </div>

                  <div className="flyer-custom-vs">VS</div>

                  <div className="flyer-custom-team">
                    {awayTeam?.logo_url ? (
                      <img
                        src={awayTeam.logo_url}
                        alt=""
                        className="flyer-logo"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="flyer-logo-fallback">{awayTeam?.name?.charAt(0) || "?"}</div>
                    )}
                    <div className="flyer-custom-team-name">{awayTeam?.name || "Away"}</div>
                  </div>
                </div>

                <div className="flyer-custom-details">
                  <div className="flyer-custom-date">{date ? formatDate(date) : "Date TBD"}</div>
                  <div className="flyer-custom-time">{time || "Time TBD"}</div>
                  <div className="flyer-custom-venue">{venue || FIXED_VENUE}</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flyer-header">
                <h2>Match Day</h2>
              </div>

              <div className="flyer-teams">
                <div className="flyer-team">
                  {homeTeam?.logo_url ? (
                    <img
                      src={homeTeam.logo_url}
                      alt=""
                      className="flyer-logo"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flyer-logo-fallback">{homeTeam?.name?.charAt(0) || "?"}</div>
                  )}
                  <div className="flyer-team-name">{homeTeam?.name || "Home"}</div>
                </div>

                <div className="flyer-vs">VS</div>

                <div className="flyer-team">
                  {awayTeam?.logo_url ? (
                    <img
                      src={awayTeam.logo_url}
                      alt=""
                      className="flyer-logo"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="flyer-logo-fallback">{awayTeam?.name?.charAt(0) || "?"}</div>
                  )}
                  <div className="flyer-team-name">{awayTeam?.name || "Away"}</div>
                </div>
              </div>

              <div className="flyer-details">
                <div className="flyer-divider" />
                <div className="flyer-date">{date ? formatDate(date) : "Date TBD"}</div>
                <div className="flyer-time">{time || "Time TBD"}</div>
                <div className="flyer-venue">{venue || FIXED_VENUE}</div>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: "0 32px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: "var(--ink-2)",
              fontWeight: 600,
            }}
          >
            <CalendarClock size={15} />
            Match Date &amp; Time
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              disabled={!canEdit}
              className="input flex-1 text-sm py-1.5"
              aria-label="Match date"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              disabled={!canEdit}
              className="input flex-1 text-sm py-1.5"
              aria-label="Match time"
            />
          </div>
          <input
            type="text"
            value={venue}
            onChange={() => {}}
            disabled
            className="input w-full text-sm py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Match venue"
          />
          <p style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -6 }}>
            Venue is fixed and cannot be changed.
          </p>
          {canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={saving || (!dirty && saved)}
                className="btn-secondary flex-1 justify-center text-sm py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    {" "}
                    <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> Saving...
                  </>
                ) : saved && !dirty ? (
                  "Saved"
                ) : (
                  "Save Date & Time"
                )}
              </button>
            </div>
          )}
          {error && <p style={{ fontSize: 12, color: "var(--danger-500)" }}>{error}</p>}
          {!canEdit && !hasSchedule && (
            <p style={{ fontSize: 12, color: "var(--warn-500)" }}>
              Date and time must be set by an admin before this flyer can be downloaded.
            </p>
          )}
          {canEdit && hasSchedule && saved && !dirty && (
            <p style={{ fontSize: 12, color: "var(--brand-600)" }}>
              Schedule saved to the database.
            </p>
          )}
          {canEdit && (!hasSchedule || dirty) && (
            <p style={{ fontSize: 12, color: "var(--warn-500)" }}>
              Save the date and time before downloading the flyer.
            </p>
          )}
        </div>

        <div style={{ padding: "0 32px 24px", display: "flex", gap: 8 }}>
          <button
            onClick={handleDownload}
            disabled={downloadDisabled}
            className="btn-primary flex-1 justify-center text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {capturing ? (
              <>
                {" "}
                <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> Generating...
              </>
            ) : hasSchedule && saved ? (
              "Download Flyer"
            ) : (
              "Save Date & Time to Download"
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
