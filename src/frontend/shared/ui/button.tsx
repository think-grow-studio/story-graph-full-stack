import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonEmphasis = "solid" | "outline" | "ghost";
type ButtonIntent = "brand" | "neutral" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  emphasis?: ButtonEmphasis;
  intent?: ButtonIntent;
  busy?: boolean;
  children: ReactNode;
};

const baseClass =
  "relative inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--sg-radius-sm)] px-4 py-2 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-55";

const variants: Record<ButtonEmphasis, Record<ButtonIntent, string>> = {
  solid: {
    brand:
      "border border-[var(--sg-brand)] bg-[var(--sg-brand)] text-white hover:border-[var(--sg-brand-strong)] hover:bg-[var(--sg-brand-strong)]",
    neutral:
      "border border-[var(--sg-ink)] bg-[var(--sg-ink)] text-white hover:bg-[#2a2d33]",
    danger:
      "border border-[var(--sg-danger)] bg-[var(--sg-danger)] text-white hover:brightness-95",
  },
  outline: {
    brand:
      "border border-[color-mix(in_srgb,var(--sg-brand)_32%,var(--sg-line))] bg-[var(--sg-surface)] text-[var(--sg-brand-strong)] hover:bg-[color-mix(in_srgb,var(--sg-brand)_7%,white)]",
    neutral:
      "border border-[var(--sg-line)] bg-[var(--sg-surface)] text-[var(--sg-ink)] hover:bg-[var(--sg-canvas)]",
    danger:
      "border border-[color-mix(in_srgb,var(--sg-danger)_30%,var(--sg-line))] bg-[var(--sg-surface)] text-[var(--sg-danger)] hover:bg-[var(--sg-danger-soft)]",
  },
  ghost: {
    brand:
      "border border-transparent bg-transparent text-[var(--sg-brand-strong)] hover:bg-[color-mix(in_srgb,var(--sg-brand)_8%,transparent)]",
    neutral:
      "border border-transparent bg-transparent text-[var(--sg-muted)] hover:bg-[var(--sg-canvas)] hover:text-[var(--sg-ink)]",
    danger:
      "border border-transparent bg-transparent text-[var(--sg-danger)] hover:bg-[var(--sg-danger-soft)]",
  },
};

export function Button({
  emphasis = "solid",
  intent = "brand",
  busy = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={busy || undefined}
      className={`${baseClass} ${variants[emphasis][intent]} ${className}`.trim()}
      disabled={disabled || busy}
      type={type}
      {...props}
    >
      <span className={busy ? "opacity-55" : undefined}>{children}</span>
      {busy ? (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
    </button>
  );
}
