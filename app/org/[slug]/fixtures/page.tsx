"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useOrg } from "@/lib/hooks/use-org";
import { useParams } from "next/navigation";
import { FixtureList } from "@/components/fixtures/fixture-list";
import { MatchEditor } from "@/components/admin/match-editor";
import { BulkScoreEntry } from "@/components/fixtures/bulk-score-entry";
import { RefreshCw, Save, Pencil, Eye, Table2 } from "lucide-react";

export default function OrgFixturesPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data: currentOrg } = useOrg(slug);
  const teams = useAppStore((s) => s.teams);
  const generateFixtures = useAppStore((s) => s.generateFixtures);
  const fixtures = useAppStore((s) => s.fixtures);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const [viewMode, setViewMode] = useState<"view" | "edit" | "table">("view");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dbFixtureCount, setDbFixtureCount] = useState<number | null>(null);
  const hasDbFixtures = dbFixtureCount !== null && dbFixtureCount > 0;

  useEffect(() => {
    if (!currentOrg?.id) return;
    fetch(`/api/competitions?org_id=${currentOrg.id}`)
      .then((r) => r.json())
      .then((data) => {
        const comps = data.competitions || [];
        const total = comps.reduce((sum: number, c: any) => sum + (c.fixtureCount || 0), 0);
        setDbFixtureCount(total);
      })
      .catch(() => setDbFixtureCount(0));
  }, [currentOrg?.id]);

  const handleGenerate = () => {
    if (teams.length < 2) return;
    setGenerating(true);
    setTimeout(() => {
      generateFixtures(teams);
      setGenerating(false);
    }, 100);
  };

  const handleSaveToDb = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/sync/fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtures }),
      });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      setDbFixtureCount(fixtures.reduce((sum, r) => sum + r.matches.length, 0));
      alert("Fixtures saved to database successfully.");
    } catch { alert("Failed to save fixtures."); }
    finally { setSaving(false); }
  };

  return (
    <div>
      {isAdmin && fixtures.length > 0 && (
        <div className="flex items-center justify-end gap-2 mb-4">
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
      )}

      {viewMode === "edit" && isAdmin ? (
        <>
          <MatchEditor />
          <div className="mt-4 flex justify-center">
            <button onClick={handleSaveToDb} disabled={saving} className="btn-primary">
              {saving ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : <Save size={16} />}
              Save to Database
            </button>
          </div>
        </>
      ) : viewMode === "table" && isAdmin ? (
        <>
          <BulkScoreEntry />
          <div className="mt-4 flex justify-center">
            <button onClick={handleSaveToDb} disabled={saving} className="btn-primary">
              {saving ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : <Save size={16} />}
              Save to Database
            </button>
          </div>
        </>
      ) : (
        <>
          <FixtureList />
          {fixtures.length === 0 && !hasDbFixtures && (
            <div className="mt-4 text-center">
              <button onClick={handleGenerate} disabled={generating || teams.length < 2} className="btn-primary">
                {generating ? <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" /> : <RefreshCw size={16} />}
                Generate Fixtures
              </button>
              {teams.length < 2 && <p className="text-sm text-muted mt-2">Need at least 2 teams to generate fixtures.</p>}
            </div>
          )}
          {fixtures.length === 0 && hasDbFixtures && (
            <div className="mt-4 text-center">
              <p className="text-sm text-muted">Fixtures have already been generated and saved to the database.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
