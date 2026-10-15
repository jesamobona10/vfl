"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrg } from "@/lib/hooks/use-org";
import { fetchJson } from "@/lib/utils/fetch";
import { brandStyleVars, validateBrandColor } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

const DEFAULT_PREVIEW = "#0f7c45";

/**
 * Brand color editor for an organization.
 *
 * The swatch and hex field stay in sync; the preview panel applies the
 * candidate color through the same CSS variables that the console, public
 * page, flyers and exports consume, so what you see is what renders.
 */
export function BrandSettings({ slug }: { slug: string }) {
  const { data: org } = useOrg(slug);
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stored = org?.brand_color ?? "";
  const value = draft ?? stored;

  const trimmed = value.trim();
  const validation = trimmed === "" ? null : validateBrandColor(trimmed);
  const invalid = validation !== null && !validation.ok;
  const dirty = trimmed !== stored;
  const swatch = validation?.ok ? validation.palette!.base : DEFAULT_PREVIEW;

  async function save() {
    setSaving(true);
    try {
      await fetchJson(`/api/org/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_color: trimmed === "" ? null : trimmed }),
      });
      setDraft(null);
      success("Brand color saved.");
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
    } catch (error) {
      toastError(error instanceof Error ? error.message : "Could not save brand color.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4 space-y-4">
      <div>
        <p className="text-sm font-medium">Brand color</p>
        <p className="text-xs text-ink-3">
          Used across the console, public page and flyers. Leave blank to use the default.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-ink-2">
          Swatch
          <input
            type="color"
            aria-label="Pick brand color"
            value={swatch}
            onChange={(event) => setDraft(event.target.value)}
            className="mt-1 block h-10 w-14 cursor-pointer rounded-lg border border-line bg-transparent p-1"
          />
        </label>
        <div className="min-w-[9rem] flex-1">
          <Input
            label="Hex"
            id="brand-color-hex"
            value={value}
            placeholder={DEFAULT_PREVIEW}
            onChange={(event) => setDraft(event.target.value)}
            error={invalid ? validation?.error : undefined}
          />
        </div>
        <Button onClick={save} loading={saving} disabled={invalid || !dirty}>
          Save
        </Button>
      </div>

      <div
        className="space-y-3 rounded-xl border border-line p-4"
        style={brandStyleVars(trimmed) as React.CSSProperties}
      >
        <p className="text-xs font-semibold text-ink-2">Preview</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary action</Button>
          <span className="btn-outline">Outline</span>
          <span className="rounded-full border border-brand-600/20 bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">
            Badge
          </span>
        </div>
      </div>
    </div>
  );
}
