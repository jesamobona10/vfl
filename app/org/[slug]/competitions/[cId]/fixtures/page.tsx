"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Zap } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { FixtureList } from "@/components/fixtures/fixture-list";
import { useCompetition, useGenerateFixtures, useSeasons } from "@/lib/hooks/use-competitions";
import { useSeasonHasFixtures } from "@/lib/hooks/use-competition-stats";
import { useToast } from "@/components/ui/toast";

export default function CompFixturesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cId = params.cId as string;
  const slug = params.slug as string;
  const seasonIdParam = searchParams.get("seasonId");
  const setFixtures = useAppStore((s) => s.setFixtures);
  const userProfile = useAppStore((s) => s.userProfile);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const { data: competition } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(competition?.id);
  const seasonId = useMemo(
    () => seasonIdParam || seasons.find((s) => s.is_current)?.id || seasons[0]?.id || null,
    [seasonIdParam, seasons]
  );

  const generateFixtures = useGenerateFixtures();
  const { data: hasFixtures, isLoading: checkingFixtures } = useSeasonHasFixtures(
    seasonId ?? undefined
  );
  const canEdit = isAdmin || userProfile?.role === "org_admin";

  const loadFixtures = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setFixtures([]);
    const query = new URLSearchParams({ competition_id: cId });
    if (seasonId) query.set("season_id", seasonId);

    try {
      const res = await fetch(`/api/organizations/${slug}/fixtures?${query.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (currentRequest === requestId.current) {
        setFixtures(Array.isArray(data.fixtures) ? data.fixtures : []);
      }
    } catch {
      // The list was cleared above so a failed request cannot show another season.
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [slug, cId, seasonId, setFixtures]);

  useEffect(() => {
    void loadFixtures();
  }, [loadFixtures]);

  const handleGenerateFixtures = async () => {
    if (!seasonId) return;
    try {
      await generateFixtures.mutateAsync({ competitionId: cId, seasonId });
      toastSuccess("Fixtures generated successfully!");
      await loadFixtures();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to generate fixtures");
    }
  };

  const generateDisabled =
    generateFixtures.isPending || !seasonId || checkingFixtures || hasFixtures === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Fixtures</h2>
          <p className="text-sm text-muted">Manage upcoming and scheduled matches</p>
        </div>
        {canEdit && (
          <button
            onClick={handleGenerateFixtures}
            disabled={generateDisabled}
            title={
              hasFixtures
                ? "Fixtures have already been generated for this season. Delete them first to regenerate."
                : undefined
            }
            className="btn btn-secondary btn-sm"
          >
            {generateFixtures.isPending ? (
              <span className="block w-3.5 h-3.5 bg-surface-2 rounded animate-pulse" />
            ) : (
              <Zap size={14} />
            )}
            {hasFixtures ? "Fixtures Generated" : "Generate Fixtures"}
          </button>
        )}
      </div>

      <FixtureList
        loading={loading}
        competitionId={cId}
        seasonId={seasonId}
        onFixtureCreated={loadFixtures}
      />
    </div>
  );
}
