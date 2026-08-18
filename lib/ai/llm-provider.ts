export type ExtractionEventType = "GOAL" | "OWN_GOAL" | "PENALTY_GOAL" | "YELLOW_CARD" | "RED_CARD";

export const EXTRACTION_EVENT_TYPES: ExtractionEventType[] = [
  "GOAL",
  "OWN_GOAL",
  "PENALTY_GOAL",
  "YELLOW_CARD",
  "RED_CARD",
];

export interface ExtractedPlayerRef {
  name: string;
  jerseyNumber?: number | null;
}

export interface MinuteInference {
  text: string;
  confidence: number;
  requiresReview: boolean;
}

export interface ExtractedEvent {
  type: ExtractionEventType;
  minute: number | null;
  addedTime?: number | null;
  minuteInference?: MinuteInference | null;
  player: ExtractedPlayerRef;
  unlisted?: boolean;
  assist?: ExtractedPlayerRef | null;
  assistStatus?: "CLEAR" | "NONE" | "UNCLEAR";
  confidence: number;
  evidence: string;
}

export interface ExtractionPayload {
  homeScore: number | null;
  awayScore: number | null;
  events: ExtractedEvent[];
  warnings: string[];
}

export interface MatchContextPlayer {
  id: number;
  name: string;
  teamId: number;
  jerseyNumber: number | null;
}

export interface MatchContext {
  matchId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  players: MatchContextPlayer[];
  existingEvents: Array<{
    type: string;
    minute: number | null;
    playerId: number | null;
    teamId: number | null;
  }>;
}

export interface LLMProvider {
  readonly name: string;
  /**
   * Extract structured football events from a natural-language match
   * report. Must never throw: return null on any API/parse failure so
   * callers can degrade gracefully.
   */
  extractStructuredEvents(input: {
    report: string;
    context: MatchContext;
    prompt: string;
  }): Promise<ExtractionPayload | null>;
}

export function providerFor(): LLMProvider {
  if (process.env.GEMINI_API_KEY) return new GeminiProvider();
  return new NoopProvider();
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

class NoopProvider implements LLMProvider {
  readonly name = "none";
  async extractStructuredEvents(): Promise<ExtractionPayload | null> {
    return null;
  }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_TIMEOUT_MS = 30_000;

export class GeminiProvider implements LLMProvider {
  readonly name = `gemini:${GEMINI_MODEL}`;

  async extractStructuredEvents(input: {
    report: string;
    context: MatchContext;
    prompt: string;
  }): Promise<ExtractionPayload | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const raw = await this.callGemini(apiKey, input.prompt, controller.signal);
      if (!raw) return null;
      return this.parsePayload(raw);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private async callGemini(
    apiKey: string,
    prompt: string,
    signal: AbortSignal
  ): Promise<string | null> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0,
              maxOutputTokens: 8192,
            },
          }),
          signal,
        }
      );

      if (!res.ok) return null;

      const body = (await res.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      return body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    } catch {
      return null;
    }
  }

  private parsePayload(text: string): ExtractionPayload | null {
    try {
      // Tolerate markdown code fences around JSON.
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleaned) as Partial<ExtractionPayload>;

      const homeScore =
        typeof parsed.homeScore === "number"
          ? Math.max(0, Math.min(99, Math.round(parsed.homeScore)))
          : null;
      const awayScore =
        typeof parsed.awayScore === "number"
          ? Math.max(0, Math.min(99, Math.round(parsed.awayScore)))
          : null;

      const events = Array.isArray(parsed.events)
        ? (parsed.events as unknown as Record<string, unknown>[])
            .filter((e) => Boolean(e && typeof e === "object"))
            .map((e) => this.normalizeEvent(e))
            .filter((e): e is Extract<ExtractionPayload["events"][number], object> => e !== null)
        : [];

      return {
        homeScore,
        awayScore,
        events,
        warnings: Array.isArray(parsed.warnings)
          ? parsed.warnings.filter((w): w is string => typeof w === "string")
          : [],
      };
    } catch {
      return null;
    }
  }

  private normalizeEvent(raw: Record<string, unknown>): ExtractedEvent | null {
    const type = String(raw.type || "").toUpperCase() as ExtractionEventType;
    if (!EXTRACTION_EVENT_TYPES.includes(type)) return null;

    const minute =
      typeof raw.minute === "number" && Number.isInteger(raw.minute)
        ? Math.max(0, Math.min(130, raw.minute))
        : null;

    let addedTime: number | null = null;
    if (typeof raw.addedTime === "number" && Number.isInteger(raw.addedTime)) {
      addedTime = Math.max(0, Math.min(30, raw.addedTime));
    }

    const playerRaw = (raw.player || {}) as Record<string, unknown>;
    const player: ExtractedPlayerRef = {
      name: typeof playerRaw.name === "string" ? playerRaw.name.trim() : "",
      jerseyNumber: typeof playerRaw.jerseyNumber === "number" ? playerRaw.jerseyNumber : null,
    };

    const assistRaw = raw.assist as Record<string, unknown> | null | undefined;
    const assist: ExtractedPlayerRef | null =
      assistRaw && typeof assistRaw === "object" && typeof assistRaw.name === "string"
        ? {
            name: String(assistRaw.name).trim(),
            jerseyNumber:
              typeof assistRaw.jerseyNumber === "number" ? assistRaw.jerseyNumber : null,
          }
        : null;

    let minuteInference: MinuteInference | null = null;
    if (typeof raw.minuteInference === "object" && raw.minuteInference) {
      const mi = raw.minuteInference as Record<string, unknown>;
      minuteInference = {
        text: typeof mi.text === "string" ? mi.text : "",
        confidence:
          typeof mi.confidence === "number" ? Math.max(0, Math.min(1, mi.confidence)) : 0.5,
        requiresReview: Boolean(mi.requiresReview),
      };
    }

    const confidence =
      typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5;

    return {
      type,
      minute,
      addedTime,
      minuteInference,
      player,
      unlisted: Boolean(playerRaw.unlistedPlayer),
      assist: assist?.name ? assist : null,
      assistStatus:
        String(raw.assistStatus || "").toUpperCase() === "UNCLEAR"
          ? "UNCLEAR"
          : assist?.name
            ? "CLEAR"
            : "NONE",
      confidence,
      evidence: typeof raw.evidence === "string" ? raw.evidence.trim() : "",
    };
  }
}
