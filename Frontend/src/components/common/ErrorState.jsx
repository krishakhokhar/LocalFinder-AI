import { AlertTriangle, RefreshCw } from "lucide-react";
import Button from "./Button";

/**
 * Inline failure notice. Distinct from EmptyState on purpose: "nothing
 * matched" and "we could not load this" need different wording and a
 * different next step.
 */
export default function ErrorState({ title = "Something went wrong", message, onRetry, className = "" }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-card border border-danger-100 bg-danger-50 p-4 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold text-danger-700">{title}</p>
        {message ? <p className="mt-0.5 text-sm text-danger-700/90">{message}</p> : null}
        {onRetry ? (
          <Button variant="dangerGhost" size="xs" icon={RefreshCw} onClick={onRetry} className="mt-2 -ml-2">
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
