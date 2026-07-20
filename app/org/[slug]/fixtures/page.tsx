"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { FixtureList } from "@/components/fixtures/fixture-list";
import { RefreshCw, Loader2 } from "lucide-react";

export default function OrgFixturesPage() {
  const teams = useAppStore((s) => s.teams);
  const generateFixtures = useAppStore((s) => s.generateFixtures);
  const fixtures = useAppStore((s) => s.fixtures);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = () => {
    if (teams.length < 2) return;
    setGenerating(true);
    setTimeout(() => {
      generateFixtures(teams);
      setGenerating(false);
    }, 100);
  };

  return (
    <div>
      <FixtureList />
      {fixtures.length === 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={handleGenerate}
            disabled={generating || teams.length < 2}
            className="btn-primary"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Generate Fixtures
          </button>
          {teams.length < 2 && (
            <p className="text-sm text-muted mt-2">Need at least 2 teams to generate fixtures.</p>
          )}
        </div>
      )}
    </div>
  );
}
