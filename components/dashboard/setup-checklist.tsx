"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle, X, Rocket } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Trophy, Shield, Calendar } from "lucide-react";

interface SetupChecklistProps {
  slug: string;
  competitionCount: number;
  teamCount: number;
  fixtureCount: number;
}

interface Step {
  key: string;
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  done: boolean;
}

const DISMISS_KEY = "vfl-setup-checklist-dismissed";

export function SetupChecklist({ slug, competitionCount, teamCount, fixtureCount }: SetupChecklistProps) {
  const base = `/org/${slug}`;

  const steps: Step[] = [
    {
      key: "competition",
      label: "Create your first competition",
      hint: "A league, cup, or friendly to organize matches under",
      href: `${base}/competitions/new`,
      icon: Trophy,
      done: competitionCount > 0,
    },
    {
      key: "teams",
      label: "Register at least two teams",
      hint: "Add teams with player squads so fixtures can be drawn",
      href: `${base}/teams`,
      icon: Shield,
      done: teamCount >= 2,
    },
    {
      key: "fixtures",
      label: "Generate your fixtures",
      hint: "Round-robin or cup schedule, ready in one click",
      href: `${base}/fixtures`,
      icon: Calendar,
      done: fixtureCount > 0,
    },
  ];

  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(`${DISMISS_KEY}:${slug}`) === "1");
    } catch {
      setDismissed(false);
    }
  }, [slug]);

  if (steps.every((s) => s.done) || dismissed) return null;

  const completed = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`${DISMISS_KEY}:${slug}`, "1");
    } catch {
      // private mode — dismiss for this session only
    }
  };

  return (
    <div className="card p-5 border-l-4 border-l-brand" role="region" aria-label="Getting started checklist">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Rocket size={16} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold">Get your league running</h2>
            <p className="text-xs text-muted">
              {completed === 0
                ? "Three quick steps and you're playing."
                : `Nice progress — ${completed} of ${steps.length} done.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started checklist"
          className="btn-icon -mr-1 -mt-1"
        >
          <X size={15} />
        </button>
      </div>

      {/* Progress bar */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label="Setup progress"
      >
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${(completed / steps.length) * 100}%` }}
        />
      </div>

      <ol className="mt-3 space-y-1.5">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isNext = nextStep?.key === step.key;
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  step.done
                    ? "text-muted"
                    : "hover:bg-surface-2 text-text"
                }`}
                aria-current={isNext ? "step" : undefined}
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                    step.done
                      ? "bg-brand text-white"
                      : isNext
                        ? "border-2 border-brand text-brand"
                        : "border border-line text-muted"
                  }`}
                >
                  {step.done ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <Circle size={8} className={isNext ? "fill-brand-600/0" : ""} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`flex items-center gap-1.5 text-sm font-medium ${step.done ? "line-through decoration-line" : ""}`}>
                    <Icon size={13} className="shrink-0 text-muted" />
                    {step.label}
                    {isNext && (
                      <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-600">
                        Next up
                      </span>
                    )}
                  </span>
                  {!step.done && <span className="mt-0.5 block text-xs text-muted">{step.hint}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
