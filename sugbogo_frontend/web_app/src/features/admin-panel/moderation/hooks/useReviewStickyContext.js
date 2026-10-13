import { useEffect, useRef, useState } from "react";

export default function useReviewStickyContext(reviewId) {
  const scrollContainerRef = useRef(null);
  const reviewHeaderRef = useRef(null);
  const [showContextBar, setShowContextBar] = useState(false);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const reviewHeader = reviewHeaderRef.current;

    if (!scrollContainer || !reviewHeader) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowContextBar(!entry.isIntersecting);
      },
      {
        root: scrollContainer,
        threshold: 0,
      },
    );

    observer.observe(reviewHeader);

    return () => observer.disconnect();
  }, [reviewId]);

  return {
    scrollContainerRef,
    reviewHeaderRef,
    showContextBar,
  };
}
