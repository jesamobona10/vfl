"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { FixtureList } from "@/components/fixtures/fixture-list";

export default function CompFixturesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const cId = params.cId as string;
  const seasonId = searchParams.get("seasonId");
  const setFixtures = useAppStore((s) => s.setFixtures);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ competition_id: cId });
    if (seasonId) query.set("season_id", seasonId);

    fetch(`/api/organizations/${slug}/fixtures?${query.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.fixtures?.length) {
          setFixtures(data.fixtures);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [slug, cId, seasonId]);

  return <FixtureList />;
}
