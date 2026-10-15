import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, hint, error, className, containerClassName, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn(containerClassName ?? "w-full")}>
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("input", error && "border-danger focus:border-danger focus:ring-danger/30", className)}
        {...rest}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
