"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Shield, School, Building2, Users, ArrowRight, Loader2 } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const isAdmin = useAppStore((s) => s.isAdmin);
  const userProfile = useAppStore((s) => s.userProfile);
  const authLoading = useAppStore((s) => s.authLoading);
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const fetchMyOrgs = useAppStore((s) => s.fetchMyOrgs);
  const myOrgs = useAppStore((s) => s.myOrgs);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      router.replace("/admin");
    }
  }, [authLoading, isAdmin, router]);

  useEffect(() => {
    if (!authLoading && userProfile && !isAdmin) {
      setLoadingOrgs(true);
      fetchMyOrgs().finally(() => setLoadingOrgs(false));
    }
  }, [authLoading, userProfile, isAdmin, fetchMyOrgs]);

  useEffect(() => {
    if (loadingOrgs || authLoading) return;
    if (myOrgs.length === 1 && currentTeamAccount) {
      router.replace(`/org/${myOrgs[0].slug}/dashboard`);
    } else if (myOrgs.length > 0 && !isAdmin) {
      router.replace(`/org/${myOrgs[0].slug}/dashboard`);
    }
  }, [myOrgs, loadingOrgs, authLoading, currentTeamAccount, isAdmin, router]);

  if (authLoading || loadingOrgs) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="animate-spin w-6 h-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isAdmin || userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 size={28} className="animate-spin text-muted" />
      </div>
    );
  }

  const orgTypes = [
    {
      type: "school",
      label: "School",
      icon: School,
      desc: "Multiple teams, intra-school & inter-school competitions",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      type: "academy",
      label: "Football Academy",
      icon: Building2,
      desc: "Age-group teams, tournament participation, player development",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      type: "club",
      label: "Amateur Club",
      icon: Users,
      desc: "Independent club with league, cup, and friendly matches",
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-12">
          <Shield className="mx-auto text-brand" size={56} />
          <h1 className="text-3xl sm:text-4xl font-bold mt-6 text-text">
            VUNA Football Management
          </h1>
          <p className="text-muted mt-3 text-lg max-w-xl mx-auto">
            Manage your school, academy, or club — leagues, cups, player stats, and live scores.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          {orgTypes.map(({ type, label, icon: Icon, desc, color, bg }) => (
            <button
              key={type}
              onClick={() => router.push(`/auth/register?type=${type}`)}
              className="card p-6 text-left hover:border-brand transition-colors group"
            >
              <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center mb-4`}>
                <Icon size={24} className={color} />
              </div>
              <h3 className="font-bold text-lg text-text">{label}</h3>
              <p className="text-sm text-muted mt-1">{desc}</p>
              <div className="flex items-center gap-1 text-sm font-medium text-brand mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                Get started <ArrowRight size={14} />
              </div>
            </button>
          ))}
        </div>

        <div className="text-center">
          <p className="text-muted text-sm mb-4">Already have an account?</p>
          <button
            onClick={() => router.push("/auth/login")}
            className="btn-primary px-8"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
