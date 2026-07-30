import { useEffect, useState } from "react";

/**
 * hook that tracks whether a CSS media query currently matches.
 *
 * The returned value automatically updates whenever the viewport changes,
 * making it useful for implementing responsive behavior in React components.
 *
 * @example
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 *
 * @param {string} query - CSS media query to evaluate.
 *
 * @returns {boolean} `true` if the media query currently matches; otherwise `false`.
 */
export default function useMediaQuery(query) {
  const getMatches = () => {
    if (typeof window === "undefined") return false;

    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  /**
   * Determines whether the media query currently matches.
   * Returns `false` during server-side rendering.
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    const handleChange = (event) => {
      setMatches(event.matches);
    };

    setMatches(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [query]);

  return matches;
}
