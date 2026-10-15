"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface ShareMatchButtonProps {
  title: string;
  text: string;
  url?: string;
  className?: string;
}

export function ShareMatchButton({ title, text, url, className }: ShareMatchButtonProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const shareUrl = () => url ?? (typeof window !== "undefined" ? window.location.href : "");

  const handleShare = async () => {
    const link = shareUrl();
    const shareData: ShareData = { title, text, url: link };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        // A user dismissing the share sheet is not an error; fall through to copy
        // only when the platform rejects the share for another reason.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Link copied to clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link. Copy it from the address bar instead.");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleShare()}
      className={
        className ??
        "inline-flex min-h-10 items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink-2 transition-colors hover:border-brand/30 hover:bg-surface-2"
      }
      aria-label="Share this match"
    >
      {copied ? <Check size={16} /> : <Share2 size={16} />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
