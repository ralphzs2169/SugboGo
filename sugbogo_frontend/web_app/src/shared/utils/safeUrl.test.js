import assert from "node:assert/strict";
import test from "node:test";
import { safeHttpUrl } from "./safeUrl.js";

test("rejects executable, data, malformed, and obfuscated URL schemes", () => {
  for (const url of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "//evil.example/path", "/\\evil.example/path", "https://", null]) {
    assert.equal(safeHttpUrl(url), undefined);
    assert.equal(safeHttpUrl(url, { allowBareDomain: true }), undefined);
  }
});

test("accepts signed web URLs and same-origin resources", () => {
  assert.equal(safeHttpUrl("https://res.cloudinary.com/demo/image/upload/photo.jpg?signature=abc"), "https://res.cloudinary.com/demo/image/upload/photo.jpg?signature=abc");
  assert.equal(safeHttpUrl("/avatars/default.svg"), "/avatars/default.svg");
  assert.equal(safeHttpUrl("http://localhost:8000/api/document/"), "http://localhost:8000/api/document/");
});

test("blob previews and bare business domains require explicit opt-in", () => {
  const blob = "blob:https://admin.example.com/preview-id";
  assert.equal(safeHttpUrl(blob), undefined);
  assert.equal(safeHttpUrl(blob, { allowBlob: true }), blob);
  assert.equal(safeHttpUrl("example.com"), undefined);
  assert.equal(safeHttpUrl("example.com", { allowBareDomain: true }), "https://example.com/");
  assert.equal(safeHttpUrl("javascript:alert(1)", { allowBareDomain: true }), undefined);
});
