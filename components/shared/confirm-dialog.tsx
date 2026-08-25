"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const emptySubscribe = () => () => {};

/** True once hydrated on the client (safe to render portals). */
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Promise-based destructive-action confirmation dialog.
 * Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete team?", description: "..." }))) return;
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    return () => {
      // If the component unmounts mid-prompt, resolve as cancelled.
      resolver.current?.(false);
      resolver.current = null;
    };
  }, []);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false); // supersede any pending prompt
      resolver.current = resolve;
      setOptions(opts);
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    setOptions(null);
    resolver.current?.(ok);
    resolver.current = null;
  }, []);

  useEffect(() => {
    if (!options) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [options, settle]);

  const element =
    mounted && options
      ? createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
            <div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby={options.description ? "confirm-description" : undefined}
              className="floating-panel rounded-xl w-full max-w-sm p-5"
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  // rudimentary focus trap between the two buttons
                  const buttons = e.currentTarget.querySelectorAll("button");
                  if (buttons.length < 2) return;
                  const first = buttons[0]!;
                  const last = buttons[buttons.length - 1]!;
                  if (document.activeElement === last && !e.shiftKey) {
                    e.preventDefault();
                    first.focus();
                  } else if (document.activeElement === first && e.shiftKey) {
                    e.preventDefault();
                    last.focus();
                  }
                }
              }}
            >
              <h2 id="confirm-title" className="text-base font-semibold text-text">
                {options.title}
              </h2>
              {options.description && (
                <p id="confirm-description" className="mt-1.5 text-sm text-muted">
                  {options.description}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" autoFocus className="btn btn-secondary btn-sm" onClick={() => settle(false)}>
                  {options.cancelLabel ?? "Cancel"}
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => settle(true)}>
                  {options.confirmLabel ?? "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return { confirm, dialog: element };
}
