"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { useParams } from "next/navigation";
import { FixtureList } from "@/components/fixtures/fixture-list";
import { SeasonEmptyState } from "@/components/dashboard/season-empty-state";
import { useOrgSeason } from "@/components/competitions/org-season-provider";
import { RefreshCw, Pencil, Eye, Table2, AlertCircle, Trash2, Lock } from "lucide-react";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { useToast } from "@/components/ui/toast";

const MatchEditor = dynamic(() => import("@/components/admin/match-editor").then(m => m.MatchEditor), {
  ssr: false,
  loading: () => null,
});

const BulkScoreEntry = dynamic(() => import("@/components/fixtures/bulk-score-entry").then(m => m.BulkScoreEntry), {
  ssr: false,
  loading: () => null,
});

interface CompOption {
  id: string;
  name: string;
  type: string;
}

export default function OrgFixturesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: currentOrg } = useOrg(slug);
  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const isAdmin = useAppStore((s) => s.isAdmin);

  const {
    selectedOrgSeasonId,
    loading: seasonLoading,
    hasTeams,
    hasFixtures: ctxHasFixtures,
    isOrgAdmin: ctxIsOrgAdmin,
  } = useOrgSeason();

  const [viewMode, setViewMode] = useState<"view" | "edit" | "table">("view");
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);
  const [comps, setComps] = useState<CompOption[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [error, setError] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const prevFixturesRef = useRef("");
  const fixtureLoadRequestRef = useRef(0);
  const currentOrgId = currentOrg?.id;

  const loadDbFixtures = useCallback(async (seasonId?: string) => {
    if (!currentOrgId) return;
    const requestId = ++fixtureLoadRequestRef.current;
    setLoadingDb(true);
    try {
      const [competitionsResponse, seasonFixturesResponse] = await Promise.all([
        fetch(`/api/competitions?org_id=${currentOrgId}`),
        seasonId
          ? fetch(`/api/organizations/${slug}/fixtures?org_season_id=${seasonId}`)
          : Promise.resolve(null),
      ]);
      if (!competitionsResponse.ok) throw new Error("Unable to load competitions.");
      const data = await competitionsResponse.json();
      const list: CompOption[] = (data.competitions || []).filter((c: CompOption) => c.type === "league");
      if (requestId !== fixtureLoadRequestRef.current) return;
      setComps(list);

      const query = seasonId
        ? `?org_season_id=${seasonId}`
        : list.length === 1
          ? `?competition_id=${list[0].id}`
          : "";
      const fixturesResponse = seasonFixturesResponse || await fetch(`/api/organizations/${slug}/fixtures${query}`);
      if (!fixturesResponse.ok) throw new Error("Unable to load fixtures.");
      const fixtureData = await fixturesResponse.json();
      if (requestId !== fixtureLoadRequestRef.current) return;
      const nextFixtures = Array.isArray(fixtureData.fixtures) ? fixtureData.fixtures : [];
      // Empty is valid for a new season and must replace the old season rows.
      setFixtures(nextFixtures);
      prevFixturesRef.current = JSON.stringify(nextFixtures);
    } catch {
      // Keep the active season visible; a later refetch can recover transient failures.
    } finally {
      if (requestId === fixtureLoadRequestRef.current) setLoadingDb(false);
    }
  }, [currentOrgId, setFixtures, slug]);

  useEffect(() => {
    const timer = setTimeout(() => void loadDbFixtures(selectedOrgSeasonId ?? undefined), 0);
    return () => {
      clearTimeout(timer);
      fixtureLoadRequestRef.current += 1;
    };
  }, [currentOrgId, loadDbFixtures, selectedOrgSeasonId]);

  useEffect(() => {
    if (!fixtures.length || !currentOrgId) return;
    const serialized = JSON.stringify(fixtures);
    if (serialized === prevFixturesRef.current) return;
    prevFixturesRef.current = serialized;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/sync/fixtures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtures }),
        });
      } catch {
        // silent
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [fixtures, currentOrgId]);

  const handleGenerate = async () => {
    if (teams.length < 2) return;
    setGenerating(true);
    setError("");
    try {
      let seasonId: string | null = null;
      if (selectedCompId) {
        const seasonsRes = await fetch(`/api/competitions/${selectedCompId}/seasons`);
        const seasonsData = await seasonsRes.json();
        const existingSeasons: { id: string; is_current: boolean; status: string; name: string }[] =
          seasonsData.seasons || [];
        const current =
          existingSeasons.find((s) => s.is_current) ||
          existingSeasons.find((s) => s.status === "active") ||
          existingSeasons[0];
        if (current) {
          seasonId = current.id;
        } else {
          const createRes = await fetch(`/api/competitions/${selectedCompId}/seasons`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: new Date().getFullYear() + " Season",
              status: "active",
              is_current: true,
            }),
          });
          const createData = await createRes.json();
          seasonId = createData.season?.id || null;
        }
      }
      const body: Record<string, string> = {};
      if (selectedCompId) body.competition_id = selectedCompId;
      if (seasonId) body.season_id = seasonId;
      const res = await fetch(`/api/organizations/${slug}/generate-fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      const params = selectedOrgSeasonId
        ? `?org_season_id=${selectedOrgSeasonId}`
        : selectedCompId
          ? `?competition_id=${selectedCompId}`
          : "";
      const fres = await fetch(`/api/organizations/${slug}/fixtures${params}`);
      const fd = await fres.json();
      if (fd.fixtures?.length) {
        setFixtures(fd.fixtures);
      }
    } catch {
      setError("Failed to generate fixtures.");
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = async () => {
    if (
      !(await confirm({
        title: "Delete all fixtures?",
        description: "This cannot be undone.",
      }))
    )
      return;
    setResetting(true);
    setError("");
    try {
      const body: Record<string, string> = {};
      if (selectedCompId) body.competition_id = selectedCompId;
      const res = await fetch(`/api/organizations/${slug}/delete-fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setFixtures([]);
      prevFixturesRef.current = "";
      toast.success("All fixtures deleted.");
    } catch {
      setError("Failed to delete fixtures. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const hasFixtures = fixtures.length > 0;

  return (
    <div>
      {confirmDialog}
      {error && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {ctxIsOrgAdmin && selectedOrgSeasonId && !seasonLoading && !ctxHasFixtures && (
        <div className="mb-4">
          <SeasonEmptyState
            hasTeams={hasTeams}
            sheetHref={`/org/${slug}/teams`}
            fixturesHref={`/org/${slug}/fixtures`}
          />
        </div>
      )}

      {isAdmin && comps.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <label className="text-sm text-muted whitespace-nowrap">Competition:</label>
          <select
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="input text-sm sm:max-w-xs min-w-0 flex-1 sm:flex-none"
          >
            <option value="">All teams (no competition)</option>
            {comps.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {isAdmin && hasFixtures && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="btn-sm flex items-center gap-1.5 text-danger border border-danger/30 hover:bg-danger/10"
          >
            {resetting ? (
              <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
            ) : (
              <Trash2 size={14} />
            )}
            Reset Fixtures
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode("view")}
              className={`btn-sm flex items-center gap-1.5 ${viewMode === "view" ? "btn-primary" : "btn-ghost"}`}
            >
              <Eye size={14} /> View
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`btn-sm flex items-center gap-1.5 ${viewMode === "table" ? "btn-primary" : "btn-ghost"}`}
            >
              <Table2 size={14} /> Table
            </button>
            <button
              onClick={() => setViewMode("edit")}
              className={`btn-sm flex items-center gap-1.5 ${viewMode === "edit" ? "btn-primary" : "btn-ghost"}`}
            >
              <Pencil size={14} /> Edit
            </button>
          </div>
        </div>
      )}

      {viewMode === "edit" && isAdmin ? (
        <MatchEditor />
      ) : viewMode === "table" && isAdmin ? (
        <BulkScoreEntry />
      ) : (
        <>
          <FixtureList loading={loadingDb} />
          {!loadingDb && (
            <div className="mt-4 text-center">
              {hasFixtures ? (
                <div className="space-y-2">
                  <button disabled className="btn-primary opacity-50 cursor-not-allowed">
                    <Lock size={16} />
                    Fixtures Generated
                  </button>
                  <p className="text-sm text-muted">
                    Fixtures are saved and locked. Reset to regenerate.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || teams.length < 2}
                    className="btn-primary"
                  >
                    {generating ? (
                      <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                    Generate Fixtures
                  </button>
                  {teams.length < 2 && (
                    <p className="text-sm text-muted mt-2">
                      Need at least 2 teams to generate fixtures.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
