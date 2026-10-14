export function nextDisputeSelection(previousItems, refreshedItems, resolvedId) {
  const previousIndex = previousItems.findIndex((item) => item.id === resolvedId);
  const availableItems = refreshedItems.filter((item) => item.id !== resolvedId);

  if (!availableItems.length) {
    return null;
  }

  const nextIndex = Math.min(
    Math.max(previousIndex, 0),
    availableItems.length - 1,
  );

  return availableItems[nextIndex].id;
}
