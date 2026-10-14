export function relatedReviewTargetId(reason, reviewId) {
  return `related-review-${reason}-${reviewId}`;
}

export function focusMatchingReview(
  reviewId,
  documentRef = document,
  windowRef = window,
) {
  const target = documentRef.getElementById(
    relatedReviewTargetId("duplicate_content", reviewId),
  );
  if (!target) {
    return false;
  }

  const reducedMotion = windowRef.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  const behavior = reducedMotion ? "auto" : "smooth";
  const scrollContainer = target.closest("[data-suspicious-investigation-scroll]");

  target.focus({ preventScroll: true });
  if (scrollContainer) {
    const targetBounds = target.getBoundingClientRect();
    const containerBounds = scrollContainer.getBoundingClientRect();
    scrollContainer.scrollTo({
      top: Math.max(
        0,
        scrollContainer.scrollTop + targetBounds.top - containerBounds.top - 80,
      ),
      behavior,
    });
  } else {
    target.scrollIntoView?.({ behavior, block: "center" });
  }

  return true;
}
