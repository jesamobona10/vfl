"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DataImporter } from "./data-importer";
import { DashboardOverview } from "./dashboard-overview";
import { OrgManager } from "./org-manager";
import { AdminTeamManager } from "./team-manager";
import { AdminPlayerManager } from "./admin-player-manager";
import { CompManager } from "./comp-manager";
import { AuditViewer } from "./audit-viewer";
import { UsersManager } from "./users-manager";
import { AdminTeamAccountManager } from "./admin-team-account-manager";
import { ChevronDown, ChevronRight, Building2, Calendar, Trash2, Search } from "lucide-react";
import { PageSkeleton } from "@/components/shared/skeleton";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/shared/confirm-dialog";
import type { Team, Player } from "@/lib/types";

type AdminTab =
  | "dashboard"
  | "orgs"
  | "teams"
  | "players"
  | "competitions"
  | "fixtures"
  | "users"
  | "audit"
  | "import";

function FixtureManager() {
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [data, setData] = useState<{
    organizations: Array<{
      id: string;
      name: string;
      slug: string;
      logo_url?: string;
      rounds: Array<{
        round: number;
        byeId: number | null;
        matches: Array<{
          id: number;
          round: number;
          homeId: number;
          awayId: number;
          homeScore: number | null;
          awayScore: number | null;
          status: string;
          date: string;
          time: string;
          venue: string;
          events: Array<{ type: string; playerId: number; minute: number | null; teamId: number }>;
          homeTeamName: string;
          awayTeamName: string;
          homeTeamLogo?: string;
          awayTeamLogo?: string;
        }>;
      }>;
    }>;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/fixtures")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load fixtures."))
      .finally(() => setLoading(false));
  }, []);

  const [deletingOrg, setDeletingOrg] = useState<string | null>(null);

  const handleDeleteOrgFixtures = async (org: { id: string; name: string; slug: string }) => {
    if (
      !(await confirm({
        title: `Delete ALL fixtures for "${org.name}"?`,
        description: "Every fixture in this organization will be permanently removed. This cannot be undone.",
      }))
    )
      return;
    setDeletingOrg(org.id);
    try {
      const res = await fetch(`/api/organizations/${org.slug}/delete-fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (d.error) {
        toast.error(d.error);
        return;
      }
      toast.success(`All fixtures for "${org.name}" deleted.`);
      const reload = await fetch("/api/admin/fixtures");
      const reloadData = await reload.json();
      if (reloadData.error) toast.error(reloadData.error);
      else setData(reloadData);
    } catch {
      toast.error("Failed to delete fixtures. Please try again.");
    } finally {
      setDeletingOrg(null);
    }
  };

  const statusLabel: Record<string, string> = {
    scheduled: "Scheduled",
    "in-progress": "In Progress",
    live: "Live",
    completed: "Completed",
  };

  const statusTone: Record<string, string> = {
    scheduled: "bg-surface-2 text-muted",
    "in-progress": "bg-accent/10 text-accent",
    live: "bg-brand/10 text-brand",
    completed: "bg-muted/10 text-muted",
  };

  const filteredOrgs =
    data?.organizations
      .map((org) => {
        if (!searchQuery.trim()) return org;
        const q = searchQuery.toLowerCase();
        const orgMatch = org.name.toLowerCase().includes(q);
        const filteredRounds = org.rounds
          .map((round) => ({
            ...round,
            matches: round.matches.filter(
              (m) =>
                orgMatch ||
                m.homeTeamName.toLowerCase().includes(q) ||
                m.awayTeamName.toLowerCase().includes(q)
            ),
          }))
          .filter((round) => orgMatch || round.matches.length > 0);
        return { ...org, rounds: filteredRounds };
      })
      .filter((org) => (searchQuery.trim() ? org.rounds.length > 0 : true)) || [];

  if (loading) return <PageSkeleton />;

  if (error) return <p className="text-sm text-danger text-center py-8">{error}</p>;

  if (!data?.organizations?.length) {
    return (
      <div className="card p-8 text-center text-muted">
        <Calendar size={32} className="mx-auto mb-2" />
        <p>No fixtures have been generated yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <p className="text-sm text-muted">Viewing all fixtures across the platform (read-only).</p>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by team or organization..."
          className="input w-full pl-9 text-sm"
        />
      </div>
      {filteredOrgs.map((org) => (
        <div key={org.id} className="card overflow-hidden">
          <div className="flex items-center">
            <button
              onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
              className="flex-1 flex items-center gap-3 px-5 py-4 hover:bg-surface-2/50 transition-colors text-left"
            >
              {expandedOrg === org.id ? (
                <ChevronDown size={16} className="shrink-0 text-muted" />
              ) : (
                <ChevronRight size={16} className="shrink-0 text-muted" />
              )}
              {org.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                />
              ) : (
                <Building2 size={18} className="text-muted shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold">{org.name}</span>
                <span className="text-xs text-muted ml-2">
                  {org.rounds.length} round{org.rounds.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>
            <button
              onClick={() => handleDeleteOrgFixtures(org)}
              disabled={deletingOrg === org.id}
              className="btn-ghost text-xs text-danger shrink-0 mr-4"
              title="Delete all fixtures for this organization"
            >
              {deletingOrg === org.id ? (
                <span className="block w-3 h-3 bg-surface-2 rounded animate-pulse" />
              ) : (
                <Trash2 size={13} />
              )}
            </button>
          </div>

          {expandedOrg === org.id && (
            <div className="border-t border-line px-5 py-4 space-y-5">
              {org.rounds.map((round) => (
                <div key={round.round}>
                  <h4 className="text-sm font-semibold text-muted uppercase tracking-wider mb-2">
                    Round {round.round}
                    {round.byeId != null && (
                      <span className="ml-2 text-xs text-muted font-normal">
                        (bye:{" "}
                        {round.matches.find((m) => m.homeId === round.byeId)?.homeTeamName ||
                          round.matches.find((m) => m.awayId === round.byeId)?.awayTeamName ||
                          `Team ${round.byeId}`}
                        )
                      </span>
                    )}
                  </h4>
                  <div className="space-y-2">
                    {round.matches.map((match) => (
                      <div key={match.id} className="card overflow-hidden">
                        <button
                          onClick={() =>
                            setExpandedMatch(expandedMatch === match.id ? null : match.id)
                          }
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors text-left"
                        >
                          {expandedMatch === match.id ? (
                            <ChevronDown size={14} className="shrink-0 text-muted" />
                          ) : (
                            <ChevronRight size={14} className="shrink-0 text-muted" />
                          )}
                          <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            <div className="flex items-center gap-2 justify-end">
                              {match.homeTeamLogo && (
                                <img
                                  src={match.homeTeamLogo}
                                  alt=""
                                  className="w-5 h-5 rounded object-cover"
                                />
                              )}
                              <span className="text-sm font-semibold truncate">
                                {match.homeTeamName}
                              </span>
                            </div>
                            <span className="text-base font-bold text-center tabular-nums">
                              {match.homeScore != null ? match.homeScore : "-"} –{" "}
                              {match.awayScore != null ? match.awayScore : "-"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold truncate">
                                {match.awayTeamName}
                              </span>
                              {match.awayTeamLogo && (
                                <img
                                  src={match.awayTeamLogo}
                                  alt=""
                                  className="w-5 h-5 rounded object-cover"
                                />
                              )}
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${statusTone[match.status]}`}
                          >
                            {statusLabel[match.status] || match.status}
                          </span>
                        </button>

                        {expandedMatch === match.id && (
                          <div className="border-t border-line px-4 py-3 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className="text-xs text-muted block">Date</span>
                                <span>{match.date || "Not set"}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted block">Time</span>
                                <span>{match.time || "Not set"}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted block">Venue</span>
                                <span>{match.venue || "Not set"}</span>
                              </div>
                              <div>
                                <span className="text-xs text-muted block">Status</span>
                                <span className="capitalize">{match.status}</span>
                              </div>
                            </div>
                            {match.events.length > 0 && (
                              <div>
                                <h5 className="text-xs text-muted uppercase tracking-wider mb-1 font-semibold">
                                  Events ({match.events.length})
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                  {match.events.map((event, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs"
                                    >
                                      <span className="font-mono font-bold text-[10px] uppercase">
                                        {event.type.slice(0, 3).toUpperCase()}
                                      </span>
                                      <span>#{event.playerId}</span>
                                      {event.minute != null && (
                                        <span className="text-muted">{event.minute}&apos;</span>
                                      )}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const VALID_TABS: AdminTab[] = [
  "dashboard",
  "orgs",
  "teams",
  "players",
  "competitions",
  "fixtures",
  "users",
  "audit",
  "import",
];

export function AdminPanel() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<AdminTab>("dashboard");

  useEffect(() => {
    const urlTab = searchParams.get("tab") as AdminTab | null;
    if (urlTab && VALID_TABS.includes(urlTab)) {
      setTab(urlTab);
    }
  }, [searchParams]);

  return (
    <div>
      <div className="flex flex-col gap-1 mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-muted">Full system management</p>
      </div>

      {tab === "dashboard" && <DashboardOverview />}
      {tab === "orgs" && <OrgManager />}
      {tab === "teams" && <AdminTeamManager />}
      {tab === "players" && <AdminPlayerManager />}
      {tab === "competitions" && <CompManager />}
      {tab === "fixtures" && <FixtureManager />}
      {tab === "users" && <UsersManager />}
      {tab === "audit" && <AuditViewer />}
      {tab === "import" && <DataImporter />}
    </div>
  );
}
