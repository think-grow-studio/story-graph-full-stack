import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
  visual,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-[var(--sg-radius-md)] border border-dashed border-[var(--sg-line)] bg-[color-mix(in_srgb,var(--sg-surface)_78%,var(--sg-canvas))] px-6 py-10 text-center">
      <div className="grid max-w-sm justify-items-center gap-3">
        {visual ? <div aria-hidden="true">{visual}</div> : null}
        <div className="grid gap-1.5">
          <h2 className="text-base font-semibold text-[var(--sg-ink)]">{title}</h2>
          <p className="text-sm leading-6 text-[var(--sg-muted)]">{description}</p>
        </div>
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    </div>
  );
}
