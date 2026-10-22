import type { OfflinePocketOperation } from "../types/offlinePockets.types";
import { isAuthSessionCurrent } from "@/shared/api/authSessionGeneration.service";
import type { OfflineBusinessSnapshot } from "../validation/offlineBusinessSnapshot";
import {
  deleteOfflineCoverFile,
  downloadOfflineCover,
  newOfflineCoverName,
  offlineCoverFileUri,
} from "./offlinePocketCoverFiles";
import { subscribeOfflineSnapshots } from "./offlinePocketSnapshots.events";
import {
  cleanupOfflinePocketCoverFiles,
  captureOfflinePocketContext,
  discardOfflinePocketCover,
  listOfflineBusinessCovers,
  publishOfflinePocketCover,
  registerOfflinePocketCover,
  removeOfflinePocketCover,
  StaleOfflinePocketOperationError,
} from "./offlinePockets.service";

/** Adds one optional display cover to the existing worker; never creates or schedules cache intentions. */
export async function cacheOfflinePocketCover(
  operation: OfflinePocketOperation,
  snapshot: OfflineBusinessSnapshot,
  checkpoint: () => Promise<void>,
  hasMembership: () => Promise<boolean>,
  signal?: AbortSignal,
): Promise<void> {
  await checkpoint();
  const source = snapshot.business.display_cover_photo_url;
  if (!source) {
    // The validated API contract permits both null and an empty optional URL.
    await removeOfflinePocketCover(operation);
    return;
  }
  const previous = (await listOfflineBusinessCovers(operation)).find(
    (cover) => cover.businessId === operation.businessId,
  );
  if (
    previous?.remoteSource === source &&
    (await offlineCoverFileUri(operation, previous.fileName))
  )
    return;

  const name = newOfflineCoverName(operation.businessId);
  await registerOfflinePocketCover(operation, name, source);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) abort();
  // Clearing/removal emits after its transaction commits, aborting a now-obsolete transfer.
  const unsubscribe = subscribeOfflineSnapshots(() => {
    void checkpoint().catch(abort);
  });
  let release: (() => void) | undefined;
  let published = false;
  try {
    await checkpoint();
    release = await downloadOfflineCover(
      operation,
      name,
      source,
      controller.signal,
    );
    await checkpoint();
    if (!(await hasMembership())) return;
    await checkpoint();
    await publishOfflinePocketCover(operation, name, source);
    published = true;
  } finally {
    unsubscribe();
    signal?.removeEventListener("abort", abort);
    release?.();
    if (!published) {
      // This transfer owns this generated name. Cleanup never requires restoring authorization.
      await deleteOfflineCoverFile(operation, name).catch(() => undefined);
      await discardOfflinePocketCover(operation, name).catch(() => undefined);
    }
    try {
      await cleanupOfflinePocketCoverFiles(operation);
    } catch (error) {
      if (
        error instanceof StaleOfflinePocketOperationError &&
        isAuthSessionCurrent(operation.sessionGeneration)
      ) {
        // Clearing may have skipped an active file. Reacquire deletion-only garbage
        // cleanup authority for this same session, never publication/enqueue authority.
        const current = await captureOfflinePocketContext().catch(() => null);
        if (
          current?.ownerId === operation.ownerId &&
          current.apiScope === operation.apiScope &&
          current.sessionGeneration === operation.sessionGeneration
        ) {
          await cleanupOfflinePocketCoverFiles(current).catch(() => undefined);
        }
      }
    }
  }
}
