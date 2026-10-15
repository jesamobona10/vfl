import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CardPadding = "none" | "sm" | "md" | "lg";

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...rest} />;
}

export function CardHeader({
  className,
  padding = "md",
  ...rest
}: CardSectionProps) {
  return (
    <div
      className={cn("flex items-center justify-between gap-3 border-b border-line", PADDING[padding], className)}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-section", className)} {...rest} />;
}

export function CardBody({ className, padding = "md", ...rest }: CardSectionProps) {
  return <div className={cn(PADDING[padding], className)} {...rest} />;
}

export function CardFooter({ className, padding = "md", ...rest }: CardSectionProps) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 border-t border-line", PADDING[padding], className)}
      {...rest}
    />
  );
}
