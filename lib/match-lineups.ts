import type { LineupSlot } from "@/lib/types";

export const MATCH_FORMATIONS: Record<string, Array<Omit<LineupSlot, "playerId">>> = {
  "4-3-3": [
    { slotId: "gk", label: "GK", position: "GK" },
    { slotId: "def1", label: "LB", position: "DEF" }, { slotId: "def2", label: "LCB", position: "DEF" },
    { slotId: "def3", label: "RCB", position: "DEF" }, { slotId: "def4", label: "RB", position: "DEF" },
    { slotId: "mid1", label: "CM", position: "MID" }, { slotId: "mid2", label: "LCM", position: "MID" },
    { slotId: "mid3", label: "RCM", position: "MID" },
    { slotId: "att1", label: "LW", position: "ATT" }, { slotId: "att2", label: "ST", position: "ATT" },
    { slotId: "att3", label: "RW", position: "ATT" },
  ],
  "4-4-2": [
    { slotId: "gk", label: "GK", position: "GK" },
    { slotId: "def1", label: "LB", position: "DEF" }, { slotId: "def2", label: "LCB", position: "DEF" },
    { slotId: "def3", label: "RCB", position: "DEF" }, { slotId: "def4", label: "RB", position: "DEF" },
    { slotId: "mid1", label: "LM", position: "MID" }, { slotId: "mid2", label: "LCM", position: "MID" },
    { slotId: "mid3", label: "RCM", position: "MID" }, { slotId: "mid4", label: "RM", position: "MID" },
    { slotId: "att1", label: "ST1", position: "ATT" }, { slotId: "att2", label: "ST2", position: "ATT" },
  ],
  "3-5-2": [
    { slotId: "gk", label: "GK", position: "GK" },
    { slotId: "def1", label: "LCB", position: "DEF" }, { slotId: "def2", label: "CB", position: "DEF" },
    { slotId: "def3", label: "RCB", position: "DEF" },
    { slotId: "mid1", label: "LM", position: "MID" }, { slotId: "mid2", label: "LCM", position: "MID" },
    { slotId: "mid3", label: "CM", position: "MID" }, { slotId: "mid4", label: "RCM", position: "MID" },
    { slotId: "mid5", label: "RM", position: "MID" },
    { slotId: "att1", label: "ST1", position: "ATT" }, { slotId: "att2", label: "ST2", position: "ATT" },
  ],
};

export const DEFAULT_MATCH_FORMATION = "4-3-3";

export function createMatchLineupSlots(formation: string): LineupSlot[] {
  return (MATCH_FORMATIONS[formation] || MATCH_FORMATIONS[DEFAULT_MATCH_FORMATION]).map((slot) => ({
    ...slot,
    playerId: null,
  }));
}
