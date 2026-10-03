function identity(item) {
  return String(item?.id ?? "");
}

function specialtyIds(classification) {
  return new Set(
    (classification?.specialty_tags ?? []).map((tag) => identity(tag)),
  );
}

/** Compares live and captured classification identities without relying on tag order or labels. */
export function classificationMatches(first, second) {
  if (!first || !second) {
    return false;
  }

  if (
    identity(first.category) !== identity(second.category) ||
    identity(first.cluster) !== identity(second.cluster)
  ) {
    return false;
  }

  const firstIds = specialtyIds(first);
  const secondIds = specialtyIds(second);

  return (
    firstIds.size === secondIds.size &&
    [...firstIds].every((id) => secondIds.has(id))
  );
}

/** A pending request needs full comparison when its captured live baseline has changed. */
export function hasStalePendingBaseline(request) {
  return (
    request?.status === "pending" &&
    !classificationMatches(request.current, request.previous)
  );
}

/** Describes the category, cluster, and specialty changes requested from the captured baseline. */
export function getClassificationDiff(previous, proposed) {
  const previousTags = previous?.specialty_tags ?? [];
  const proposedTags = proposed?.specialty_tags ?? [];
  const previousIds = specialtyIds(previous);
  const proposedIds = specialtyIds(proposed);

  return {
    categoryChanged:
      identity(previous?.category) !== identity(proposed?.category),
    clusterChanged: identity(previous?.cluster) !== identity(proposed?.cluster),
    removedSpecialties: previousTags.filter(
      (tag) => !proposedIds.has(identity(tag)),
    ),
    retainedSpecialties: proposedTags.filter((tag) =>
      previousIds.has(identity(tag)),
    ),
    addedSpecialties: proposedTags.filter(
      (tag) => !previousIds.has(identity(tag)),
    ),
  };
}
