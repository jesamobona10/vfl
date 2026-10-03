import { json, logApiError } from "@/lib/security";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { duePublicReminderLeads, fixtureKickoffUtc } from "@/lib/public-reminders";
import { isPublicPushConfigured, sendPublicPushNow } from "@/lib/public-push";
import { livePhase, liveSettings } from "@/lib/logic/live";

export const dynamic = "force-dynamic";

function localDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return json({ error: "Reminder scheduler is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isPublicPushConfigured()) return json({ error: "Push notifications are not configured." }, { status: 503 });

  const now = new Date();
  const timeZone = process.env.PUBLIC_MATCH_TIMEZONE || "Africa/Lagos";
  const today = localDate(now, timeZone);
  const tomorrow = nextDate(today);
  try {
    const supabase = createServiceRoleClient();
    const { data: fixtures, error } = await supabase
      .from("public_matches")
      .select("match_id, home_team_name, away_team_name, date, time")
      .eq("status", "scheduled")
      .gte("date", today)
      .lte("date", tomorrow);
    if (error) throw error;
    const { data: liveMatches, error: liveError } = await supabase
      .from("public_matches")
      .select("match_id, home_team_name, away_team_name, home_score, away_score, status, live_started_at, halftime_minutes, stoppage_minutes")
      .in("status", ["live", "in-progress"]);
    if (liveError) throw liveError;

    let remindersClaimed = 0;
    let notificationsSent = 0;
    let halftimeNotifications = 0;
    for (const fixture of fixtures || []) {
      if (!fixture.date || !fixture.time) continue;
      const kickoff = fixtureKickoffUtc(fixture.date, fixture.time, timeZone);
      if (!kickoff) continue;
      for (const leadMinutes of duePublicReminderLeads(now, kickoff)) {
        const { data: claim, error: claimError } = await supabase
          .from("public_match_reminder_deliveries")
          .insert({ fixture_id: fixture.match_id, lead_minutes: leadMinutes })
          .select("fixture_id")
          .maybeSingle();
        if (claimError?.code === "23505") continue;
        if (claimError) throw claimError;
        if (!claim) continue;
        remindersClaimed += 1;

        try {
          const displayLead = leadMinutes === 60 ? "1 hour" : `${leadMinutes} minutes`;
          const result = await sendPublicPushNow({
            title: `Match in ${displayLead}`,
            body: `${fixture.home_team_name} vs ${fixture.away_team_name} kicks off in ${displayLead}.`,
            matchId: fixture.match_id,
            reminderMinutes: leadMinutes,
          });
          if (result.eligible > 0 && result.delivered === 0 && result.failed > 0) {
            await supabase.from("public_match_reminder_deliveries")
              .delete()
              .eq("fixture_id", fixture.match_id)
              .eq("lead_minutes", leadMinutes);
            throw new Error("No pre-match reminder endpoints accepted delivery.");
          }
          notificationsSent += result.delivered;
        } catch (dispatchError) {
          // Permit the next cron tick to retry a transient failure.
          await supabase.from("public_match_reminder_deliveries")
            .delete()
            .eq("fixture_id", fixture.match_id)
            .eq("lead_minutes", leadMinutes);
          throw dispatchError;
        }
      }
    }
    for (const match of liveMatches || []) {
      if (!match.live_started_at) continue;
      const phase = livePhase(match.live_started_at, now, liveSettings({
        halftimeMinutes: match.halftime_minutes,
        stoppageMinutes: match.stoppage_minutes,
      }));
      if (phase.label !== "HT") continue;

      const { data: claimed, error: claimError } = await supabase
        .from("fixtures")
        .update({ halftime_notified_at: now.toISOString() })
        .eq("id", match.match_id)
        .is("halftime_notified_at", null)
        .select("id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) continue;

      const result = await sendPublicPushNow({
        title: "Half-time",
        body: `${match.home_team_name} ${match.home_score ?? 0}–${match.away_score ?? 0} ${match.away_team_name} at half-time.`,
        matchId: match.match_id,
      });
      if (result.eligible > 0 && result.delivered === 0 && result.failed > 0) {
        const { error: resetError } = await supabase
          .from("fixtures")
          .update({ halftime_notified_at: null })
          .eq("id", match.match_id)
          .eq("halftime_notified_at", now.toISOString());
        if (resetError) throw resetError;
      }
      notificationsSent += result.delivered;
      halftimeNotifications += 1;
    }
    return json({ scanned: fixtures?.length || 0, remindersClaimed, halftimeNotifications, notificationsSent });
  } catch (error) {
    logApiError("public_pre_match_reminders_failed", error);
    return json({ error: "Unable to process pre-match reminders." }, { status: 500 });
  }
}
