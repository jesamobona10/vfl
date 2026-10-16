/**
 * Banner shown on Overview when a champion is determined.
 */
import { Trophy, Sparkles } from "lucide-react";
import type { Champion } from "@/lib/celebration/winner";
import { useState } from "react";
import { ChampionCelebration } from "./champion-celebration";

interface Props {
  champion: Champion | null;
  accent?: string | null;
}

export function ChampionBanner({ champion, accent }: Props) {
  const [open, setOpen] = useState(false);

  if (!champion) return null;

  return (
    <>
      <div className="relative overflow-hidden card p-5 border-l-4" style={{ borderLeftColor: accent || "#0f7c45" }}>
        <div className="absolute inset-0 bg-gradient-to-r from-brand-50/60 to-transparent pointer-events-none" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="shrink-0 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <Trophy size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted">
                {champion.subtitle}
              </div>
              <div className="mt-0.5 text-lg sm:text-xl font-bold truncate">
                {champion.name} — Champions
              </div>
              <div className="text-sm text-muted truncate">{champion.detail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-primary inline-flex items-center gap-2 shrink-0"
          >
            <Sparkles size={16} />
            Celebrate
          </button>
        </div>
      </div>
      <ChampionCelebration
        open={open}
        onClose={() => setOpen(false)}
        champion={champion}
        accent={accent}
      />
    </>
  );
}
