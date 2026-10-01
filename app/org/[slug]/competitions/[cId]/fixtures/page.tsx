"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { FixtureList } from "@/components/fixtures/fixture-list";
import { useCompetition, useGenerateFixtures, useSeasons } from "@/lib/hooks/use-competitions";
import { useToast } from "@/components/ui/toast";

export default function CompFixturesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonIdParam = searchParams.get("seasonId");
  const setFixtures = useAppStore((s) => s.setFixtures);
  const userProfile = useAppStore((s) => s.userProfile);
  const isAdmin = useAppStore((s) => s.isAdmin);
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);

  const { data: competition } = useCompetition(cId);
  const { data: seasons = [] } = useSeasons(competition?.id);
  const seasonId = useMemo(
    () => seasonIdParam || seasons.find((s) => s.is_current)?.id || seasons[0]?.id || null,
    [seasonIdParam, seasons]
  );

  const generateFixtures = useGenerateFixtures();
  const canEdit = isAdmin || userProfile?.role === "org_admin";

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ competition_id: cId });
    if (seasonId) query.set("season_id", seasonId);

    fetch(`/api/organizations/${slug}/fixtures?${query.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.fixtures?.length) {
          setFixtures(data.fixtures);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, cId, seasonId]);

  const handleGenerateFixtures = async () => {
    if (!seasonId) return;
    try {
      await generateFixtures.mutateAsync({ competitionId: cId, seasonId });
      toastSuccess("Fixtures generated successfully!");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to generate fixtures");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Fixtures</h2>
          <p className="text-sm text-muted">Manage upcoming and scheduled matches</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/org/${slug}/competitions/${cId}/fixtures/new${seasonId ? `?seasonId=${seasonId}` : ""}`}
              className="btn btn-primary btn-sm"
            >
              <Plus size={14} />
              Add Fixture
            </Link>
            <button
              onClick={handleGenerateFixtures}
              disabled={generateFixtures.isPending || !seasonId}
              className="btn btn-secondary btn-sm"
            >
              {generateFixtures.isPending ? (
                <span className="block w-3.5 h-3.5 bg-surface-2 rounded animate-pulse" />
              ) : (
                <Zap size={14} />
              )}
              Generate Fixtures
            </button>
          </div>
        )}
      </div>

      <FixtureList loading={loading} />
    </div>
  );
}