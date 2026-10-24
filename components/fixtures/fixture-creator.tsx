"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useCan } from "@/lib/hooks/use-can";
import { useResolvedTeams } from "@/lib/hooks/use-resolved-teams";
import { Plus, AlertCircle, CheckCircle } from "lucide-react";
import { TimeInput } from "../shared/time-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useSeasonTeams } from "@/lib/hooks/use-competitions";
import { Modal } from "@/components/ui/modal";

interface FixtureCreatorProps {
  /**
   * When a competition is supplied the fixture is written through the API so it
   * survives a reload. Without it the creator falls back to the shared store,
   * which the org fixtures page persists via its own autosave.
   */
  competitionId?: string;
  seasonId?: string | null;
  onCreated?: () => void;
}

export function FixtureCreator({
  competitionId,
  seasonId,
  onCreated,
}: FixtureCreatorProps = {}) {
  const [open, setOpen] = useState(false);
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [round, setRound] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const currentSeasonId = useAppStore((s) => s.currentSeasonId);
  const storeTeams = useResolvedTeams(currentSeasonId);
  const { data: seasonTeams } = useSeasonTeams(seasonId ?? undefined);
  const { allowed: canGenerate } = useCan("fixtures.generate");
  const { allowed: canEditFixtures } = useCan("fixtures.edit");
  const slug = useParams().slug as string | undefined;
  const persistToServer = Boolean(competitionId && seasonId);
  const teams =
    persistToServer && seasonTeams?.length
      ? seasonTeams.map((st: any) => ({ id: st.team_id ?? st.team?.id, name: st.team?.name ?? st.display_name ?? st.name }))
      : storeTeams;
  const fixtures = useAppStore((s) => s.fixtures);
  const addFixture = useAppStore((s) => s.addFixture);
  const [submitting, setSubmitting] = useState(false);
  const resetForm = () => {
    setHomeId("");
    setAwayId("");
    setRound("");
    setDate("");
    setTime("");
    setVenue("");
  };

  const handleSubmit = async () => {
    setError("");
    setSuccess("");

    if (persistToServer) {
      if (!seasonId) {
        setError("Select a season before adding a fixture.");
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch(
          `/api/organizations/${slug}/competitions/${competitionId}/fixtures`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              season_id: seasonId,
              home_team_id: Number(homeId),
              away_team_id: Number(awayId),
              // "Auto" mirrors the store path: append to the last round.
              round:
                Number(round) ||
                (fixtures.length ? Math.max(...fixtures.map((r) => r.round)) + 1 : 1),
              date: date || null,
              time: time || null,
              venue: venue || null,
            }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error || "Failed to create fixture");
          return;
        }
        resetForm();
        setSuccess("Fixture added successfully.");
        onCreated?.();
        setTimeout(() => setSuccess(""), 3000);
        setTimeout(() => {
          setOpen(false);
          setSuccess("");
        }, 600);
      } catch {
        setError("Failed to create fixture. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const result = addFixture(
      {
        homeId: Number(homeId),
        awayId: Number(awayId),
        round: round ? Number(round) : undefined,
        date: date || undefined,
        time: time || undefined,
        venue: venue || undefined,
      },
      teams
    );

    if (result.error) {
      setError(result.error);
      return;
    }

    resetForm();
    setSuccess("Fixture added successfully.");
    // Ensure store changes are persisted even if autosave hasn't fired yet
    try {
      const current = useAppStore.getState().fixtures;
      if (current.length > 0) {
        await fetch("/api/sync/fixtures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtures: current }),
        });
      }
    } catch {
      // ignore
    }
    onCreated?.();
    setTimeout(() => setSuccess(""), 3000);
    setTimeout(() => {
      setOpen(false);
      setSuccess("");
    }, 600);
  };

  if (!canGenerate && !canEditFixtures) return null;

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          setError("");
          setSuccess("");
          resetForm();
        }}
        variant="primary"
        size="sm"
        leftIcon={<Plus size={16} />}
      >
        Add Fixture
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Fixture"
        subtitle="Add a single match to this competition season"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={() => void handleSubmit()} loading={submitting} disabled={submitting}>
              {submitting ? "Adding..." : "Add Fixture"}
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fc-home" className="block text-sm font-medium mb-1">
              Home Team
            </label>
            <Select id="fc-home" value={homeId} onChange={(e) => setHomeId(e.target.value)}>
              <option value="">Select home team</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="fc-away" className="block text-sm font-medium mb-1">
              Away Team
            </label>
            <Select id="fc-away" value={awayId} onChange={(e) => setAwayId(e.target.value)}>
              <option value="">Select away team</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="fc-round" className="block text-sm font-medium mb-1">
              Round
            </label>
            <Select id="fc-round" value={round} onChange={(e) => setRound(e.target.value)}>
              <option value="">Auto (next available)</option>
              {fixtures.map((r: any) => (
                <option key={r.round} value={r.round}>
                  Round {r.round}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="fc-date" className="block text-sm font-medium mb-1">
              Date
            </label>
            <Input id="fc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="fc-time" className="block text-sm font-medium mb-1">
              Time
            </label>
            <TimeInput value={time} onChange={setTime} label="Kickoff time" />
          </div>
          <div>
            <label htmlFor="fc-venue" className="block text-sm font-medium mb-1">
              Venue
            </label>
            <Input id="fc-venue" type="text" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Main pitch" />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mt-4">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-sm text-brand bg-brand/10 rounded-lg px-3 py-2 mt-4">
            <CheckCircle size={16} />
            {success}
          </div>
        )}
      </Modal>
    </>
  );
}
