import { Loader2 } from "lucide-react";

const SIZES = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-9 w-9" };

export default function Spinner({ size = "md", label = "Loading", className = "" }) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 ${className}`}>
      <Loader2 className={`${SIZES[size] || SIZES.md} animate-spin text-brand-600`} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
