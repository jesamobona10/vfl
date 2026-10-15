"use client";

import type { CSSProperties, Ref } from "react";
import type { Team } from "@/lib/types";
import { FLYER_FORMAT_SPECS, DEFAULT_FLYER_SETTINGS, type FlyerSettings } from "@/lib/flyer/settings";

export interface FlyerCanvasProps {
  homeTeam?: Team;
  awayTeam?: Team;
  date?: string | null;
  time?: string | null;
  venue?: string | null;
  competitionName?: string | null;
  settings: FlyerSettings;
  /** Rendered at this CSS scale (exports use 1 + a 3x canvas scale). */
  scale?: number;
  innerRef?: Ref<HTMLDivElement>;
  className?: string;
}

const CANVAS_CSS = `
  .fc-root {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: #16211a;
    background: #ffffff;
  }
  .fc-root *, .fc-root *::before, .fc-root *::after { box-sizing: border-box; }

  .fc-bg {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }
  .fc-scrim { position: absolute; inset: 0; background: #000000; }

  .fc-content {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 30px 26px;
    text-align: center;
  }

  .fc-comp {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .fc-headline {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  .fc-subtitle { margin-top: -4px; font-size: 13px; font-weight: 500; opacity: 0.85; }
  .fc-divider { width: 64px; height: 2px; background: var(--fc-accent, #0f7c45); }

  .fc-teams {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    width: 100%;
    margin: 4px 0;
  }
  .fc-team {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: 36%;
  }
  .fc-logo {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    object-fit: contain;
    background: rgba(127, 127, 127, 0.16);
  }
  .fc-logo-fallback {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    font-weight: 800;
    background: rgba(127, 127, 127, 0.16);
  }
  .fc-team-name { font-size: 14px; font-weight: 700; line-height: 1.2; }
  .fc-vs { font-size: 16px; font-weight: 900; opacity: 0.7; }

  .fc-details { display: flex; flex-direction: column; gap: 3px; }
  .fc-date { font-size: 15px; font-weight: 700; }
  .fc-time { font-size: 13px; opacity: 0.85; }
  .fc-venue { font-size: 12px; opacity: 0.7; }

  .fc-footer {
    margin-top: 6px;
    font-size: 11px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    opacity: 0.65;
  }

  /* Built-in templates */
  .fc-root.fc-classic .fc-headline { color: var(--fc-accent, #0f7c45); }

  .fc-root.fc-minimal { background: #ffffff; color: #16211a; }
  .fc-root.fc-minimal .fc-content { align-items: flex-start; text-align: left; }
  .fc-root.fc-minimal .fc-headline {
    color: #16211a;
    font-size: 26px;
    letter-spacing: 0.01em;
    text-transform: none;
  }
  .fc-root.fc-minimal .fc-subtitle { color: #5b6a5d; }
  .fc-root.fc-minimal .fc-teams { justify-content: flex-start; }
  .fc-root.fc-minimal .fc-divider { margin: 0; width: 48px; }

  .fc-root.fc-bold { background: var(--fc-accent, #0f7c45); color: #ffffff; }
  .fc-root.fc-bold .fc-headline { color: #ffffff; font-size: 22px; }
  .fc-root.fc-bold .fc-team-name { font-size: 16px; }
  .fc-root.fc-bold .fc-logo,
  .fc-root.fc-bold .fc-logo-fallback { background: rgba(255, 255, 255, 0.2); }
  .fc-root.fc-bold .fc-divider { background: rgba(255, 255, 255, 0.6); }

  /* Background photo mode — template fills give way to the text colour */
  .fc-root.fc-has-bg { background: #111820; color: var(--fc-text, #ffffff); }
  .fc-root.fc-has-bg .fc-headline,
  .fc-root.fc-has-bg .fc-team-name,
  .fc-root.fc-has-bg .fc-date,
  .fc-root.fc-has-bg .fc-vs,
  .fc-root.fc-has-bg .fc-subtitle { color: var(--fc-text, #ffffff); }
  .fc-root.fc-has-bg .fc-divider { background: var(--fc-text, #ffffff); }
`;

function formatDate(value?: string | null): string {
  if (!value) return "Date TBD";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function TeamBlock({
  team,
  fallback,
  showLogos,
}: {
  team?: Team;
  fallback: string;
  showLogos: boolean;
}) {
  const name = team?.name || fallback;
  return (
    <div className="fc-team">
      {showLogos &&
        (team?.logo_url ? (
          <img src={team.logo_url} alt="" className="fc-logo" crossOrigin="anonymous" />
        ) : (
          <div className="fc-logo-fallback">{name.charAt(0)}</div>
        ))}
      <div className="fc-team-name">{name}</div>
    </div>
  );
}

export function FlyerCanvas({
  homeTeam,
  awayTeam,
  date,
  time,
  venue,
  competitionName,
  settings,
  scale = 1,
  innerRef,
  className,
}: FlyerCanvasProps) {
  const spec = FLYER_FORMAT_SPECS[settings.format];
  const hasBg = Boolean(settings.background_url);

  const rootStyle: CSSProperties = {
    width: spec.width,
    height: spec.height,
    ["--fc-text" as string]: settings.text_color,
    ["--fc-accent" as string]:
      settings.accent_color === DEFAULT_FLYER_SETTINGS.accent_color
        ? "var(--brand-600, #0f7c45)"
        : settings.accent_color,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: "top left",
  };

  return (
    <div
      className={className}
      style={{ width: spec.width * scale, height: spec.height * scale }}
    >
      <style>{CANVAS_CSS}</style>
      <div
        ref={innerRef}
        className={`fc-root fc-${settings.template}${hasBg ? " fc-has-bg" : ""}`}
        style={rootStyle}
      >
        {hasBg && (
          <div
            className="fc-bg"
            style={{ backgroundImage: `url(${settings.background_url})` }}
          />
        )}
        {hasBg && <div className="fc-scrim" style={{ opacity: settings.overlay / 100 }} />}

        <div className="fc-content">
          {settings.show_competition && competitionName && (
            <div className="fc-comp">{competitionName}</div>
          )}
          {settings.headline && <div className="fc-headline">{settings.headline}</div>}
          {settings.subtitle && <div className="fc-subtitle">{settings.subtitle}</div>}

          <div className="fc-divider" />

          <div className="fc-teams">
            <TeamBlock team={homeTeam} fallback="Home" showLogos={settings.show_logos} />
            <div className="fc-vs">VS</div>
            <TeamBlock team={awayTeam} fallback="Away" showLogos={settings.show_logos} />
          </div>

          <div className="fc-details">
            <div className="fc-date">{formatDate(date)}</div>
            {time && <div className="fc-time">{time}</div>}
            {settings.show_venue && venue && <div className="fc-venue">{venue}</div>}
          </div>

          {settings.footer_text && <div className="fc-footer">{settings.footer_text}</div>}
        </div>
      </div>
    </div>
  );
}
