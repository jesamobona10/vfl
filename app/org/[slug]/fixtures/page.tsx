"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { useParams } from "next/navigation";
import { FixtureList } from "@/components/fixtures/fixture-list";
import { MatchEditor } from "@/components/admin/match-editor";
import { BulkScoreEntry } from "@/components/fixtures/bulk-score-entry";
import { RefreshCw, Pencil, Eye, Table2, AlertCircle, Trash2, Lock } from "lucide-react";

interface CompOption {
  id: string;
  name: string;
  type: string;
}

export default function OrgFixturesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);
  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const setFixtures = useAppStore((s) => s.setFixtures);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const userProfile = useAppStore((s) => s.userProfile);
  const isOrgAdmin = isAdmin || userProfile?.role === "org_admin";

  const [viewMode, setViewMode] = useState<"view" | "edit" | "table">("view");
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);
  const [comps, setComps] = useState<CompOption[]>([]);
  const [selectedCompId, setSelectedCompId] = useState<string>("");
  const [error, setError] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const prevFixturesRef = useRef("");

  useEffect(() => {
    if (!currentOrg?.id) return;
    setLoadingDb(true);
    fetch(`/api/competitions?org_id=${currentOrg.id}`)
      .then((r) => r.json())
      .then((data) => {
        const list: CompOption[] = (data.competitions || []).filter(
          (c: any) => c.type === "league"
        );
        setComps(list);
        const params = list.length === 1
          ? `?competition_id=${list[0].id}`
          : "";
        return fetch(`/api/organizations/${slug}/fixtures${params}`);
      })
      .then((r) => r.json())
      .then((d) => {
        if (d.fixtures?.length) {
          setFixtures(d.fixtures);
          prevFixturesRef.current = JSON.stringify(d.fixtures);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDb(false));
  }, [currentOrg?.id]);

  useEffect(() => {
    if (!fixtures.length || !currentOrg?.id) return;
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
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [fixtures]);

  const handleGenerate = async () => {
    if (teams.length < 2) return;
    setGenerating(true);
    setError("");
    try {
      let seasonId: string | null = null;
      if (selectedCompId) {
        const seasonsRes = await fetch(`/api/competitions/${selectedCompId}/seasons`);
        const seasonsData = await seasonsRes.json();
        const existingSeasons: { id: string; is_current: boolean; status: string; name: string }[] = seasonsData.seasons || [];
        const current = existingSeasons.find((s) => s.is_current) || existingSeasons.find((s) => s.status === "active") || existingSeasons[0];
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
      if (data.error) { setError(data.error); return; }

      const params = selectedCompId
        ? `?competition_id=${selectedCompId}`
        : "";
      const fres = await fetch(
        `/api/organizations/${slug}/fixtures${params}`
      );
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
    if (!window.confirm("Delete all fixtures? This cannot be undone.")) return;
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
      if (data.error) { setError(data.error); return; }
      setFixtures([]);
      prevFixturesRef.current = "";
    } catch {
      setError("Failed to delete fixtures.");
    } finally {
      setResetting(false);
    }
  };

  const hasFixtures = fixtures.length > 0;

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {isAdmin && comps.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-muted whitespace-nowrap">
            Competition:
          </label>
          <select
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="input text-sm max-w-xs"
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
        <div className="flex items-center justify-between gap-2 mb-4">
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
          <FixtureList />
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
