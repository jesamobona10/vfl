"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Plus, X, AlertCircle, CheckCircle } from "lucide-react";

export function FixtureCreator() {
  const [open, setOpen] = useState(false);
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [round, setRound] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const teams = useAppStore((s) => s.teams);
  const fixtures = useAppStore((s) => s.fixtures);
  const addFixture = useAppStore((s) => s.addFixture);
  const isAdmin = useAppStore((s) => s.isAdmin);

  const handleSubmit = () => {
    setError("");
    setSuccess("");

    const result = addFixture(
      {
        homeId: Number(homeId),
        awayId: Number(awayId),
        round: round ? Number(round) : undefined,
        date: date || undefined,
        time: time || undefined,
        venue: venue || undefined,
      },
      teams
    );

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess("Fixture added successfully.");
    setHomeId("");
    setAwayId("");
    setRound("");
    setDate("");
    setTime("");
    setVenue("");

    setTimeout(() => setSuccess(""), 3000);
  };

  if (!isAdmin) return null;

  return (
    <div className="card">
      <button
        onClick={() => {
          setOpen(!open);
          setError("");
          setSuccess("");
        }}
        className="flex items-center gap-2 w-full px-5 py-3 text-sm font-medium text-left hover:bg-surface-2 transition-colors"
      >
        {open ? <X size={16} /> : <Plus size={16} />}
        {open ? "Close Fixture Creator" : "+ Add Fixture"}
      </button>

      {open && (
        <div className="border-t border-line px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Home Team
              </label>
              <select
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                className="input"
              >
                <option value="">Select home team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Away Team
              </label>
              <select
                value={awayId}
                onChange={(e) => setAwayId(e.target.value)}
                className="input"
              >
                <option value="">Select away team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Round
              </label>
              <select
                value={round}
                onChange={(e) => setRound(e.target.value)}
                className="input"
              >
                <option value="">Auto (next available)</option>
                {fixtures.map((r) => (
                  <option key={r.round} value={r.round}>
                    Round {r.round}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Time
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Venue
              </label>
              <input
                type="text"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="input"
                placeholder="Main pitch"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2 mb-3">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-brand bg-brand/10 rounded-lg px-3 py-2 mb-3">
              <CheckCircle size={16} />
              {success}
            </div>
          )}

          <button
            onClick={handleSubmit}
            className="btn-primary"
          >
            <Plus size={16} />
            Add Fixture
          </button>
        </div>
      )}
    </div>
  );
}
