import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import { createServer } from "vite";

let server;
let ReviewContentCard;

before(async () => {
  server = await createServer({
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ default: ReviewContentCard } = await server.ssrLoadModule(
    "/src/features/admin-panel/moderation/components/ReviewContentCard.jsx",
  ));
});

after(async () => {
  await server?.close();
});

test("review photos open through viewer buttons instead of external links", () => {
  const review = {
    text: "Review content",
    photos: [
      { id: 1, photo_url: "https://example.com/photo-one.jpg" },
      { id: 2, photo_url: "https://example.com/photo-two.jpg" },
    ],
    like_count: 0,
  };
  const html = renderToString(
    React.createElement(ReviewContentCard, { review }),
  );

  assert.match(html, /aria-label="View review photo 1"/);
  assert.match(html, /aria-label="View review photo 2"/);
  assert.doesNotMatch(html, /<a[^>]+href="https:\/\/example.com\/photo-/);
  assert.doesNotMatch(html, /target="_blank"/);
});
