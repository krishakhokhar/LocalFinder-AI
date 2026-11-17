import { forwardRef, useId } from "react";

/**
 * Form primitives.
 *
 * Every input is wrapped in a <Field> that owns the label, the error and
 * the aria wiring, so a validation message is always announced to screen
 * readers and always sits in the same place visually.
 */
export function Field({ label, htmlFor, error, hint, required, children, className = "" }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-soft">
          {label}
          {required ? <span className="ml-0.5 text-danger-500">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const baseControl =
  "w-full rounded-xl border bg-surface px-3.5 text-sm text-ink-soft transition-colors duration-200 " +
  "placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50";

const stateClasses = (error) =>
  error
    ? "border-danger-300 focus:border-danger-500 focus:ring-danger-500/25"
    : "border-line hover:border-line-strong focus:border-brand-600 focus:ring-brand-600/20";

export const Input = forwardRef(function Input(
  { label, error, hint, icon: Icon, suffix, className = "", id, required, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={`${baseControl} ${stateClasses(error)} h-11 ${Icon ? "pl-10" : ""} ${suffix ? "pr-11" : ""}`}
          {...props}
        />
        {suffix ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{suffix}</div> : null}
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, rows = 4, className = "", id, required, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={`${baseControl} ${stateClasses(error)} resize-y py-2.5 leading-relaxed`}
        {...props}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, options = [], className = "", id, required, children, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={error ? "true" : undefined}
        className={`${baseControl} ${stateClasses(error)} h-11 pr-9`}
        {...props}
      >
        {children ||
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
    </Field>
  );
});

export function Checkbox({ label, description, id, className = "", ...props }) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <label htmlFor={inputId} className={`flex cursor-pointer items-start gap-3 ${className}`}>
      <input
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line text-brand-600 focus:ring-brand-600/30"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-soft">{label}</span>
        {description ? <span className="block text-xs text-ink-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export default Input;
