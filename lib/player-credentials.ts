/** Normalize a name segment for usernames/passwords (alphanumeric uppercase). */
export function normalizeCredentialPart(value: string): string {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalized || "PLAYER";
}

/** Username: PLAYERNAME_TEAMNAME_001 — Password: PLAYERNAME_001 */
export function buildPlayerCredentialPair(
  playerName: string,
  teamName: string,
  sequence: number
): { username: string; password: string; sequence: string } {
  const playerToken = normalizeCredentialPart(playerName);
  const teamToken = normalizeCredentialPart(teamName);
  const seq = String(sequence).padStart(3, "0");
  return {
    username: `${playerToken}_${teamToken}_${seq}`,
    password: `${playerToken}_${seq}`,
    sequence: seq,
  };
}

export function playerEmailFromUsername(username: string): string {
  return `player_${username.toLowerCase()}@vfl.local`;
}

export function isValidPlayerUsername(username: string): boolean {
  return /^[A-Z0-9_]{3,80}$/.test(username);
}

export type CredentialRowStatus = "created" | "regenerated" | "skipped" | "failed";

export type GeneratedPlayerCredential = {
  playerId: number;
  playerName: string;
  teamName: string;
  username: string;
  password: string;
  status: CredentialRowStatus;
  message?: string;
};

type DbPlayer = {
  id: number;
  name: string;
  team_id: number;
  teams: { name: string } | { name: string }[] | null;
};

function teamNameFromRow(row: DbPlayer): string {
  const teams = row.teams;
  if (!teams) return "TEAM";
  if (Array.isArray(teams)) return teams[0]?.name || "TEAM";
  return teams.name || "TEAM";
}

export async function generatePlayerCredentialsForScope(options: {
  serviceClient: {
    from: (table: string) => any;
    auth: { admin: { createUser: (args: any) => Promise<any>; updateUserById: (id: string, args: any) => Promise<any>; deleteUser: (id: string) => Promise<any> } };
  };
  teamId?: number | null;
  forceRegenerate?: boolean;
  generatedBy: string;
  scope: "admin" | "team";
}): Promise<{
  credentials: GeneratedPlayerCredential[];
  created: number;
  regenerated: number;
  skipped: number;
  failed: number;
}> {
  const { serviceClient: sb, teamId, forceRegenerate = false, generatedBy, scope } = options;

  let query = sb
    .from("players")
    .select("id, name, team_id, teams(name)")
    .order("id");

  if (teamId != null) {
    query = query.eq("team_id", teamId);
  }

  const { data: players, error: playersError } = await query;
  if (playersError) {
    throw new Error("Unable to load players.");
  }

  const rows = (players || []) as DbPlayer[];
  const credentials: GeneratedPlayerCredential[] = [];
  let created = 0;
  let regenerated = 0;
  let skipped = 0;
  let failed = 0;

  const { data: existingProfiles } = await sb
    .from("player_profiles")
    .select("id, player_id, username");

  const profileByPlayerId = new Map<number, { id: string; username: string | null }>();
  for (const profile of existingProfiles || []) {
    if (profile.player_id != null) {
      profileByPlayerId.set(profile.player_id, {
        id: profile.id,
        username: profile.username,
      });
    }
  }

  const { data: existingUsernames } = await sb
    .from("player_profiles")
    .select("username")
    .not("username", "is", null);

  const usedUsernames = new Set(
    (existingUsernames || [])
      .map((p: { username: string | null }) => p.username)
      .filter(Boolean) as string[]
  );

  const sequenceByKey = new Map<string, number>();

  function nextSequence(playerName: string, teamName: string): number {
    const playerToken = normalizeCredentialPart(playerName);
    const teamToken = normalizeCredentialPart(teamName);
    const key = `${playerToken}_${teamToken}`;
    const prefix = `${key}_`;

    let maxSeq = sequenceByKey.get(key) ?? 0;
    for (const username of usedUsernames) {
      if (!username.startsWith(prefix)) continue;
      const suffix = username.slice(prefix.length);
      const num = parseInt(suffix, 10);
      if (!Number.isNaN(num)) maxSeq = Math.max(maxSeq, num);
    }
    const next = maxSeq + 1;
    sequenceByKey.set(key, next);
    return next;
  }

  for (const player of rows) {
    const teamName = teamNameFromRow(player);
    const existing = profileByPlayerId.get(player.id);

    if (existing && !forceRegenerate) {
      credentials.push({
        playerId: player.id,
        playerName: player.name,
        teamName,
        username: existing.username || "(existing)",
        password: "",
        status: "skipped",
        message: "Credentials already exist.",
      });
      skipped += 1;
      continue;
    }

    const seq = nextSequence(player.name, teamName);
    const { username, password } = buildPlayerCredentialPair(player.name, teamName, seq);
    const email = playerEmailFromUsername(username);

    try {
      if (existing && forceRegenerate) {
        const { error: updateAuthError } = await sb.auth.admin.updateUserById(existing.id, {
          email,
          password,
        });
        if (updateAuthError) throw updateAuthError;

        const { error: updateProfileError } = await sb
          .from("player_profiles")
          .update({
            username,
            display_name: player.name,
            must_change_password: true,
          })
          .eq("id", existing.id);

        if (updateProfileError) throw updateProfileError;

        if (existing.username) usedUsernames.delete(existing.username);
        usedUsernames.add(username);

        credentials.push({
          playerId: player.id,
          playerName: player.name,
          teamName,
          username,
          password,
          status: "regenerated",
        });
        regenerated += 1;
        continue;
      }

      const { data: authUser, error: createError } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) throw createError;

      const { error: insertError } = await sb.from("player_profiles").insert({
        id: authUser.user.id,
        player_id: player.id,
        display_name: player.name,
        username,
        must_change_password: true,
      });

      if (insertError) {
        await sb.auth.admin.deleteUser(authUser.user.id);
        throw insertError;
      }

      usedUsernames.add(username);
      profileByPlayerId.set(player.id, { id: authUser.user.id, username });

      credentials.push({
        playerId: player.id,
        playerName: player.name,
        teamName,
        username,
        password,
        status: "created",
      });
      created += 1;
    } catch (err) {
      credentials.push({
        playerId: player.id,
        playerName: player.name,
        teamName,
        username,
        password: "",
        status: "failed",
        message: err instanceof Error ? err.message : "Generation failed.",
      });
      failed += 1;
    }
  }

  const affected = created + regenerated;
  if (affected > 0) {
    const { error: logError } = await sb.from("credential_generation_logs").insert({
      generated_by: generatedBy,
      team_id: teamId ?? null,
      scope,
      players_affected: affected,
    });
  }

  return { credentials, created, regenerated, skipped, failed };
}
