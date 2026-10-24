"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, LoaderCircle, ShieldCheck, Users, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { MATCH_FORMATIONS, createMatchLineupSlots, DEFAULT_MATCH_FORMATION } from "@/lib/match-lineups";
import { useToast } from "@/components/ui/toast";
import type { LineupSlot } from "@/lib/types";

type Player = { id: number; name: string | null; jersey_number: number | null; photo_url?: string | null; position?: string | null };
type Team = { id: number; name: string; logo_url?: string | null };
export type FixtureLineup = {
  id: string; team_id: number; formation: string; status: "pending" | "approved" | "rejected";
  starting_xi: (Omit<LineupSlot, "playerId"> & { playerId?: number; player: Player | null })[]; substitutes: Player[]; review_note?: string | null;
};

function PlayerChip({ player, label }: { player: Player | null; label: string }) {
  return <div className="flex min-w-0 flex-col items-center gap-1 text-center" title={player?.name || label}>
    <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white text-[11px] font-bold text-ink-1 shadow sm:h-9 sm:w-9">
      {player?.photo_url ? <img src={player.photo_url} alt="" className="h-full w-full object-cover" /> : player?.jersey_number ?? "·"}
    </div>
    <span className="max-w-[76px] truncate rounded bg-black/40 px-1 py-0.5 text-[9px] font-semibold leading-tight text-white sm:max-w-[96px] sm:text-[10px]">{player?.name || (player?.jersey_number ? `No. ${player.jersey_number}` : label)}</span>
  </div>;
}

export function MatchLineupsDisplay({ teams, lineups }: { teams: Team[]; lineups: FixtureLineup[] }) {
  if (lineups.length === 0) return null;
  return <div className="grid gap-4 md:grid-cols-2">
    {teams.map((team) => {
      const lineup = lineups.find((item) => item.team_id === team.id);
      if (!lineup) return null;
      const rows: LineupSlot["position"][] = ["ATT", "MID", "DEF", "GK"];
      return <article key={team.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">{team.logo_url ? <img src={team.logo_url} alt="" className="h-7 w-7 rounded-full object-cover" /> : null}<strong className="truncate text-sm">{team.name}</strong></div>
          <span className="rounded-full bg-brand/10 px-2 py-1 text-[11px] font-bold text-brand">{lineup.formation}</span>
        </header>
        <div className="relative mx-3 my-3 overflow-hidden rounded-xl border border-white/30 bg-emerald-700 px-2 py-5">
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent 0 44px, rgba(255,255,255,.5) 45px 46px)" }} />
          <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/50" />
          <div className="absolute left-1/2 top-0 h-8 w-32 -translate-x-1/2 rounded-b-lg border border-t-0 border-white/50" />
          <div className="absolute bottom-0 left-1/2 h-8 w-32 -translate-x-1/2 rounded-t-lg border border-b-0 border-white/50" />
          <div className="relative z-10 flex min-h-[245px] flex-col justify-between gap-3">
            {rows.map((position) => <div key={position} className="flex items-center justify-center gap-2 sm:gap-4">
              {lineup.starting_xi.filter((slot) => slot.position === position).map((slot) => <PlayerChip key={slot.slotId} player={slot.player} label={slot.label} />)}
            </div>)}
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-3"><Users size={13} /> Substitutes ({lineup.substitutes.length})</div>
          {lineup.substitutes.length ? <div className="flex flex-wrap gap-x-3 gap-y-2">{lineup.substitutes.map((player) => <div key={player.id} className="flex items-center gap-2 text-xs"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 font-bold">{player.jersey_number ?? "·"}</span><span>{player.name || `No. ${player.jersey_number ?? "—"}`}</span></div>)}</div> : <p className="text-xs text-muted">No substitutes listed</p>}
        </div>
      </article>;
    })}
  </div>;
}

export function FixtureLineupsModal({ fixtureId, open, onClose }: { fixtureId: number; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formation, setFormation] = useState(DEFAULT_MATCH_FORMATION);
  const [slots, setSlots] = useState<LineupSlot[]>(createMatchLineupSlots(DEFAULT_MATCH_FORMATION));
  const [substitutes, setSubstitutes] = useState<number[]>([]);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/lineups`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load fixture lineups.");
      setData(body);
      const mine = (body.lineups || []).find((lineup: FixtureLineup) => lineup.team_id === body.canSubmitTeamId);
      if (mine) { setFormation(mine.formation); setSlots(mine.starting_xi.map(({ player, ...slot }: any) => ({ ...slot, playerId: slot.playerId ?? player?.id ?? null }))); setSubstitutes(mine.substitutes.map((player: Player) => player.id)); }
      else { setFormation(DEFAULT_MATCH_FORMATION); setSlots(createMatchLineupSlots(DEFAULT_MATCH_FORMATION)); setSubstitutes([]); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load fixture lineups."); }
    finally { setLoading(false); }
  }, [fixtureId]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const roster: Player[] = data?.roster || [];
  const selectedIds = useMemo(() => new Set(slots.map((slot) => slot.playerId).filter((id): id is number => id != null)), [slots]);
  const teamLineups: FixtureLineup[] = useMemo(() => (data?.lineups || []).map((lineup: FixtureLineup) => lineup), [data]);

  function changeFormation(value: string) {
    setFormation(value); setSlots(createMatchLineupSlots(value));
  }
  function setStarter(slotId: string, playerId: number | null) {
    setSlots((current) => current.map((slot) => slot.slotId === slotId ? { ...slot, playerId } : slot));
  }
  function toggleSubstitute(playerId: number) {
    setSubstitutes((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : current.length >= 12 ? current : [...current, playerId]);
  }

  async function submit() {
    if (slots.some((slot) => slot.playerId == null)) { setError("Select a player for every starting position."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/lineups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ formation, starting_xi: slots, substitutes }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to submit lineup.");
      toast.success("Lineup submitted for organization/FA verification."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit lineup."); }
    finally { setSaving(false); }
  }

  async function review(lineupId: string, status: "approved" | "rejected") {
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/fixtures/${fixtureId}/lineups`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineupId, status, reviewNote }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Unable to review lineup.");
      toast.success(status === "approved" ? "Lineup approved and made public." : "Lineup returned to the coach."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to review lineup."); }
    finally { setSaving(false); }
  }

  const kickoffLabel = data?.fixture?.date && data?.fixture?.time ? `${data.fixture.date} · ${data.fixture.time}` : "Kickoff time not set";
  const mine = teamLineups.find((lineup) => lineup.team_id === data?.canSubmitTeamId);

  return <Modal open={open} onClose={onClose} title="Match lineups" subtitle={kickoffLabel} className="max-w-5xl">
    <div className="space-y-5">
      {data?.canSubmitTeamId && <section className="rounded-xl border border-line bg-surface-2/20 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Submit your team lineup</h3><p className="mt-1 text-xs text-muted">Opens two hours before kickoff. The organization or FA must approve it before it appears publicly.</p></div>{mine && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${mine.status === "approved" ? "bg-brand/10 text-brand" : mine.status === "pending" ? "bg-warn-500/10 text-warn-500" : "bg-danger/10 text-danger"}`}>{mine.status}</span>}</div>
        {data.canSubmit ? <div className="space-y-4">
          <label className="block text-sm font-medium">Formation<select value={formation} onChange={(event) => changeFormation(event.target.value)} className="input mt-1 w-full">{Object.keys(MATCH_FORMATIONS).map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{slots.map((slot) => <label key={slot.slotId} className="text-xs font-medium text-ink-2">{slot.label}<select value={slot.playerId ?? ""} onChange={(event) => setStarter(slot.slotId, event.target.value ? Number(event.target.value) : null)} className="input mt-1 w-full"><option value="">Choose player</option>{roster.filter((player) => !selectedIds.has(player.id) || player.id === slot.playerId).map((player) => <option key={player.id} value={player.id}>{player.jersey_number != null ? `#${player.jersey_number} · ` : ""}{player.name}</option>)}</select></label>)}</div>
          <div><h4 className="mb-2 text-sm font-semibold">Substitutes <span className="text-xs font-normal text-muted">({substitutes.length}/12)</span></h4><div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{roster.filter((player) => !selectedIds.has(player.id)).map((player) => <label key={player.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={substitutes.includes(player.id)} onChange={() => toggleSubstitute(player.id)} disabled={!substitutes.includes(player.id) && substitutes.length >= 12} />{player.jersey_number != null ? `#${player.jersey_number} · ` : ""}{player.name}</label>)}</div></div>
          {roster.length < 11 && <p className="text-sm text-warn-500">Your team roster needs at least 11 players to submit a lineup.</p>}
          <button type="button" onClick={() => void submit()} disabled={saving || roster.length < 11} className="btn btn-primary w-full">{saving ? "Submitting…" : mine ? "Update and resubmit lineup" : "Submit lineup for verification"}</button>
        </div> : <div className="flex items-start gap-2 rounded-lg bg-surface p-3 text-sm text-ink-3"><Clock3 size={17} className="mt-0.5 shrink-0" /><span>{mine?.status === "pending" ? "Submitted and awaiting verification." : mine?.status === "approved" ? "Verified lineup is public." : `Lineup submission opens at ${data.opensAt ? new Date(data.opensAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "two hours before kickoff"}.`}</span></div>}
        {mine?.review_note && <p className="mt-2 text-xs text-danger">Reviewer note: {mine.review_note}</p>}
      </section>}
      {data?.canReview && teamLineups.some((lineup) => lineup.status === "pending") && <section className="space-y-3 rounded-xl border border-brand/20 bg-brand/5 p-4"><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck size={17} /> Pending verification</h3>{teamLineups.filter((lineup) => lineup.status === "pending").map((lineup) => <div key={lineup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-3"><div><p className="text-sm font-semibold">{data.teams.find((team: Team) => team.id === lineup.team_id)?.name} · {lineup.formation}</p><p className="text-xs text-muted">11 starters · {lineup.substitutes.length} substitutes</p></div><div className="flex items-center gap-2"><button type="button" disabled={saving} onClick={() => void review(lineup.id, "rejected")} className="btn text-danger"><X size={14} /> Return</button><button type="button" disabled={saving} onClick={() => void review(lineup.id, "approved")} className="btn btn-primary"><Check size={14} /> Verify & publish</button></div></div>)}<input value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={500} placeholder="Optional note for the coach" className="input w-full" /></section>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {loading ? <div className="flex justify-center p-8"><LoaderCircle className="animate-spin text-muted" /></div> : data && <MatchLineupsDisplay teams={data.teams || []} lineups={teamLineups.filter((lineup) => data.canReview || lineup.status === "approved" || lineup.team_id === data.canSubmitTeamId)} />}
      {!loading && data && teamLineups.length === 0 && !data.canSubmitTeamId && <p className="rounded-xl bg-surface-2/30 p-5 text-center text-sm text-muted">No team lineups have been submitted yet.</p>}
    </div>
  </Modal>;
}
