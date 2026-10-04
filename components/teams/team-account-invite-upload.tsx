"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { parseTeamInviteCSV, type TeamInviteImportResult } from "@/lib/utils/csv";
import { AlertCircle, Check, Upload, Users } from "lucide-react";

const SAMPLE_CSV = `email,team,role
coach@example.com,Northside Rovers,coach
assistant@example.com,Northside Rovers,assistant_coach`;

type Props = {
  slug: string;
  onClose: () => void;
  onComplete: () => void;
};

type SubmitResult = {
  created: number;
  skipped: Array<{ email: string; reason: string }>;
  errors: string[];
};

/**
 * Bulk-create coach invites from a CSV. Parsing happens locally for the
 * preview, but team resolution is server-side — an invite must never be able
 * to name a team outside the caller's organization.
 */
export function TeamAccountInviteUpload({ slug, onClose, onComplete }: Props) {
  const [csvText, setCsvText] = useState("");
  const [parseResult, setParseResult] = useState<TeamInviteImportResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setParseError("");
    setResult(null);
    try {
      const text = await file.text();
      setCsvText(text);
      setParseResult(parseTeamInviteCSV(text));
    } catch (err) {
      setParseResult(null);
      setParseError(err instanceof Error ? err.message : "Unable to parse CSV.");
    }
  };

  const rows = parseResult?.rows ?? [];
  const blockingErrors = useMemo(
    () => (parseResult?.errors ?? []).filter((e) => e.startsWith("Row")).length,
    [parseResult]
  );

  const handleSubmit = async () => {
    if (rows.length === 0) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/org/${slug}/team-account-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invites: rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ created: 0, skipped: [], errors: [data.error || "Failed to create invites."] });
        setSubmitting(false);
        return;
      }
      setResult({ created: data.created ?? 0, skipped: data.skipped ?? [], errors: data.errors ?? [] });
      setSubmitting(false);
      if ((data.created ?? 0) > 0) onComplete();
    } catch {
      setResult({ created: 0, skipped: [], errors: ["Network error. Please try again."] });
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite Coaches from CSV"
      subtitle="Each row invites one coach to sign in with Google and manage that team."
      className="max-w-2xl"
      footer={
        result ? (
          <div className="flex items-center gap-2 justify-end">
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 justify-end">
            <button className="btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleSubmit}
              disabled={submitting || rows.length === 0}
            >
              {submitting ? (
                <span className="block w-4 h-4 bg-surface-2 rounded animate-pulse" />
              ) : (
                <Users size={14} />
              )}
              {submitting
                ? "Creating invites..."
                : `Create ${rows.length} invite${rows.length === 1 ? "" : "s"}`}
            </button>
          </div>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div
            className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
              result.created > 0 ? "text-live-500 bg-live-tint" : "text-danger bg-danger/10"
            }`}
          >
            {result.created > 0 ? (
              <Check size={16} className="shrink-0" />
            ) : (
              <AlertCircle size={16} className="shrink-0" />
            )}
            <span>
              {result.created} invite{result.created === 1 ? "" : "s"} created. Invited coaches sign
              in with Google using the address in their row.
            </span>
          </div>

          {result.skipped.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Skipped</h3>
              <ul className="space-y-1 text-xs text-muted">
                {result.skipped.map((s, i) => (
                  <li key={`${s.email}-${i}`}>
                    <span className="font-mono">{s.email}</span> — {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-danger">Problems</h3>
              <ul className="space-y-1 text-xs text-danger">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">CSV file</p>
            <label className="btn w-full cursor-pointer">
              <Upload size={14} />
              Choose file
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            <p className="text-xs text-muted mt-1">
              Columns: <code className="font-mono">email</code>,{" "}
              <code className="font-mono">team</code>, and optionally{" "}
              <code className="font-mono">role</code> (coach or assistant_coach).
            </p>
          </div>

          <details className="text-xs">
            <summary className="cursor-pointer text-muted hover:text-text">Example format</summary>
            <pre className="mt-2 p-3 bg-surface-2 rounded-lg overflow-x-auto font-mono">
              {SAMPLE_CSV}
            </pre>
          </details>

          {parseError && (
            <div
              className="flex items-start gap-2 text-sm p-3 rounded-lg text-danger bg-danger/10"
              role="alert"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {parseResult && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Check size={16} className="text-live-500 shrink-0" />
                <span>
                  {rows.length} valid row{rows.length === 1 ? "" : "s"} ready to import.
                </span>
              </div>

              {parseResult.warnings.length > 0 && (
                <ul className="space-y-1 text-xs text-muted">
                  {parseResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}

              {blockingErrors > 0 && (
                <div className="text-xs">
                  <p className="text-danger font-medium mb-1">
                    {blockingErrors} row{blockingErrors === 1 ? "" : "s"} could not be read and will
                    be skipped:
                  </p>
                  <ul className="space-y-1 text-danger max-h-32 overflow-y-auto">
                    {parseResult.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {csvText && rows.length > 0 && (
                <div className="max-h-48 overflow-auto border border-line rounded-lg">
                  <table className="w-full min-w-[420px] text-xs">
                    <thead className="sticky top-0 bg-surface-2">
                      <tr>
                        <th className="text-left px-2 py-1.5">Email</th>
                        <th className="text-left px-2 py-1.5">Team</th>
                        <th className="text-left px-2 py-1.5">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={`${r.email}-${i}`} className="border-t border-line">
                          <td className="px-2 py-1.5 font-mono truncate">{r.email}</td>
                          <td className="px-2 py-1.5 truncate">{r.team_name}</td>
                          <td className="px-2 py-1.5 text-muted">{r.role}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
