export const IMPRESSION_VIEW_TIME = 500;
export const IMPRESSION_BATCH_DELAY = 750;

export type VisibilityRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Checks actual card area against every clipping viewport. */
export function isBusinessCardVisible(
  card: VisibilityRect,
  viewports: VisibilityRect[],
) {
  if (card.width <= 0 || card.height <= 0) {
    return false;
  }

  let left = card.x;
  let top = card.y;
  let right = card.x + card.width;
  let bottom = card.y + card.height;

  for (const viewport of viewports) {
    left = Math.max(left, viewport.x);
    top = Math.max(top, viewport.y);
    right = Math.min(right, viewport.x + viewport.width);
    bottom = Math.min(bottom, viewport.y + viewport.height);
  }

  const area = Math.max(0, right - left) * Math.max(0, bottom - top);
  return area / (card.width * card.height) >= 0.5;
}

/** Owns mount-local dwell timers, batching, and pending/success deduplication. */
export function createBusinessImpressionTracker(
  submit: (businessIds: number[]) => Promise<unknown>,
) {
  let visible = new Set<number>();
  const dwellTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const reserved = new Set<number>();
  const pending = new Set<number>();
  let batchTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    clearTimeout(batchTimer);
    batchTimer = undefined;

    if (pending.size === 0) {
      return;
    }

    const businessIds = Array.from(pending);
    pending.clear();

    // Promise handlers touch only these sets, never React state after unmount.
    void submit(businessIds).catch(() => {
      for (const id of businessIds) {
        reserved.delete(id);
      }
    });
  };

  const updateVisible = (businessIds: number[]) => {
    const nextVisible = new Set(
      businessIds.filter((id) => Number.isInteger(id) && id > 0),
    );

    for (const [id, timer] of dwellTimers) {
      if (!nextVisible.has(id)) {
        clearTimeout(timer);
        dwellTimers.delete(id);
      }
    }

    for (const id of nextVisible) {
      if (visible.has(id) || reserved.has(id)) {
        continue;
      }

      dwellTimers.set(
        id,
        setTimeout(() => {
          dwellTimers.delete(id);
          reserved.add(id);
          pending.add(id);

          if (batchTimer === undefined) {
            batchTimer = setTimeout(flush, IMPRESSION_BATCH_DELAY);
          }
        }, IMPRESSION_VIEW_TIME),
      );
    }

    visible = nextVisible;
  };

  return {
    updateVisible,
    dispose: () => {
      updateVisible([]);
      // Only already-qualified impressions are flushed on teardown.
      flush();
    },
  };
}
