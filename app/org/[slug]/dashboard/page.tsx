"use client";

import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { useCompetitions } from "@/lib/hooks/use-competitions";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { LeagueStats } from "@/components/dashboard/league-stats";
import { UpcomingMatches } from "@/components/dashboard/upcoming-matches";
import { TopFiveStandings } from "@/components/dashboard/top-five-standings";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { CalendarView } from "@/components/calendar/calendar-view";
import { PlayerDashboard } from "@/components/player/player-dashboard";
import { Shield, RefreshCw, Trophy, Swords, Users, Plus, ArrowRight, Upload } from "lucide-react";
import { DashboardSkeleton } from "@/components/shared/skeleton";
import { GeneratePlayerCredentials } from "@/components/players/generate-player-credentials";
import { useParams, useRouter } from "next/navigation";

export default function OrgDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const queryClient = useQueryClient();
  const { data: currentOrg } = useOrg(slug);
  const { data: competitions = [] } = useCompetitions(currentOrg?.id);
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const fixtures = useAppStore((s) => s.fixtures);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const isPlayer = useAppStore((s) => s.userProfile?.role === "player");
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const teamDataLoaded = useAppStore((s) => s.teamDataLoaded);
  const setTeamDataLoaded = useAppStore((s) => s.setTeamDataLoaded);
  const [fetching, setFetching] = useState(false);
  const [orgLogoUploading, setOrgLogoUploading] = useState(false);
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(null);
  const orgLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentOrg?.id) return;
    const store = useAppStore.getState();
    const params = `?org_id=${currentOrg.id}`;
    Promise.all([
      fetch(`/api/teams${params}`),
      fetch(`/api/players${params}`),
      fetch(`/api/fixtures${params}`),
    ]).then(async ([teamsRes, playersRes, fixturesRes]) => {
      if (teamsRes.ok) {
        const data = await teamsRes.json();
        store.setTeams(data.teams || []);
      }
      if (playersRes.ok) {
        const data = await playersRes.json();
        store.setPlayers(data.players || []);
      }
      if (fixturesRes.ok) {
        const data = await fixturesRes.json();
        store.setFixtures(data.fixtures || []);
      }
      store.setTeamDataLoaded(true);
    }).catch(() => {
      store.setTeamDataLoaded(true);
    });
  }, [slug, currentOrg?.id]);

  const handleOrgLogoUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { alert("File too large. Max 2MB."); return; }
    if (!currentOrg) return;
    setOrgLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("orgId", currentOrg.id);
      formData.append("orgName", currentOrg.name);
      const res = await fetch("/api/upload/org-logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setOrgLogoUrl(data.url);
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
    } catch { alert("Upload failed."); }
    finally { setOrgLogoUploading(false); }
  };

  const teamId = currentTeamAccount?.teamId;
  const team = teams.find((t) => t.id === teamId);
  const teamPlayerCount = teamId
    ? players.filter((p) => p.teamId === teamId).length
    : 0;

  const totalRounds = fixtures.reduce((max, r) => Math.max(max, r.round), 0);
  const firstActiveRound = fixtures.find((r) =>
    r.matches.some((m) => m.status !== "completed")
  )?.round;
  const currentRound = firstActiveRound ?? totalRounds;

  if (currentTeamAccount && !teamDataLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <DashboardSkeleton />
      </div>
    );
  }

  if (isPlayer) {
    return <PlayerDashboard />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-5">
        <div className="flex items-center gap-4">
          {!currentTeamAccount && (
            <div className="relative shrink-0">
              <div
                onClick={() => orgLogoInputRef.current?.click()}
                className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center overflow-hidden border border-line cursor-pointer hover:opacity-80 transition-opacity"
              >
                {(orgLogoUrl || currentOrg?.logo_url) ? (
                  <img src={orgLogoUrl || currentOrg!.logo_url!} alt="Org logo" className="w-full h-full object-cover" />
                ) : (
                  <Shield size={24} className="text-ink-3/50" />
                )}
                {orgLogoUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl">
                    <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
                  </div>
                )}
              </div>
              <input ref={orgLogoInputRef} type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleOrgLogoUpload(file);
              }} className="hidden" />
              <button
                onClick={() => orgLogoInputRef.current?.click()}
                disabled={orgLogoUploading}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center shadow-md hover:bg-brand-dark transition-colors"
                title="Upload logo"
              >
                <Upload size={12} />
              </button>
            </div>
          )}
          <div>
            <p className="text-[12.5px] text-ink-2">
              {currentTeamAccount
                ? "Team account"
                : `${currentOrg?.name || "Organization"} · Round ${currentRound || "—"} of ${totalRounds || "—"}`}
            </p>
            <h1 className="text-xl font-semibold tracking-[-0.01em]">
              {currentTeamAccount ? `${currentTeamAccount.name}` : "Dashboard"}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {currentTeamAccount ? (
            <button
              onClick={async () => {
                setTeamDataLoaded(false);
                setFetching(true);
                await refreshTeamData();
                setFetching(false);
              }}
              disabled={fetching}
              className="btn-ghost text-sm"
            >
              <RefreshCw size={16} className={fetching ? "animate-spin" : ""} />
              Refresh
            </button>
          ) : competitions.length === 0 ? (
            <button
              onClick={() => router.push(`/org/${currentOrg?.slug}/competitions/new`)}
              className="btn-primary text-sm"
            >
              <Plus size={14} /> Create Competition
            </button>
          ) : (
            <button
              onClick={() => router.push(`/org/${currentOrg?.slug}/fixtures`)}
              className="btn-primary text-sm"
            >
              <Plus size={14} /> Generate fixtures
            </button>
          )}
        </div>
      </div>

      {currentTeamAccount && team && (
        <>
          <div className="card p-5 flex items-center gap-4">
            {team.logo_url ? (
              <img
                src={team.logo_url}
                alt={team.name}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center">
                <Shield size={24} className="text-ink-2" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold">{team.name}</h2>
              <p className="text-sm text-ink-2">Rating: {team.rating.toFixed(1)}</p>
            </div>
          </div>
          <div>
            <GeneratePlayerCredentials
              scope="team"
              teamId={teamId}
              teamName={team.name}
              playerCount={teamPlayerCount}
            />
          </div>
        </>
      )}

      <MetricCards />

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
        <UpcomingMatches />
        <TopFiveStandings />
      </div>

      {!currentTeamAccount && <RecentActivity orgSlug={slug} />}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Competitions</h2>
          <button
            onClick={() => router.push(`/org/${currentOrg?.slug}/competitions`)}
            className="btn-ghost text-sm"
          >
            View all <ArrowRight size={14} />
          </button>
        </div>
        {competitions.length === 0 ? (
          <div className="text-center py-6">
            <Trophy size={32} className="mx-auto text-ink-3/40 mb-2" />
            <p className="text-sm text-ink-2 mb-3">No competitions yet</p>
            <button
              onClick={() => router.push(`/org/${currentOrg?.slug}/competitions/new`)}
              className="btn-ghost text-sm"
            >
              <Plus size={14} /> Create Competition
            </button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {competitions.slice(0, 6).map((comp) => (
              <button
                key={comp.id}
                onClick={() => router.push(`/org/${currentOrg?.slug}/competitions/${comp.id}`)}
                className="flex items-center gap-3 p-3 rounded-lg border border-line hover:border-brand hover:bg-brand/5 transition-colors text-left"
              >
                {comp.type === "league" ? <Trophy size={18} className="text-brand" /> :
                 comp.type === "cup" ? <Swords size={18} className="text-brand" /> :
                 <Users size={18} className="text-brand" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{comp.name}</p>
                  <p className="text-xs text-ink-2 capitalize">{comp.status}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <CalendarView orgId={currentOrg?.id} />

      {isAdmin && <LeagueStats />}
    </div>
  );
}

function refreshTeamData() {
  const store = useAppStore.getState();
  return fetch("/api/team/data")
    .then((r) => r.json())
    .then((data) => {
      store.setTeams(data.teams || []);
      store.setPlayers(data.players || []);
      store.setFixtures(data.fixtures || []);
      store.setTeamDataLoaded(true);
    })
    .catch(() => {
      useAppStore.getState().setTeamDataLoaded(true);
    });
}
