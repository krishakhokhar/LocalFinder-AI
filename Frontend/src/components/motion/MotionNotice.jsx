import useMotionSafe, { isMotionForced, setMotionForced } from "../../hooks/useMotionSafe";

/**
 * Development-only banner explaining why the interface is not moving.
 *
 * Every animation in the product runs through `useMotionSafe`, which
 * disables all of them when the machine asks for reduced motion. That is
 * the correct behaviour, but from the outside it is identical to the
 * animations being broken - so this says which it is, and offers a local
 * preview toggle.
 *
 * Renders nothing in a production build.
 */
export default function MotionNotice() {
  const { systemReduce } = useMotionSafe();
  if (!import.meta.env.DEV || !systemReduce) return null;

  const forced = isMotionForced();

  return (
    <div className="fixed bottom-4 left-4 z-[1200] max-w-sm rounded-card border border-warning-200 bg-warning-50 p-3.5 shadow-lift">
      <p className="text-xs font-bold text-warning-800">
        {forced ? "Animations forced on (preview)" : "Animations are switched off"}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-warning-700">
        {forced
          ? "Your system still asks for reduced motion — real visitors with that setting will see a static interface. This preview is local and never ships."
          : "Your system has “reduce motion” enabled, so every animation is intentionally disabled. This is the accessibility preference being honoured, not a bug."}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMotionForced(!forced)}
          className="rounded-lg bg-warning-600 px-2.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-warning-700"
        >
          {forced ? "Respect my setting again" : "Preview animations anyway"}
        </button>
        <span className="text-2xs text-warning-700/80">Dev only</span>
      </div>
    </div>
  );
}
