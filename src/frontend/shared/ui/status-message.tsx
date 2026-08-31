import type { HTMLAttributes, ReactNode } from "react";

type StatusTone = "neutral" | "success" | "danger";

const toneClass: Record<StatusTone, string> = {
  neutral: "text-[var(--sg-muted)]",
  success: "text-[var(--sg-success)]",
  danger: "text-[var(--sg-danger)]",
};

export function StatusMessage({
  tone = "neutral",
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <p
      className={`text-sm leading-5 ${toneClass[tone]} ${className}`.trim()}
      role={tone === "danger" ? "alert" : undefined}
      {...props}
    >
      {children}
    </p>
  );
}
