import AsyncStorage from "@react-native-async-storage/async-storage";

const pendingWrites = new Map<number, Promise<void>>();

function completionKey(ownerId: number) {
  return `guided-tour:explorer-navigation:v1:${ownerId}`;
}

export async function hasHandledExplorerTour(ownerId: number) {
  // A rapid relogin must see a completion that is still being written.
  await pendingWrites.get(ownerId)?.catch(() => undefined);
  const value = await AsyncStorage.getItem(completionKey(ownerId));
  return value === "true";
}

export async function recordExplorerTourHandled(ownerId: number) {
  const existingWrite = pendingWrites.get(ownerId);
  if (existingWrite) return existingWrite;

  const write = AsyncStorage.setItem(completionKey(ownerId), "true");
  pendingWrites.set(ownerId, write);
  try {
    await write;
  } finally {
    pendingWrites.delete(ownerId);
  }
}
