import AsyncStorage from "@react-native-async-storage/async-storage";

const pendingWrites = new Map<string, Promise<void>>();
type Tour = "explorer-navigation" | "pockets-bookmark";

function completionKey(ownerId: number, tour: Tour) {
  return `guided-tour:${tour}:v1:${ownerId}`;
}

export async function hasHandledExplorerTour(
  ownerId: number,
  tour: Tour = "explorer-navigation",
) {
  const key = completionKey(ownerId, tour);
  // A rapid relogin must see a completion that is still being written.
  await pendingWrites.get(key)?.catch(() => undefined);
  const value = await AsyncStorage.getItem(key);
  return value === "true";
}

export async function recordExplorerTourHandled(
  ownerId: number,
  tour: Tour = "explorer-navigation",
) {
  const key = completionKey(ownerId, tour);
  const existingWrite = pendingWrites.get(key);
  if (existingWrite) return existingWrite;

  const write = AsyncStorage.setItem(key, "true");
  pendingWrites.set(key, write);
  try {
    await write;
  } finally {
    pendingWrites.delete(key);
  }
}
