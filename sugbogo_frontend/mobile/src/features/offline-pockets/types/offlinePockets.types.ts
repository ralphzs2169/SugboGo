/** Pins local work to the authenticated session and the account's durable clear generation. */
export type OfflinePocketContext = Readonly<{
  apiScope: string;
  ownerId: number;
  sessionGeneration: number;
  clearGeneration: number;
}>;

export type OfflinePocketIntent = "automatic" | "restore" | "suppressed";
export type OfflinePocketWorkStatus =
  "pending" | "running" | "completed" | "failed" | "invalidated";

/** Identifies one revision of work; never persist its runtime session generation. */
export type OfflinePocketOperation = OfflinePocketContext &
  Readonly<{
    businessId: number;
    operationVersion: number;
  }>;

/** Control metadata only: completed work does not establish that a snapshot exists. */
export type OfflinePocketControl = {
  businessId: number;
  intent: OfflinePocketIntent;
  clearGeneration: number;
  operationVersion: number;
  workStatus: OfflinePocketWorkStatus;
  attempts: number;
  nextRetryAt: number | null;
  lastErrorCode: string | null;
  lastCompletedAt: number | null;
  cachedAt: number | null;
};
