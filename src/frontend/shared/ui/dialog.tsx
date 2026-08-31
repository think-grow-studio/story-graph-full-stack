"use client";

import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  className = "",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (open) {
      if (document.activeElement instanceof HTMLElement) {
        triggerRef.current = document.activeElement;
      }
      if (dialog && !dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      dialog?.querySelector<HTMLElement>(focusableSelector)?.focus();
      return;
    }

    if (dialog?.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
    triggerRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      aria-describedby={description ? descriptionId : undefined}
      aria-labelledby={titleId}
      aria-modal="true"
      className={`m-auto w-[min(92vw,520px)] rounded-[var(--sg-radius-lg)] border border-[var(--sg-line)] bg-[var(--sg-surface)] p-0 text-[var(--sg-ink)] shadow-[0_24px_70px_rgba(23,25,29,0.18)] backdrop:bg-[rgba(23,25,29,0.34)] ${className}`.trim()}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
      ref={dialogRef}
      role="dialog"
    >
      <div className="grid gap-5 p-6">
        <header className="grid gap-1.5">
          <h2 className="text-xl font-semibold tracking-[-0.02em]" id={titleId}>
            {title}
          </h2>
          {description ? (
            <p className="text-sm leading-6 text-[var(--sg-muted)]" id={descriptionId}>
              {description}
            </p>
          ) : null}
        </header>
        {children}
      </div>
    </dialog>
  );
}
