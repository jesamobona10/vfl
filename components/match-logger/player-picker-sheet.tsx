"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Player } from "@/lib/types";
import { eventTypeLabel } from "@/lib/logic/events";
import { cn } from "@/lib/utils";
import { TactileKey } from "./tactile-key";
import styles from "./match-logger.module.css";

export interface PickerConfirmPayload {
  playerId: number;
  assistPlayerId?: number;
  minute?: number;
}

function PlayerGrid({
  players,
  selectedId,
  onSelect,
}: {
  players: Player[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  if (players.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--ml-muted)]">
        No players on this team.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
      {players.map((p) => {
        const active = p.id === selectedId;
        return (
          <button
            type="button"
            key={p.id}
            onClick={() => onSelect(p.id)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5 text-center transition-colors",
              active
                ? "border-[var(--ml-gold)] bg-[var(--ml-gold)]/15"
                : "border-[var(--ml-line)] bg-[var(--ml-surface-3)]"
            )}
          >
            <span
              className={cn(
                "text-lg leading-none text-[var(--ml-gold)]",
                styles.display
              )}
            >
              {p.number}
            </span>
            <span className="line-clamp-2 text-xs font-medium text-[var(--ml-text)]">
              {p.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MinuteStepper({
  minute,
  onChange,
}: {
  minute: number;
  onChange: (minute: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--ml-surface-2)] px-3 py-2">
      <span className="text-sm font-medium text-[var(--ml-muted)]">Minute</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Decrease minute"
          onClick={() => onChange(Math.max(0, minute - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ml-surface-3)] text-[var(--ml-text)]"
        >
          <Minus size={16} />
        </button>
        <span className={cn("w-8 text-center text-xl text-[var(--ml-text)]", styles.display)}>
          {minute}
        </span>
        <button
          type="button"
          aria-label="Increase minute"
          onClick={() => onChange(Math.min(150, minute + 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--ml-surface-3)] text-[var(--ml-text)]"
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Bottom sheet for choosing the player (and optional assist) for an event
 * (guide §4, screen 3). Goals take two steps: scorer, then assist.
 */
export function PlayerPickerSheet({
  open,
  eventType,
  teamName,
  players,
  defaultMinute,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  eventType: string | null;
  teamName: string;
  players: Player[];
  defaultMinute: number;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: PickerConfirmPayload) => void;
}) {
  const needsAssist = eventType === "goal";
  const [step, setStep] = useState<"player" | "assist">("player");
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [assistId, setAssistId] = useState<number | null>(null);
  const [minute, setMinute] = useState(defaultMinute);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !eventType) return null;

  const title = step === "assist" ? "Assist (optional)" : eventTypeLabel(eventType);
  const canConfirm = step === "assist" || playerId != null;

  const submit = () => {
    if (step === "player" && needsAssist && playerId != null) {
      setStep("assist");
      return;
    }
    if (playerId == null) return;
    onConfirm({
      playerId,
      assistPlayerId: assistId ?? undefined,
      minute,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Log ${eventTypeLabel(eventType)} for ${teamName}`}
        className="relative max-h-[85dvh] overflow-hidden rounded-t-3xl border-t border-[var(--ml-line)] bg-[var(--ml-surface)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--ml-line)]" />
        <div className="flex items-center justify-between px-4 pt-3">
          <div className="min-w-0">
            <h2 className={cn("truncate text-lg text-[var(--ml-text)]", styles.display)}>
              {title}
            </h2>
            <p className="truncate text-xs text-[var(--ml-muted)]">
              {teamName}
              {step === "assist" && " · pass before the goal"}
            </p>
          </div>
          {step === "assist" && (
            <button
              type="button"
              onClick={() => setStep("player")}
              className="shrink-0 text-xs font-semibold text-[var(--ml-muted)] underline"
            >
              Back
            </button>
          )}
        </div>

        <div className="mt-3 max-h-[46dvh] space-y-3 overflow-y-auto px-4">
          <MinuteStepper minute={minute} onChange={setMinute} />
          <PlayerGrid
            players={players}
            selectedId={step === "assist" ? assistId : playerId}
            onSelect={step === "assist" ? setAssistId : setPlayerId}
          />
        </div>

        <div className="flex gap-2.5 px-4 pb-4 pt-3">
          <TactileKey
            onClick={onClose}
            edge="#0A1710"
            className="h-14 flex-1 bg-[var(--ml-surface-2)] text-sm text-[var(--ml-muted)]"
          >
            Cancel
          </TactileKey>
          <TactileKey
            onClick={submit}
            disabled={!canConfirm || submitting}
            edge="#074D2B"
            ariaLabel={
              step === "assist" ? "Confirm event" : `Choose ${eventTypeLabel(eventType)} player`
            }
            className="h-14 flex-[2] text-base text-[color:#EAF4EC]"
            style={{
              background: "linear-gradient(180deg, var(--ml-green-hi), var(--ml-green))",
            }}
          >
            {step === "assist" ? (assistId ? "Confirm" : "Skip assist") : "Next"}
          </TactileKey>
        </div>
      </div>
    </div>
  );
}
