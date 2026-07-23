"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Search, X, Users, User, Calendar, ArrowUpDown } from "lucide-react";
import { posLabel } from "@/lib/utils/helpers";

interface SearchResult {
  type: "team" | "player" | "fixture";
  id: number;
  title: string;
  subtitle: string;
  meta: string;
  route: string;
}

type CategoryFilter = "all" | "teams" | "players" | "fixtures";
type SortOption =
  | "relevance"
  | "name-asc"
  | "name-desc"
  | "position"
  | "team"
  | "date-asc"
  | "date-desc"
  | "round-asc"
  | "round-desc";

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const teams = useAppStore((s) => s.teams);
  const players = useAppStore((s) => s.players);
  const fixtures = useAppStore((s) => s.fixtures);
  const teamName = useAppStore((s) => s.teamName);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<SortOption>("relevance");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setCategory("all");
      setSort("relevance");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const q = query.toLowerCase().trim();

  const results = useMemo<SearchResult[]>(() => {
    if (!q) return [];

    const all: SearchResult[] = [];

    if (category === "all" || category === "teams") {
      teams
        .filter((t) => t.name.toLowerCase().includes(q))
        .forEach((t) => {
          all.push({
            type: "team",
            id: t.id,
            title: t.name,
            subtitle: `${players.filter((p) => p.teamId === t.id).length} players`,
            meta: `Rating: ${t.rating}`,
            route: "/admin",
          });
        });
    }

    if (category === "all" || category === "players") {
      players
        .filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.position.toLowerCase().includes(q) ||
            String(p.number).includes(q) ||
            teamName(p.teamId).toLowerCase().includes(q)
        )
        .forEach((p) => {
          all.push({
            type: "player",
            id: p.id,
            title: p.name,
            subtitle: `${posLabel(p.position)} - #${p.number} - ${teamName(p.teamId)}`,
            meta: `G:${p.goals} A:${p.assists}`,
            route: "/admin",
          });
        });
    }

    if (category === "all" || category === "fixtures") {
      for (const round of fixtures) {
        round.matches
          .filter((m) => {
            const home = teamName(m.homeId).toLowerCase();
            const away = teamName(m.awayId).toLowerCase();
            const venue = (m.venue || "").toLowerCase();
            return (
              home.includes(q) ||
              away.includes(q) ||
              venue.includes(q) ||
              m.status.includes(q) ||
              (m.date || "").includes(q)
            );
          })
          .forEach((m) => {
            const home = teamName(m.homeId);
            const away = teamName(m.awayId);
            const score =
              m.status === "completed"
                ? `${m.homeScore ?? "?"}-${m.awayScore ?? "?"}`
                : "";
            all.push({
              type: "fixture",
              id: m.id,
              title: `${home} vs ${away}`,
              subtitle: `Round ${m.round}${m.date ? ` - ${m.date}${m.time ? ` ${m.time}` : ""}` : ""}`,
              meta: score || m.status,
              route: "/admin",
            });
          });
      }
    }

    const sorted = [...all];
    switch (sort) {
      case "name-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "position":
        sorted.sort((a, b) => a.subtitle.localeCompare(b.subtitle));
        break;
      case "team":
        sorted.sort((a, b) => a.subtitle.localeCompare(b.subtitle));
        break;
      case "date-asc":
      case "round-asc":
        sorted.sort((a, b) => {
          if (a.type !== "fixture" || b.type !== "fixture") return 0;
          return a.subtitle.localeCompare(b.subtitle);
        });
        break;
      case "date-desc":
      case "round-desc":
        sorted.sort((a, b) => {
          if (a.type !== "fixture" || b.type !== "fixture") return 0;
          return b.subtitle.localeCompare(a.subtitle);
        });
        break;
    }

    return sorted;
  }, [q, category, sort, teams, players, fixtures, teamName]);

  const handleNavigate = useCallback(
    (result: SearchResult) => {
      onClose();
      router.push(result.route);
    },
    [onClose, router]
  );

  if (!isOpen) return null;

  const categoryPills: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "teams", label: "Teams" },
    { key: "players", label: "Players" },
    { key: "fixtures", label: "Fixtures" },
  ];

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: "relevance", label: "Relevance" },
    { key: "name-asc", label: "Name A-Z" },
    { key: "name-desc", label: "Name Z-A" },
    ...(category === "all" || category === "players"
      ? ([
          { key: "position" as SortOption, label: "Position" },
          { key: "team" as SortOption, label: "Team" },
        ] as const)
      : []),
    ...(category === "all" || category === "fixtures"
      ? ([
          { key: "date-asc" as SortOption, label: "Date Asc" },
          { key: "date-desc" as SortOption, label: "Date Desc" },
          { key: "round-asc" as SortOption, label: "Round Asc" },
          { key: "round-desc" as SortOption, label: "Round Desc" },
        ] as const)
      : []),
  ];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card w-full max-w-2xl max-h-[70vh] flex flex-col relative">
        <div className="flex items-center gap-3 p-4 border-b border-line">
          <Search size={20} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams, players, fixtures..."
            className="flex-1 bg-transparent border-none outline-none text-text placeholder:text-muted text-base"
          />
          {query && (
            <button onClick={() => setQuery("")} className="btn-icon">
              <X size={16} />
            </button>
          )}
          <button onClick={onClose} className="btn-icon">
            <X size={18} />
          </button>
        </div>

        {query && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-line flex-wrap">
            <div className="flex gap-1">
              {categoryPills.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setCategory(p.key)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    category === p.key
                      ? "bg-brand text-white"
                      : "bg-surface text-muted hover:text-text"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <ArrowUpDown size={14} className="text-muted" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="text-xs bg-transparent border border-line rounded px-2 py-1 text-text"
              >
                {sortOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {query && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Search size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs mt-1">Try a different search term or category</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <p className="text-xs text-muted px-2 py-1">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              {results.map((r, i) => (
                <button
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={() => handleNavigate(r)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="mt-0.5 shrink-0">
                    {r.type === "team" && <Users size={18} className="text-brand" />}
                    {r.type === "player" && <User size={18} className="text-accent" />}
                    {r.type === "fixture" && <Calendar size={18} className="text-accent" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-text truncate">
                        {r.title}
                      </span>
                      <span
                        className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded shrink-0 ${
                          r.type === "team"
                            ? "bg-brand/10 text-brand"
                            : r.type === "player"
                              ? "bg-accent/10 text-accent"
                              : "bg-accent/10 text-accent"
                        }`}
                      >
                        {r.type}
                      </span>
                    </div>
                    <p className="text-xs text-muted truncate mt-0.5">
                      {r.subtitle}
                    </p>
                  </div>

                  <div className="text-xs text-muted shrink-0 text-right">
                    {r.meta}
                  </div>
                </button>
              ))}
            </>
          )}

          {!query && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <Search size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Type to start searching</p>
              <p className="text-xs mt-1">
                Search across teams, players, and fixtures
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
