export const PUBLIC_REMINDER_LEADS = [60, 30, 15] as const;
export type PublicReminderLead = (typeof PUBLIC_REMINDER_LEADS)[number];

function numericParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
}

/** Interpret the fixture's date and time as wall-clock values in its league timezone. */
export function fixtureKickoffUtc(date: string, time: string, timeZone: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [, y, mo, d] = dateMatch;
  const [, h, mi, sec = "0"] = timeMatch;
  const desired = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(sec));
  const normalized = new Date(desired);
  if (
    ![y, mo, d, h, mi, sec].every((part) => Number.isFinite(Number(part))) ||
    normalized.getUTCFullYear() !== Number(y) || normalized.getUTCMonth() + 1 !== Number(mo) ||
    normalized.getUTCDate() !== Number(d) || Number(h) > 23 || Number(mi) > 59 || Number(sec) > 59
  ) return null;

  let result = desired;
  try {
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const actual = numericParts(new Date(result), timeZone);
      const representedAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
      const correction = desired - representedAsUtc;
      result += correction;
      if (correction === 0) break;
    }
  } catch {
    return null;
  }
  return new Date(result);
}

/** Cron runs each minute; a ±1-minute window tolerates tick and timezone precision. */
export function duePublicReminderLeads(now: Date, kickoff: Date): PublicReminderLead[] {
  const minutesUntilKickoff = (kickoff.getTime() - now.getTime()) / 60_000;
  return PUBLIC_REMINDER_LEADS.filter((lead) => Math.abs(minutesUntilKickoff - lead) <= 1);
}
