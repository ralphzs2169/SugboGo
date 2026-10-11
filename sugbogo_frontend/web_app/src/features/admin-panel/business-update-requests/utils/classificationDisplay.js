/** Adds current taxonomy visuals without replacing historical tag identity or name. */
export function withSpecialtyDisplay(tag, metadataById = {}) {
  const metadata = metadataById[String(tag.id)];

  return {
    ...tag,
    color: tag.color || metadata?.color,
    icon: tag.icon || metadata?.icon,
  };
}

/** Adds an existing cluster icon while preserving the captured cluster name. */
export function withClusterDisplay(cluster, metadataById = {}) {
  if (!cluster) {
    return cluster;
  }

  const metadata = metadataById[String(cluster.id)];

  return {
    ...cluster,
    icon: cluster.icon || metadata?.icon,
  };
}
