const listeners = new Set<() => void>();
let revision = 0;

/** An in-memory presentation revision; persisted clearing generations remain in SQLite. */
export function getOfflineSnapshotsRevision(): number {
  return revision;
}

/** Notifies local readers after a committed snapshot change without coupling SQLite to React. */
export function notifyOfflineSnapshotsChanged(): void {
  revision += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A presentation listener must never turn a committed storage change into a failure.
    }
  });
}

export function subscribeOfflineSnapshots(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
