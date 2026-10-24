import { useEffect } from "react";

import { mountOfflinePocketSync } from "../services/offlinePocketSync.service";

/** Mounts foreground Pocket caching once without rendering UI or altering query/notification state. */
export default function OfflinePocketSync() {
  useEffect(() => mountOfflinePocketSync(), []);
  return null;
}
