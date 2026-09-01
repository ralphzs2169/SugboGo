/**
 * Provides a persistent sticky context bar for long admin pages.
 *
 * Keeps caller-provided content visible while scrolling without imposing
 * page-specific navigation, identity, or status behavior.
 */
export default function StickyContextBar({ children }) {
  return (
    <div className="sticky top-16 z-30 -mx-6 w-[calc(100%+3rem)] border-b border-stroke bg-background/90 backdrop-blur">
      <div className="flex h-12 w-full min-w-0 items-center justify-between gap-4 px-6">
        {children}
      </div>
    </div>
  );
}
