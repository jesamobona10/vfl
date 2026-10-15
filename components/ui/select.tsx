import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { id, label, hint, error, className, containerClassName, children, ...rest },
  ref
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  return (
    <div className={cn(containerClassName ?? "w-full")}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("input", error && "border-danger focus:border-danger focus:ring-danger/30", className)}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="mt-1 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
