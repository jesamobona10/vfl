"use client";

import { useEffect, useState } from "react";
import { EmptyState, LoadingState } from "@/components/shared/skeleton";

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/transfers");
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || "Failed to load transfers.");
          return;
        }
        if (mounted) setTransfers(body.transfers || []);
      } catch (e) {
        setError("Unable to fetch transfers.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <h1 className="page-title">Player Transfer History</h1>
          <p className="page-sub">Review player movement across the league.</p>
        </div>
      </div>
      {loading && <LoadingState label="Loading transfers" />}
      {error && <div className="rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
      {!loading && !error && (
        <div className="panel overflow-x-auto">
          {transfers.length === 0 ? (
            <EmptyState title="No transfers yet" description="Completed player transfers will appear here." />
          ) : (
          <table className="data-table w-full table-auto">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th className="text-left">Player</th>
                <th className="text-left">From</th>
                <th className="text-left">To</th>
                <th className="text-left">By</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2 whitespace-nowrap">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="py-2 whitespace-nowrap">{t.players?.name ?? t.player_id}</td>
                  <td className="py-2">{t.from_team?.name ?? "—"}</td>
                  <td className="py-2">{t.to_team?.name ?? "—"}</td>
                  <td className="py-2 whitespace-nowrap">
                    {t.performed_by_role} — {t.performed_by}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}
    </div>
  );
}
