import type { SQLiteDatabase } from "expo-sqlite";

import { OFFLINE_POCKETS_SCHEMA_VERSION } from "../constants/offlinePockets.constants";
import { runOfflinePocketsTransaction } from "./offlinePocketsTransaction";

const INITIAL_SCHEMA = `
  CREATE TABLE offline_pocket_accounts (
    api_scope TEXT NOT NULL,
    owner_id INTEGER NOT NULL CHECK (owner_id > 0),
    clear_generation INTEGER NOT NULL DEFAULT 0
      CHECK (clear_generation BETWEEN 0 AND 9007199254740991),
    PRIMARY KEY (api_scope, owner_id)
  );

  CREATE TABLE offline_pocket_controls (
    api_scope TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    business_id INTEGER NOT NULL CHECK (business_id > 0),
    cache_intent TEXT NOT NULL
      CHECK (cache_intent IN ('automatic', 'restore', 'suppressed')),
    clear_generation INTEGER NOT NULL
      CHECK (clear_generation BETWEEN 0 AND 9007199254740991),
    operation_version INTEGER NOT NULL
      CHECK (operation_version BETWEEN 1 AND 9007199254740991),
    work_status TEXT NOT NULL
      CHECK (work_status IN ('pending', 'running', 'completed', 'failed', 'invalidated')),
    attempts INTEGER NOT NULL DEFAULT 0
      CHECK (attempts BETWEEN 0 AND 9007199254740991),
    next_retry_at INTEGER CHECK (next_retry_at >= 0),
    last_error_code TEXT,
    last_completed_at INTEGER CHECK (last_completed_at >= 0),
    cached_at INTEGER CHECK (cached_at >= 0),
    PRIMARY KEY (api_scope, owner_id, business_id),
    FOREIGN KEY (api_scope, owner_id)
      REFERENCES offline_pocket_accounts (api_scope, owner_id),
    CHECK ((cache_intent = 'suppressed') = (work_status = 'invalidated')),
    CHECK (next_retry_at IS NULL OR work_status = 'failed')
  );

  CREATE INDEX offline_pocket_work_status
    ON offline_pocket_controls (api_scope, owner_id, work_status, next_retry_at);
`;

const SNAPSHOT_SCHEMA = `
  CREATE TABLE offline_business_snapshots (
    api_scope TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    business_id INTEGER NOT NULL CHECK (business_id > 0),
    clear_generation INTEGER NOT NULL
      CHECK (clear_generation BETWEEN 0 AND 9007199254740991),
    format_version INTEGER NOT NULL CHECK (format_version > 0),
    fetched_at INTEGER NOT NULL CHECK (fetched_at >= 0),
    snapshot TEXT NOT NULL,
    PRIMARY KEY (api_scope, owner_id, business_id),
    FOREIGN KEY (api_scope, owner_id, business_id)
      REFERENCES offline_pocket_controls (api_scope, owner_id, business_id)
  );

  CREATE INDEX offline_business_snapshot_freshness
    ON offline_business_snapshots (api_scope, owner_id, fetched_at DESC, business_id);
`;

const COVER_SCHEMA = `
  CREATE TABLE offline_pocket_cover_files (
    api_scope TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    business_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    remote_source TEXT NOT NULL,
    clear_generation INTEGER NOT NULL CHECK (clear_generation >= 0),
    operation_version INTEGER NOT NULL CHECK (operation_version > 0),
    file_state TEXT NOT NULL CHECK (file_state IN ('staging', 'ready', 'garbage')),
    PRIMARY KEY (api_scope, owner_id, file_name),
    FOREIGN KEY (api_scope, owner_id, business_id)
      REFERENCES offline_pocket_controls (api_scope, owner_id, business_id)
  );
  CREATE UNIQUE INDEX offline_pocket_one_ready_cover
    ON offline_pocket_cover_files (api_scope, owner_id, business_id)
    WHERE file_state = 'ready';
`;

/** Commits schema changes and their version together, rejecting unsupported future databases. */
export async function migrateOfflinePocketsDatabase(
  db: SQLiteDatabase,
): Promise<void> {
  await runOfflinePocketsTransaction(db, async (tx) => {
    const row = await tx.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    const version = row?.user_version ?? 0;
    if (!Number.isSafeInteger(version) || version < 0) {
      throw new Error("Invalid Offline Pockets database schema version.");
    }
    if (version > OFFLINE_POCKETS_SCHEMA_VERSION) {
      throw new Error("This Offline Pockets database requires a newer app.");
    }
    if (version === 0) {
      await tx.execAsync(INITIAL_SCHEMA);
      await tx.execAsync("PRAGMA user_version = 1");
    }
    if (version < 2) {
      await tx.execAsync(SNAPSHOT_SCHEMA);
      await tx.execAsync("PRAGMA user_version = 2");
    }
    if (version < 3) {
      await tx.execAsync(COVER_SCHEMA);
      await tx.execAsync("PRAGMA user_version = 3");
    }
  });
}
