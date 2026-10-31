"use client";

import { Shield } from "lucide-react";
import Link from "next/link";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row">
        <div className="relative hidden lg:flex lg:w-1/2 flex-col justify-center px-12 bg-gradient-to-br from-brand/10 via-brand/5 to-bg">
          <div className="max-w-md">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="text-brand" size={40} />
              <span className="text-2xl font-bold">LeagueForge</span>
            </div>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              League management made simple
            </h2>
            <p className="text-lg text-muted mb-8">
              Fixtures, standings, matchday, and organization tools in one place.
            </p>
            <ul className="space-y-3 text-sm text-ink-2">
              <li>• Organized competitions and schedules</li>
              <li>• Live matchday and official records</li>
              <li>• Controlled access by role</li>
            </ul>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-12">
          <div className="w-full max-w-md">
            <div className="text-center mb-6 lg:hidden">
              <Shield className="mx-auto text-brand" size={40} />
              <h1 className="text-2xl font-bold mt-3">LeagueForge</h1>
            </div>
            <div className="card p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-xl font-semibold">{title}</h2>
                {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
              </div>
              {children}
            </div>
            <p className="text-center text-xs text-muted mt-4">
              <Link href="/" className="hover:underline">
                Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
