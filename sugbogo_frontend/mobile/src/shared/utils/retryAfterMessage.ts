/**
 * Converts retry_after seconds into a readable message.
 */
export function getRetryAfterMessage(retryAfter?: number) {
  if (!retryAfter) {
    return "Please try again later.";
  }

  if (retryAfter < 60) {
    return `Please try again in ${retryAfter} second${
      retryAfter === 1 ? "" : "s"
    }.`;
  }

  const minutes = Math.ceil(retryAfter / 60);

  return `Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
