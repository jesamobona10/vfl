"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock } from "lucide-react";

function parse12h(value: string): { hour: string; minute: string; period: "AM" | "PM" } {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return { hour: "12", minute: "00", period: "AM" };

  let h = Number(match[1]);
  const m = match[2];
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return { hour: String(h), minute: m, period };
}

function to24h(hour: string, minute: string, period: "AM" | "PM"): string {
  let h = Number(hour);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimeInput({ value, onChange }: TimeInputProps) {
  const [mode, setMode] = useState<"24h" | "12h">("24h");

  const parsed = parse12h(value);
  const [h12, setH12] = useState(parsed.hour);
  const [m12, setM12] = useState(parsed.minute);
  const [p12, setP12] = useState<"AM" | "PM">(parsed.period);

  useEffect(() => {
    const p = parse12h(value);
    setH12(p.hour);
    setM12(p.minute);
    setP12(p.period);
  }, [value]);

  const emit12h = useCallback(
    (hour: string, minute: string, period: "AM" | "PM") => {
      if (hour && minute) {
        onChange(to24h(hour, minute.padStart(2, "0"), period));
      }
    },
    [onChange]
  );

  if (mode === "24h") {
    return (
      <div className="flex items-center gap-1">
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input text-sm py-1.5 flex-1"
        />
        <button
          type="button"
          onClick={() => {
            const p = parse12h(value);
            setH12(p.hour);
            setM12(p.minute);
            setP12(p.period);
            setMode("12h");
          }}
          className="text-[11px] text-muted hover:text-text px-1.5 py-1 shrink-0 font-medium"
          title="Switch to 12-hour format"
        >
          12h
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5 flex-1">
        <Clock size={14} className="text-muted shrink-0 mr-1" />
        <input
          type="number"
          min={1}
          max={12}
          value={h12}
          onChange={(e) => {
            const v = e.target.value;
            setH12(v);
            emit12h(v, m12, p12);
          }}
          className="input text-sm py-1.5 w-12 text-center"
          placeholder="HH"
        />
        <span className="text-muted text-sm">:</span>
        <select
          value={m12}
          onChange={(e) => {
            const v = e.target.value;
            setM12(v);
            emit12h(h12, v, p12);
          }}
          className="input text-sm py-1.5 w-14"
        >
          <option value="00">00</option>
          <option value="15">15</option>
          <option value="30">30</option>
          <option value="45">45</option>
        </select>
        <select
          value={p12}
          onChange={(e) => {
            const v = e.target.value as "AM" | "PM";
            setP12(v);
            emit12h(h12, m12, v);
          }}
          className="input text-sm py-1.5 w-16"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => {
          onChange(to24h(h12, m12, p12));
          setMode("24h");
        }}
        className="text-[11px] text-muted hover:text-text px-1.5 py-1 shrink-0 font-medium"
        title="Switch to 24-hour format"
      >
        24h
      </button>
    </div>
  );
}
