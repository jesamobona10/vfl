"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

/** True once hydrated on the client (safe to render portals). */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional secondary line rendered under the title. */
  subtitle?: string;
  children: ReactNode;
  /** Extra actions rendered in the header beside the close button. */
  headerActions?: ReactNode;
  /** Sticky footer pinned to the bottom of the dialog. */
  footer?: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: portal-rendered, focus-trapped, Esc-to-close,
 * restores focus to the trigger on dismiss.
 */
export function Modal({ open, onClose, title, subtitle, children, headerActions, footer, className }: ModalProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Focus trap: cycle between first and last focusable elements.
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog after paint.
    requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? panelRef.current)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, handleKeyDown]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn("card w-full max-w-lg max-h-[90vh] overflow-y-auto outline-none", className)}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-muted truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            <button type="button" onClick={onClose} aria-label="Close dialog" className="btn-icon">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 border-t border-line bg-surface px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
}
