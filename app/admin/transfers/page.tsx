"use client";

import { useEffect, useState } from "react";

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
    return () => { mounted = false };
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Player Transfer History</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-danger">{error}</p>}
      {!loading && !error && (
        <div className="overflow-auto">
          <table className="w-full table-auto">
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
                  <td className="py-2">{new Date(t.created_at).toLocaleString()}</td>
                  <td className="py-2">{t.players?.name ?? t.player_id}</td>
                  <td className="py-2">{t.from_team?.name ?? "—"}</td>
                  <td className="py-2">{t.to_team?.name ?? "—"}</td>
                  <td className="py-2">{t.performed_by_role} — {t.performed_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
