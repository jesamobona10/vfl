"use client";

import { useState, useMemo } from "react";
import type { Match } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";

interface CalendarViewProps {
  orgId?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ orgId }: CalendarViewProps) {
  const fixtures = useAppStore((s) => s.fixtures);
  const teams = useAppStore((s) => s.teams);
  const getTeam = useAppStore((s) => s.getTeam);

  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const orgTeamIds = useMemo(() => {
    if (!orgId) return null;
    return teams.filter((t) => t.organization_id === orgId).map((t) => t.id);
  }, [orgId, teams]);

  const matchesByDate = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const round of fixtures) {
      for (const match of round.matches) {
        if (!match.date) continue;
        if (orgTeamIds && !orgTeamIds.includes(match.homeId) && !orgTeamIds.includes(match.awayId)) continue;
        const existing = map.get(match.date) || [];
        existing.push(match);
        map.set(match.date, existing);
      }
    }
    return map;
  }, [fixtures, orgTeamIds]);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const padStart = firstDayOfWeek;
  const totalCells = Math.ceil((padStart + daysInMonth) / 7) * 7;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const formatDate = (d: string) => {
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const selectedMatches = selectedDate ? matchesByDate.get(selectedDate) || [] : [];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
    setSelectedDate(null);
  };

  const monthLabel = new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
    month: "long", year: "numeric",
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarIcon size={16} className="text-brand" />
          <h3 className="text-sm font-semibold">Calendar</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="btn-icon" title="Previous month">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-medium w-32 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="btn-icon" title="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-line rounded-lg overflow-hidden">
        {DAYS.map((d) => (
          <div key={d} className="bg-surface-2 text-center text-[11px] text-muted font-semibold py-1.5">
            {d}
          </div>
        ))}
        {Array.from({ length: totalCells }).map((_, i) => {
          const day = i - padStart + 1;
          if (day < 1 || day > daysInMonth) return <div key={i} className="bg-surface" />;

          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasMatch = matchesByDate.has(dateStr);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={i}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={`relative bg-surface text-center text-sm py-2 transition-colors hover:bg-surface-2 ${
                isSelected ? "bg-brand/10 ring-1 ring-brand" : ""
              }`}
            >
              <span className={`${isToday ? "font-bold text-brand" : "text-text"}`}>
                {day}
              </span>
              {hasMatch && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted font-medium">{formatDate(selectedDate)}</p>
          {selectedMatches.length === 0 ? (
            <p className="text-xs text-muted">No matches on this day.</p>
          ) : (
            selectedMatches.map((m) => {
              const home = getTeam(m.homeId);
              const away = getTeam(m.awayId);
              return (
                <div key={m.id} className="flex items-center gap-2 text-xs bg-surface-2 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {home?.logo_url && (
                      <img src={home.logo_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                    )}
                    <span className="truncate font-medium">{home?.name || "?"}</span>
                  </div>
                  <span className="text-muted shrink-0">vs</span>
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                    <span className="truncate font-medium">{away?.name || "?"}</span>
                    {away?.logo_url && (
                      <img src={away.logo_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                    )}
                  </div>
                  {m.time && (
                    <span className="text-muted shrink-0 ml-2">{m.time}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}