"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { LoginForm } from "@/components/layout/login-form";

export default function LoginPage() {
  const router = useRouter();
  const currentTeamAccount = useAppStore((s) => s.currentTeamAccount);
  const isAdmin = useAppStore((s) => s.isAdmin);

  useEffect(() => {
    if (currentTeamAccount || isAdmin) {
      router.push("/");
    }
  }, [currentTeamAccount, isAdmin, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <LoginForm />
    </div>
  );
}
