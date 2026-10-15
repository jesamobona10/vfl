"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  /** Optional inline action (for example "Undo"). Dismisses the toast on click. */
  action?: ToastAction;
  /** Override the auto-dismiss delay in milliseconds. */
  durationMs?: number;
}

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  action?: ToastAction;
  durationMs: number;
}

interface ToastContextValue {
  toast: (variant: ToastVariant, message: string, options?: ToastOptions) => number;
  success: (message: string, options?: ToastOptions) => number;
  error: (message: string, options?: ToastOptions) => number;
  info: (message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;
// Action toasts (undo) get a little longer so the button is reachable.
const ACTION_DISMISS_MS = 7000;

const VARIANT_STYLES: Record<ToastVariant, { container: string; icon: string }> = {
  success: {
    container: "border-brand-600/30 floating-panel",
    icon: "bg-brand-600 text-white",
  },
  error: {
    container: "border-danger/40 floating-panel",
    icon: "bg-danger text-white",
  },
  info: {
    container: "border-line floating-panel",
    icon: "bg-muted text-white",
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const styles = VARIANT_STYLES[toast.variant];

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      className={cn(
        "toast-pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg",
        styles.container
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          styles.icon
        )}
      >
        {toast.variant === "success" ? "✓" : toast.variant === "error" ? "!" : "i"}
      </span>
      <p className="flex-1 break-words text-sm leading-snug text-text">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onAction();
            onDismiss(toast.id);
          }}
          className="-mr-1 -mt-1 shrink-0 rounded-lg px-2 py-1 text-sm font-semibold text-brand-600 transition-colors hover:bg-brand-600/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="-mr-1 -mt-1 rounded-lg p-1 text-muted transition-colors hover:bg-muted/10 hover:text-text"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const mounted = useMounted();
  const nextId = useRef(1);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      if (!message) return id;
      const durationMs =
        options?.durationMs ?? (options?.action ? ACTION_DISMISS_MS : AUTO_DISMISS_MS);
      // Cap the stack so a burst of failures can't cover the screen.
      setToasts((prev) => [
        ...prev.slice(-4),
        { id, variant, message, action: options?.action, durationMs },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), durationMs)
      );
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((t) => clearTimeout(t));
      pending.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      info: (message, options) => push("info", message, options),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="assertive"
            // Pop-up notifications: bottom-center on mobile (clear of the
            // on-screen keyboard), top-right on desktop. Sits above the modal
            // (z-80) so confirmations stay visible.
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end sm:p-0"
            style={{ transform: "translateY(calc(-1 * var(--kb-inset, 0px)))" }}
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
