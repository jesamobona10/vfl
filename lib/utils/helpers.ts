export function pairKey(homeId: number, awayId: number): string {
  return [Number(homeId), Number(awayId)].sort((a, b) => a - b).join("-");
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttribute(value: unknown): string {
  return escapeHtml(value);
}

export function titleCase(value: string): string {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function matchMeta(match: {
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  date?: string;
  time?: string;
  venue?: string;
}): string {
  const details: string[] = [];
  if (match.status === "completed") {
    details.push(`${match.homeScore}-${match.awayScore}`);
  }
  if (match.date) {
    details.push(match.time ? `${match.date} ${match.time}` : match.date);
  }
  if (match.venue) {
    details.push(match.venue);
  }
  return details.join(" | ") || "Date and venue not assigned";
}

export function posLabel(code: string): string {
  return { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", ATT: "Attacker" }[code] || code;
}

export interface Team {
  id: number;
  name: string;
  color?: string;
  logo?: string;
}

export function teamName(id: number, teams: Team[]): string {
  return teams.find((t) => t.id === Number(id))?.name || "Unknown Team";
}

export function teamBadge(team: Team | undefined, useLogo: boolean): string {
  if (useLogo && team?.logo) {
    return `<img src="${escapeAttribute(team.logo)}" alt="${escapeAttribute(team.name)}" class="team-logo-inline" aria-hidden="true">`;
  }
  return team?.logo
    ? `<img src="${escapeAttribute(team.logo)}" alt="${escapeAttribute(team.name)}" class="team-logo-inline" aria-hidden="true">`
    : `<span aria-hidden="true" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${team?.color || "#ccc"};margin-right:8px"></span>`;
}

export function formGuide(form: string[]): string {
  if (!form.length) return `<span class="empty-state">-</span>`;
  return `<span class="form-guide">${form.map((r) => `<span class="form-dot form-${r}">${r}</span>`).join("")}</span>`;
}

function parseTimeToMinutes(time: string): number | null {
  if (!time) return null;
  const trimmed = time.trim().toUpperCase();

  const apMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (apMatch) {
    let h = Number(apMatch[1]);
    const m = Number(apMatch[2] || 0);
    if (apMatch[3] === "PM" && h !== 12) h += 12;
    if (apMatch[3] === "AM" && h === 12) h = 0;
    return h * 60 + m;
  }

  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    return Number(h24Match[1]) * 60 + Number(h24Match[2]);
  }

  return null;
}

function parseDateToMs(date: string): number | null {
  const dmy = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d.getTime();
}

export function sortMatchesByDateTime<T extends { date: string; time: string }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    const aHasDate = Boolean(a.date?.trim());
    const bHasDate = Boolean(b.date?.trim());

    if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;

    if (aHasDate) {
      const da = parseDateToMs(a.date);
      const db = parseDateToMs(b.date);
      if (da !== null && db !== null && da !== db) return da - db;
      if (da !== null && db === null) return -1;
      if (da === null && db !== null) return 1;

      const ta = parseTimeToMinutes(a.time);
      const tb = parseTimeToMinutes(b.time);
      if (ta !== null && tb !== null && ta !== tb) return ta - tb;
      if (ta !== null && tb === null) return -1;
      if (ta === null && tb !== null) return 1;

      return 0;
    }

    const ta = parseTimeToMinutes(a.time);
    const tb = parseTimeToMinutes(b.time);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    if (ta !== null && tb === null) return -1;
    if (ta === null && tb !== null) return 1;

    return 0;
  });
}
