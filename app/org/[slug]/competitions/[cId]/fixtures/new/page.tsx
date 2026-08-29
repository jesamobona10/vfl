"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Calendar, Clock, MapPin, Plus, X, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";

type TeamForFixture = {
  id: number;
  name: string;
  status?: string;
};

export default function NewFixturePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");
  const allTeams = useAppStore((s) => s.teams);
  const { success: toastSuccess, error: toastError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    home_team_id: "",
    away_team_id: "",
    round: 1,
    date: "",
    time: "",
    venue: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.home_team_id || !formData.away_team_id) {
      toastError("Please select both home and away teams");
      return;
    }
    if (formData.home_team_id === formData.away_team_id) {
      toastError("Home and away teams must be different");
      return;
    }
    if (!formData.date) {
      toastError("Please select a date");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/org/${slug}/competitions/${cId}/fixtures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          season_id: seasonId,
          home_team_id: Number(formData.home_team_id),
          away_team_id: Number(formData.away_team_id),
          round: Number(formData.round),
          date: formData.date,
          time: formData.time || null,
          venue: formData.venue || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toastError(data.error || "Failed to create fixture");
        return;
      }

      toastSuccess("Fixture created successfully!");
      router.back();
    } catch (error) {
      toastError("Failed to create fixture. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTeams = allTeams.filter((t: any) => t.status === "active");

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">New Fixture</h1>
          <p className="text-muted">Schedule a new match for the season</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6 space-y-6">
          <h2 className="text-lg font-semibold">Match Details</h2>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="home_team_id" className="block text-sm font-medium">Home Team *</label>
                <select
                  value={formData.home_team_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData((prev) => ({ ...prev, home_team_id: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Select home team</option>
                  {filteredTeams.map((team: any) => (
                    <option key={team.id} value={String(team.id)}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="away_team_id" className="block text-sm font-medium">Away Team *</label>
                <select
                  value={formData.away_team_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData((prev) => ({ ...prev, away_team_id: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Select away team</option>
                  {filteredTeams.map((team: any) => (
                    <option key={team.id} value={String(team.id)}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="round" className="block text-sm font-medium">Round *</label>
                <input
                  type="number"
                  id="round"
                  min="1"
                  max="50"
                  value={formData.round}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, round: Number(e.target.value) }))}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="date" className="block text-sm font-medium">Date *</label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  min={format(new Date(), "yyyy-MM-dd")}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="time" className="block text-sm font-medium">Time</label>
                <input
                  type="time"
                  id="time"
                  value={formData.time}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, time: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="venue" className="block text-sm font-medium">Venue</label>
              <input
                id="venue"
                placeholder="Stadium name, city"
                value={formData.venue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData((prev) => ({ ...prev, venue: e.target.value }))}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-line rounded-lg bg-bg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="btn-ghost"
          >
            <X size={16} className="mr-2" />
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} className="mr-2" />
                Create Fixture
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}