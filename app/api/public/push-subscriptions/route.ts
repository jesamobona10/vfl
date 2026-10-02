import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isSupportedPushEndpoint } from "@/lib/public-push";
import {
  getClientIp,
  json,
  logApiError,
  rateLimit,
  rateLimitResponse,
} from "@/lib/security";

export const dynamic = "force-dynamic";

function publicVapidKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
}

export async function GET() {
  const key = publicVapidKey();
  if (!key) return json({ error: "Push notifications are not configured." }, { status: 503 });
  return json({ publicKey: key });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limited = await rateLimit({ key: `public-push-subscribe:${ip}`, limit: 10, windowMs: 60_000 });
  if (limited.limited) return rateLimitResponse(limited.resetAt);

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return json({ error: "Push notifications are not configured." }, { status: 503 });
  }

  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    const preferences = body?.preferences;
    const organizationId = preferences?.organizationId;
    const displayName = typeof preferences?.displayName === "string" ? preferences.displayName.trim() : "";
    const teamIds: number[] = Array.isArray(preferences?.teamIds) ? preferences.teamIds : [];
    if (
      !isSupportedPushEndpoint(endpoint) ||
      typeof p256dh !== "string" || p256dh.length > 256 ||
      typeof auth !== "string" || auth.length > 256 ||
      typeof organizationId !== "string" || !/^[0-9a-f-]{36}$/i.test(organizationId) ||
      displayName.length > 80 || teamIds.length > 50 ||
      teamIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
    ) {
      return json({ error: "Invalid push subscription or match preferences." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data: publicMatches, error: matchesError } = await supabase
      .from("public_matches")
      .select("home_team_id, away_team_id")
      .eq("organization_id", organizationId);
    if (matchesError) throw matchesError;
    if (!publicMatches?.length) return json({ error: "Choose an organization with public matches." }, { status: 400 });
    const validTeamIds = new Set(publicMatches.flatMap((match) => [match.home_team_id, match.away_team_id]).filter((id): id is number => typeof id === "number"));
    if (teamIds.some((id) => !validTeamIds.has(id))) return json({ error: "One or more selected teams are unavailable." }, { status: 400 });

    const { error } = await supabase.from("public_push_subscriptions").upsert(
      {
        endpoint,
        p256dh,
        auth,
        display_name: displayName || null,
        organization_id: organizationId,
        team_ids: [...new Set(teamIds)],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
    if (error) throw error;
    return json({ subscribed: true });
  } catch (error) {
    logApiError("public_push_subscription_failed", error);
    return json({ error: "Unable to save the push subscription." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request);
  const limited = await rateLimit({ key: `public-push-unsubscribe:${ip}`, limit: 10, windowMs: 60_000 });
  if (limited.limited) return rateLimitResponse(limited.resetAt);

  try {
    const body = await request.json();
    if (!isSupportedPushEndpoint(body?.endpoint)) {
      return json({ error: "Invalid push endpoint." }, { status: 400 });
    }
    const { error } = await createServiceRoleClient()
      .from("public_push_subscriptions")
      .delete()
      .eq("endpoint", body.endpoint);
    if (error) throw error;
    return json({ unsubscribed: true });
  } catch (error) {
    logApiError("public_push_unsubscribe_failed", error);
    return json({ error: "Unable to remove the push subscription." }, { status: 500 });
  }
}
