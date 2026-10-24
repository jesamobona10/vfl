"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CalendarPlus, Zap } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCan } from "@/lib/hooks/use-can";
import { FixtureList } from "@/components/fixtures/fixture-list";
import { useCompetition, useGenerateFixtures, useSeasons } from "@/lib/hooks/use-competitions";
import { useSeasonHasFixtures } from "@/lib/hooks/use-competition-stats";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import type { CompleteSchedulePreview } from "@/lib/types";

export default function CompFixturesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cId = params.cId as string;
  const slug = params.slug as string;
  const seasonIdParam = searchParams.get("seasonId");
  const setFixtures = useAppStore((s) => s.setFixtures);
  const { allowed: canEdit } = useCan("fixtures.edit");
  const { success: toastSuccess, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [gamesPerTeam, setGamesPerTeam] = useState(1);
  const requestId = useRef(0);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [preview, setPreview] = useState<CompleteSchedulePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { data: competition } = useCompetition(cId);
  const isFriendly = competition?.type === "friendly";
  const { data: seasons = [] } = useSeasons(competition?.id);
  const seasonId = useMemo(
    () => seasonIdParam || seasons.find((s) => s.is_current)?.id || seasons[0]?.id || null,
    [seasonIdParam, seasons]
  );

  const generateFixtures = useGenerateFixtures();
  const { data: hasFixtures, isLoading: checkingFixtures } = useSeasonHasFixtures(
    seasonId ?? undefined
  );

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
      await generateFixtures.mutateAsync({
        competitionId: cId,
        seasonId,
        gamesPerTeam: isFriendly ? gamesPerTeam : undefined,
      });
      toastSuccess("Fixtures generated successfully!");
      await loadFixtures();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to generate fixtures");
    }
  };

  const generateDisabled =
    generateFixtures.isPending || !seasonId || checkingFixtures || hasFixtures === true;

  const openCompletePreview = async () => {
    if (!seasonId) return;
    setCompleteOpen(true);
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const data = await generateFixtures.mutateAsync({
        competitionId: cId,
        seasonId,
        mode: "complete",
        dryRun: true,
      } as any);
      setPreview(data as CompleteSchedulePreview);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed to load completion preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmComplete = async () => {
    if (!seasonId) return;
    setConfirmLoading(true);
    try {
      const res = (await generateFixtures.mutateAsync({
        competitionId: cId,
        seasonId,
        mode: "complete",
      } as any)) as CompleteSchedulePreview;
      const inserted = res.insertedCount ?? res.matchesCount ?? 0;
      toastSuccess(inserted === 0 ? "Schedule already complete." : `Added ${inserted} fixture${inserted === 1 ? "" : "s"}.`);
      setCompleteOpen(false);
      setPreview(null);
      await loadFixtures();
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Failed to complete schedule");
    } finally {
      setConfirmLoading(false);
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
          <div className="flex flex-wrap items-end gap-2">
            {isFriendly && (
              <Input
                type="number"
                min={1}
                max={99}
                label="Games per team"
                value={gamesPerTeam}
                onChange={(e) => setGamesPerTeam(Math.max(1, Number(e.target.value) || 1))}
                disabled={generateDisabled || undefined}
                containerClassName="w-32"
              />
            )}
            {canEdit && hasFixtures && competition?.type === "league" ? (
              <Button
                onClick={() => void openCompletePreview()}
                loading={previewLoading && completeOpen}
                disabled={!seasonId || checkingFixtures}
                variant="secondary"
                size="sm"
                leftIcon={<CalendarPlus size={14} />}
              >
                Complete schedule (single leg)
              </Button>
            ) : (
              <Button
                onClick={handleGenerateFixtures}
                loading={generateFixtures.isPending}
                disabled={generateDisabled}
                title={
                  hasFixtures
                    ? "Fixtures have already been generated for this season. Delete them first to regenerate."
                    : undefined
                }
                variant="secondary"
                size="sm"
                leftIcon={<Zap size={14} />}
              >
                {hasFixtures ? "Fixtures Generated" : isFriendly ? "Generate Games" : "Generate Fixtures"}
              </Button>
            )}
          </div>
        )}
      </div>

      <FixtureList
        loading={loading}
        competitionId={cId}
        seasonId={seasonId}
        showCreator
        onFixtureCreated={loadFixtures}
      />

      <Modal
        open={completeOpen}
        onClose={() => {
          if (confirmLoading) return;
          setCompleteOpen(false);
          setPreview(null);
          setPreviewError(null);
        }}
        title="Complete schedule (single leg)"
        subtitle="Matchday 1 is kept as entered. Only missing pairs will be added."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setCompleteOpen(false)} disabled={confirmLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void confirmComplete()}
              loading={confirmLoading}
              disabled={previewLoading || confirmLoading || !preview || (preview.matchesCount ?? 0) === 0}
            >
              {(preview?.matchesCount ?? 0) === 0 ? "Schedule complete" : `Confirm and add ${preview?.matchesCount ?? 0} fixture${(preview?.matchesCount ?? 0) === 1 ? "" : "s"}`}
            </Button>
          </div>
        }
      >
        {previewLoading && <p className="text-sm text-muted">Computing schedule...</p>}
        {previewError && <p className="text-sm text-danger">{previewError}</p>}
        {preview && !previewLoading && (
          <div className="space-y-4">
            <p className="text-xs text-muted">
              {preview.existingCount ?? 0} existing · {preview.matchesCount ?? 0} to add across {preview.roundsCount ?? preview.rounds.length} rounds
            </p>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {preview.rounds.map((round) => (
                <div key={round.round} className="rounded-xl border border-line">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <p className="text-sm font-semibold">Round {round.round}</p>
                    {round.round === 1 && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold text-brand">Kept as entered</span>}
                  </div>
                  <div className="divide-y divide-line/60">
                    {round.matches.map((match, idx) => (
                      <div key={`${match.homeTeamId}-${match.awayTeamId}-${idx}`} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="truncate">
                          {match.homeTeamName} <span className="text-muted">vs</span> {match.awayTeamName}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] ${match.existing ? "bg-surface-2 text-muted" : "bg-brand/10 text-brand"}`}>
                          {match.existing ? "Existing" : "New"}
                        </span>
                      </div>
                    ))}
                    {round.byeTeamName && <div className="px-3 py-2 text-xs text-muted">Bye: {round.byeTeamName}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
