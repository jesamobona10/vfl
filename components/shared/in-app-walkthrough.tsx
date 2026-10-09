"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, HelpCircle, Rocket } from "lucide-react";
import { Modal } from "@/components/ui/modal";

type WalkthroughAudience = "admin" | "org_admin" | "team_account" | "player" | "public";

type WalkthroughStep = {
  title: string;
  description: string;
  action?: string;
  href?: string;
};

const SEEN_KEY = "lf-in-app-walkthrough-seen";

const STEPS: Record<WalkthroughAudience, WalkthroughStep[]> = {
  admin: [
    {
      title: "Start with organizations",
      description:
        "Create and manage each league organization first. Organization data keeps teams, players, competitions, and access properly separated.",
      action: "Open organizations",
      href: "/admin?tab=orgs",
    },
    {
      title: "Set up competitions",
      description:
        "Create leagues, cups, or friendlies from Competitions. Use each competition to manage its seasons, participating teams, players, schedule, results, and standings.",
      action: "Open competitions",
      href: "/admin?tab=competitions",
    },
    {
      title: "Use import for bulk setup",
      description:
        "When you have a prepared dataset, use Import instead of entering everything manually. Review the import summary before syncing it.",
      action: "Open import",
      href: "/admin?tab=import",
    },
    {
      title: "Check the public experience",
      description:
        "Use Public Match Centre to verify what students, parents, and supporters can see without administrative access.",
      action: "Open public centre",
      href: "/admin?tab=public",
    },
  ],
  org_admin: [
    {
      title: "Your dashboard is the starting point",
      description:
        "Use Dashboard for a quick view of your organization. The season selector in the header changes the context for teams, players, and other organization data.",
      action: "Open dashboard",
      href: "/dashboard",
    },
    {
      title: "Create a competition",
      description:
        "Start a league, cup, or friendly from Competitions. Each competition keeps its own seasons, participating teams, players, schedule, results, and standings together.",
      action: "Open competitions",
      href: "/competitions",
    },
    {
      title: "Add teams and players",
      description:
        "Register your teams first, then add players and assign them to the correct team. This gives fixtures and statistics the data they need.",
      action: "Open teams",
      href: "/teams",
    },
    {
      title: "Work inside the competition",
      description:
        "Open a competition to manage its season. Use Teams and Players for participation, Schedule for matches, and Standings for the league table.",
      action: "Open competitions",
      href: "/competitions",
    },
    {
      title: "Publish and verify",
      description:
        "Use Public Match Centre to check the supporter-facing experience before sharing it with schools, students, and families.",
      action: "Open public centre",
      href: "/public",
    },
  ],
  team_account: [
    {
      title: "Start from your dashboard",
      description:
        "Your dashboard gives you the quickest view of your team's players and upcoming activity.",
      action: "Open dashboard",
      href: "/dashboard",
    },
    {
      title: "Keep your squad up to date",
      description:
        "Use Players to review the squad information available to your team. Accurate player data supports lineups, match events, and statistics.",
      action: "Open players",
      href: "/players",
    },
    {
      title: "Use competition pages for match context",
      description:
        "When you need a competition's schedule, results, or standings, open the relevant competition from the organization dashboard.",
      action: "Open dashboard",
      href: "/dashboard",
    },
    {
      title: "Check the public match centre",
      description:
        "Public Match Centre shows the supporter-facing view of fixtures, live matches, and competition information.",
      action: "Open public centre",
      href: "/public",
    },
  ],
  player: [
    {
      title: "Use the dashboard for your overview",
      description:
        "The dashboard gives you a quick view of the information available for your league participation.",
      action: "Open dashboard",
      href: "/dashboard",
    },
    {
      title: "Follow public results",
      description:
        "Public Match Centre is the easiest place to follow fixtures, live matches, results, and standings shared by your organization.",
      action: "Open public centre",
      href: "/public",
    },
  ],
  public: [
    {
      title: "Browse match updates",
      description:
        "Use Matches to see scheduled, live, and completed games. Select a match to open its live match centre.",
    },
    {
      title: "Filter the public centre",
      description:
        "Use the competition, season, and status filters to find the fixtures and results you want.",
    },
    {
      title: "Follow your organization",
      description:
        "Save your match-centre preferences and enable notifications when you want updates about a specific organization.",
    },
  ],
};

interface InAppWalkthroughProps {
  audience: WalkthroughAudience;
  slug?: string;
}

function scopedHref(href: string, slug?: string) {
  return slug && href.startsWith("/") && !href.startsWith("/admin") && href !== "/public"
    ? `/org/${slug}${href}`
    : href;
}

export function InAppWalkthrough({ audience, slug }: InAppWalkthroughProps) {
  const router = useRouter();
  const steps = useMemo(() => STEPS[audience], [audience]);
  const storageKey = `${SEEN_KEY}:${audience}`;
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      setOpen(localStorage.getItem(storageKey) !== "1");
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Private browsing can deny storage; closing still dismisses this session.
    }
  };

  const restart = () => {
    setStepIndex(0);
    setOpen(true);
  };

  const current = steps[stepIndex]!;
  const destination = current.href ? scopedHref(current.href, slug) : undefined;

  const openDestination = () => {
    if (!destination) return;
    close();
    router.push(destination);
  };

  return (
    <>
      <button
        type="button"
        onClick={restart}
        className="btn-icon"
        title="Open walkthrough"
        aria-label="Open walkthrough"
      >
        <HelpCircle size={18} />
      </button>

      {hydrated && (
        <Modal
          open={open}
          onClose={close}
          title="How to use LeagueForge"
          subtitle={`Step ${stepIndex + 1} of ${steps.length}`}
          className="max-w-xl"
          footer={
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={close} className="btn text-sm">
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                  disabled={stepIndex === 0}
                  className="btn flex items-center gap-1.5 text-sm"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
                {stepIndex < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((index) => index + 1)}
                    className="btn-primary flex items-center gap-1.5 text-sm"
                  >
                    Next
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button type="button" onClick={close} className="btn-primary text-sm">
                    Finish
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Rocket size={19} />
              </span>
              <div>
                <h3 className="text-lg font-semibold">{current.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{current.description}</p>
              </div>
            </div>

            <div className="flex gap-1.5" aria-label="Walkthrough progress">
              {steps.map((step, index) => (
                <span
                  key={step.title}
                  className={`h-1.5 flex-1 rounded-full ${
                    index <= stepIndex ? "bg-brand" : "bg-surface-2"
                  }`}
                />
              ))}
            </div>

            {destination && (
              <button
                type="button"
                onClick={openDestination}
                className="text-sm font-medium text-brand hover:underline"
              >
                {current.action} <ArrowRight size={14} className="inline" />
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
