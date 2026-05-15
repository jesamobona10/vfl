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
