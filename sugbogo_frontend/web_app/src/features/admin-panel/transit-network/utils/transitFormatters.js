export function formatVariantLabel(variant) {
  if (!variant) {
    return "Unknown variant";
  }

  return `${variant.route_code} · ${variant.origin?.name ?? "Unknown"} → ${
    variant.destination?.name ?? "Unknown"
  }`;
}

export function getApiFieldErrors(error) {
  const responseErrors = error.response?.data?.errors ?? {};

  return Object.fromEntries(
    Object.entries(responseErrors).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages[0] : messages,
    ]),
  );
}
