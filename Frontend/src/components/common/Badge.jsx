const TONES = {
  neutral: "bg-slate-100 text-ink-muted",
  brand: "bg-brand-50 text-brand-700",
  ai: "bg-ai-50 text-ai-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  outline: "border border-line bg-surface text-ink-muted",
};

const SIZES = {
  xs: "px-2 py-0.5 text-2xs gap-1",
  sm: "px-2.5 py-1 text-xs gap-1.5",
};

/** Compact status/label chip. Icons are decorative and always aria-hidden. */
export default function Badge({ children, tone = "neutral", size = "sm", icon: Icon, className = "", ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${TONES[tone] || TONES.neutral} ${
        SIZES[size] || SIZES.sm
      } ${className}`}
      {...props}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
