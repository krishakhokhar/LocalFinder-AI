import Spinner from "./Spinner";

/**
 * Shown while a lazily-loaded route is fetched.
 *
 * Deliberately a full-height block with the navbar's height subtracted,
 * so the page does not visibly collapse and re-expand as the chunk
 * arrives - a jumping layout reads as a bug even when nothing is wrong.
 */
export default function RouteFallback() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas">
      <Spinner size="lg" label="Loading page" />
    </div>
  );
}
