import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldChromeProps = {
  label: string;
  helpText?: string;
  error?: string | null;
};

const inputClass =
  "w-full rounded-[var(--sg-radius-sm)] border border-[var(--sg-line)] bg-[var(--sg-surface)] px-3 py-2.5 text-sm text-[var(--sg-ink)] shadow-[0_1px_1px_rgba(23,25,29,0.02)] outline-none placeholder:text-[color-mix(in_srgb,var(--sg-muted)_70%,white)] focus:border-[var(--sg-focus)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--sg-focus)_14%,transparent)] disabled:cursor-not-allowed disabled:bg-[var(--sg-canvas)] disabled:text-[var(--sg-muted)]";

function FieldMeta({
  id,
  helpText,
  error,
}: {
  id: string;
  helpText?: string;
  error?: string | null;
}) {
  if (error) {
    return (
      <p className="text-xs leading-5 text-[var(--sg-danger)]" id={`${id}-error`}>
        {error}
      </p>
    );
  }
  if (helpText) {
    return (
      <p className="text-xs leading-5 text-[var(--sg-muted)]" id={`${id}-help`}>
        {helpText}
      </p>
    );
  }
  return null;
}

function describedBy(id: string, helpText?: string, error?: string | null) {
  if (error) return `${id}-error`;
  if (helpText) return `${id}-help`;
  return undefined;
}

export function TextField({
  label,
  helpText,
  error,
  id: providedId,
  className = "",
  ...props
}: FieldChromeProps & InputHTMLAttributes<HTMLInputElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <div className="grid gap-1.5 text-sm font-medium text-[var(--sg-ink)]">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={describedBy(id, helpText, error)}
        aria-invalid={Boolean(error) || undefined}
        className={`${inputClass} ${className}`.trim()}
        id={id}
        {...props}
      />
      <FieldMeta error={error} helpText={helpText} id={id} />
    </div>
  );
}

export function TextAreaField({
  label,
  helpText,
  error,
  id: providedId,
  className = "",
  ...props
}: FieldChromeProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <div className="grid gap-1.5 text-sm font-medium text-[var(--sg-ink)]">
      <label htmlFor={id}>{label}</label>
      <textarea
        aria-describedby={describedBy(id, helpText, error)}
        aria-invalid={Boolean(error) || undefined}
        className={`${inputClass} min-h-28 resize-none ${className}`.trim()}
        id={id}
        {...props}
      />
      <FieldMeta error={error} helpText={helpText} id={id} />
    </div>
  );
}

export function SelectField({
  label,
  helpText,
  error,
  id: providedId,
  className = "",
  children,
  ...props
}: FieldChromeProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;

  return (
    <div className="grid gap-1.5 text-sm font-medium text-[var(--sg-ink)]">
      <label htmlFor={id}>{label}</label>
      <select
        aria-describedby={describedBy(id, helpText, error)}
        aria-invalid={Boolean(error) || undefined}
        className={`${inputClass} cursor-pointer ${className}`.trim()}
        id={id}
        {...props}
      >
        {children}
      </select>
      <FieldMeta error={error} helpText={helpText} id={id} />
    </div>
  );
}
