/** Restrict user-supplied resource URLs to web URLs and same-origin paths. */
export function safeHttpUrl(value, { allowBlob = false, allowBareDomain = false } = {}) {
  if (typeof value !== "string") return undefined;
  let candidate = value.trim();
  if (!candidate || /[\u0000-\u001f\u007f\\]/.test(candidate)) return undefined;
  if (candidate.startsWith("/") && !candidate.startsWith("//")) return candidate;
  if (allowBareDomain && !/^[a-z][a-z\d+.-]*:/i.test(candidate) && !candidate.startsWith("//")) {
    candidate = `https://${candidate}`;
  }
  try {
    const url = new URL(candidate);
    if (["http:", "https:"].includes(url.protocol) || (allowBlob && url.protocol === "blob:")) return url.href;
  } catch {
    // Invalid values render without an actionable URL.
  }
  return undefined;
}
