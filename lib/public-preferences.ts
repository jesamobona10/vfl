export const PUBLIC_PREFERENCES_STORAGE_KEY = "vfl-public-match-preferences";

export interface PublicPreferences {
  displayName: string;
  organizationId: string;
  teamIds: number[];
  reminderMinutes?: number[];
}

export function readPublicPreferences(): PublicPreferences | null {
  try {
    const value = localStorage.getItem(PUBLIC_PREFERENCES_STORAGE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<PublicPreferences>;
    if (typeof parsed.organizationId !== "string" || !Array.isArray(parsed.teamIds)) return null;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "",
      organizationId: parsed.organizationId,
      teamIds: parsed.teamIds.filter((id): id is number => Number.isSafeInteger(id) && id > 0),
      reminderMinutes: Array.isArray(parsed.reminderMinutes)
        ? parsed.reminderMinutes.filter((value): value is number => value === 60 || value === 30 || value === 15)
        : [60, 30, 15],
    };
  } catch {
    return null;
  }
}

export function savePublicPreferences(preferences: PublicPreferences) {
  localStorage.setItem(PUBLIC_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}
