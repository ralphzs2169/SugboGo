import assert from "node:assert/strict";
import { test } from "node:test";

import {
  focusMatchingReview,
  relatedReviewTargetId,
} from "./relatedReviewNavigation.js";
import { firstReviewOnLoadedPage } from "./queueSelection.js";

test("page selection waits for the requested page and clears on an empty page", () => {
  const pageTwo = {
    targetPage: 2,
    loadedPage: 1,
    isLoading: false,
    isPlaceholderData: true,
    error: null,
    reviews: [{ id: 83 }],
  };

  assert.equal(firstReviewOnLoadedPage(pageTwo), undefined);
  assert.equal(firstReviewOnLoadedPage({
    ...pageTwo,
    loadedPage: 2,
    isPlaceholderData: false,
    reviews: [{ id: 91 }, { id: 92 }],
  }), 91);
  assert.equal(firstReviewOnLoadedPage({
    ...pageTwo,
    loadedPage: 2,
    isPlaceholderData: false,
    reviews: [],
  }), null);
  assert.equal(firstReviewOnLoadedPage({
    ...pageTwo,
    loadedPage: 2,
    isPlaceholderData: false,
    error: new Error("Unavailable"),
  }), undefined);
  assert.equal(firstReviewOnLoadedPage({
    ...pageTwo,
    targetPage: null,
    loadedPage: 1,
    isPlaceholderData: false,
  }), undefined);
});

test("related review targets remain unique across signals", () => {
  assert.notEqual(
    relatedReviewTargetId("duplicate_content", 41),
    relatedReviewTargetId("rapid_submission", 41),
  );
});

test("View review focuses and scrolls within the investigation panel", () => {
  const calls = [];
  const scrollContainer = {
    scrollTop: 120,
    getBoundingClientRect: () => ({ top: 40 }),
    scrollTo: (options) => calls.push(["scroll", options]),
  };
  const target = {
    closest: () => scrollContainer,
    getBoundingClientRect: () => ({ top: 240 }),
    focus: (options) => calls.push(["focus", options]),
  };
  const documentRef = {
    getElementById: (id) => {
      assert.equal(id, "related-review-duplicate_content-41");
      return target;
    },
  };

  assert.equal(focusMatchingReview(41, documentRef, {
    matchMedia: () => ({ matches: false }),
  }), true);
  assert.deepEqual(calls, [
    ["focus", { preventScroll: true }],
    ["scroll", { top: 240, behavior: "smooth" }],
  ]);
});

test("View review respects reduced motion and missing targets", () => {
  const calls = [];
  const target = {
    closest: () => null,
    focus: (options) => calls.push(["focus", options]),
    scrollIntoView: (options) => calls.push(["scroll", options]),
  };
  const documentRef = {
    getElementById: () => target,
  };

  assert.equal(focusMatchingReview(41, documentRef, {
    matchMedia: () => ({ matches: true }),
  }), true);
  assert.deepEqual(calls, [
    ["focus", { preventScroll: true }],
    ["scroll", { behavior: "auto", block: "center" }],
  ]);
  assert.equal(focusMatchingReview(99, {
    getElementById: () => null,
  }, {}), false);
});
