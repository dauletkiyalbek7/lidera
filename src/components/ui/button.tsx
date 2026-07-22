import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[12px] font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-[0_6px_16px_-6px_rgba(8,208,141,0.9)] hover:bg-brand-600 active:bg-brand-700",
  secondary:
    "bg-surface text-ink border border-line hover:border-brand-200 hover:text-brand-700",
  ghost: "text-muted hover:bg-brand-50 hover:text-brand-700",
  danger: "bg-surface text-negative border border-line hover:bg-rose-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
