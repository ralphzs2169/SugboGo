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
  assert.match(html, /max-w-\[200px\]/);
  assert.match(html, /aspect-\[4\/3\] w-full object-cover/);
  assert.match(html.replaceAll("<!-- -->", ""), /Review photos \(2\)/);
  assert.doesNotMatch(html.replaceAll("<!-- -->", ""), />2 photos</);
  assert.doesNotMatch(html, /<a[^>]+href="https:\/\/example.com\/photo-/);
  assert.doesNotMatch(html, /target="_blank"/);
});

test("review text, helpful count, edit time, and merchant response share one presentation", () => {
  const html = renderToString(
    React.createElement(ReviewContentCard, {
      review: {
        text: "A helpful visit",
        photos: [],
        like_count: 3,
        is_edited: true,
        edited_at: "2026-10-11T01:42:00Z",
        reply: {
          text: "Thank you for visiting.",
          created_at: "2026-10-11T02:15:00Z",
        },
      },
    }),
  );

  assert.match(html, /aria-label="Review content"/);
  assert.match(html, /A helpful visit/);
  assert.doesNotMatch(html, /REVIEW CONTENT/);
  assert.match(html.replaceAll("<!-- -->", ""), /3 found this helpful/);
  assert.match(html, /Edited Oct 11, 2026 ·/);
  assert.match(html, /Merchant Response/);
  assert.match(html, /Thank you for visiting/);
  assert.match(html, /dateTime="2026-10-11T02:15:00Z"/);
});

test("missing reply and missing like count do not create empty context", () => {
  const html = renderToString(
    React.createElement(ReviewContentCard, {
      review: { text: "", photos: [] },
    }),
  );

  assert.match(html, /No written review\./);
  assert.doesNotMatch(html, /Merchant Response|found this helpful|Review photos/);
  assert.doesNotMatch(html, /mt-3 flex flex-wrap items-center gap-x-4/);
});

test("a zero helpful count and an edited flag without a timestamp remain accurate", () => {
  const html = renderToString(
    React.createElement(ReviewContentCard, {
      review: {
        text: "Updated review",
        photos: [],
        like_count: 0,
        is_edited: true,
      },
    }),
  );

  assert.match(html.replaceAll("<!-- -->", ""), /0 found this helpful/);
  assert.match(html, />Edited</);
  assert.doesNotMatch(html, /Edited Oct/);
});
