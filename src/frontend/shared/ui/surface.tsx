import type { HTMLAttributes, ReactNode } from "react";

export function Surface({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      className={`rounded-[var(--sg-radius-md)] border border-[var(--sg-line)] bg-[var(--sg-surface)] ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
