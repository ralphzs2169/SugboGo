import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { Image as NativeImage, Platform } from "react-native";

import {
  MAX_OFFLINE_COVER_BYTES,
  OFFLINE_COVER_TIMEOUT_MS,
} from "../constants/offlinePockets.constants";
import type { OfflinePocketContext } from "../types/offlinePockets.types";

type FileOwner = Pick<OfflinePocketContext, "apiScope" | "ownerId">;
const activeFiles = new Set<string>();
const NAME = /^b[1-9]\d*-[a-f0-9-]{36}\.img$/;

export class OfflineCoverError extends Error {
  constructor(public readonly retryable: boolean) {
    super("The optional offline cover could not be saved.");
  }
}

/** Uses a digest rather than a URL/path fragment, isolating every API/account directory. */
async function accountDirectory(owner: FileOwner): Promise<Directory> {
  const { apiScope, ownerId } = owner;
  if (Platform.OS === "web" || !Number.isSafeInteger(ownerId) || ownerId <= 0) {
    throw new OfflineCoverError(false);
  }
  const scope = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    apiScope,
  );
  return new Directory(
    Paths.document,
    "offline-pocket-covers",
    scope,
    String(ownerId),
  );
}

export function assertOfflineCoverName(
  name: string,
  businessId?: number,
): void {
  if (
    !NAME.test(name) ||
    (businessId !== undefined && !name.startsWith(`b${businessId}-`))
  ) {
    throw new OfflineCoverError(false);
  }
}

export function newOfflineCoverName(businessId: number): string {
  const name = `b${businessId}-${Crypto.randomUUID()}.img`;
  assertOfflineCoverName(name, businessId);
  return name;
}

async function managedFile(owner: FileOwner, name: string): Promise<File> {
  assertOfflineCoverName(name);
  return new File(await accountDirectory(owner), name);
}

/** Returns only current app-owned file URIs, never stored absolute paths or remote fallbacks. */
export async function offlineCoverFileUri(
  owner: FileOwner,
  name: string,
): Promise<string | null> {
  try {
    const file = await managedFile(owner, name);
    return file.uri.startsWith("file://") && file.exists && file.size > 0
      ? file.uri
      : null;
  } catch {
    return null;
  }
}

/** Deletes exact generated files only. Active downloads finish cancellation before garbage collection. */
export async function deleteOfflineCoverFile(
  owner: FileOwner,
  name: string,
): Promise<boolean> {
  const file = await managedFile(owner, name);
  if (activeFiles.has(file.uri)) return false;
  const part = new File(`${file.uri}.part`);
  if (part.exists) part.delete();
  if (file.exists) file.delete();
  return true;
}

/** Stages, bounds and decodes a single cover before moving it to an immutable managed filename. */
export async function downloadOfflineCover(
  owner: FileOwner,
  name: string,
  source: string,
  signal: AbortSignal,
): Promise<() => void> {
  const file = await managedFile(owner, name);
  const part = new File(`${file.uri}.part`);
  const controller = new AbortController();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, OFFLINE_COVER_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort);
  if (signal.aborted) abort();
  activeFiles.add(file.uri);
  let succeeded = false;
  try {
    if (controller.signal.aborted || !/^https?:\/\//i.test(source))
      throw new OfflineCoverError(false);
    file.parentDirectory.create({ intermediates: true, idempotent: true });
    try {
      await File.downloadFileAsync(source, part, {
        signal: controller.signal,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (
            bytesWritten > MAX_OFFLINE_COVER_BYTES ||
            totalBytes > MAX_OFFLINE_COVER_BYTES
          )
            abort();
        },
      });
    } catch (error) {
      // Expo documents non-2xx errors including the HTTP status in their message.
      const status =
        error instanceof Error
          ? /(?:HTTP|status[:\s]*)\s*(\d{3})/i.exec(error.message)?.[1]
          : undefined;
      const permanent =
        status !== undefined &&
        Number(status) >= 400 &&
        Number(status) < 500 &&
        ![408, 429].includes(Number(status));
      throw new OfflineCoverError(
        timedOut || (!permanent && !controller.signal.aborted),
      );
    }
    if (
      controller.signal.aborted ||
      !part.exists ||
      part.size <= 0 ||
      part.size > MAX_OFFLINE_COVER_BYTES
    )
      throw new OfflineCoverError(false);
    // Check native image dimensions, rather than trusting download success alone.
    let stopDecode: (() => void) | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        stopDecode = () => reject(new OfflineCoverError(timedOut));
        controller.signal.addEventListener("abort", stopDecode, { once: true });
        if (controller.signal.aborted) {
          stopDecode();
          return;
        }
        NativeImage.getSize(
          part.uri,
          (width, height) =>
            width > 0 && height > 0
              ? resolve()
              : reject(new OfflineCoverError(false)),
          () => reject(new OfflineCoverError(false)),
        );
      });
    } finally {
      if (stopDecode)
        controller.signal.removeEventListener("abort", stopDecode);
    }
    if (controller.signal.aborted) throw new OfflineCoverError(false);
    part.move(file);
    succeeded = true;
    // Keep the filename protected until the caller publishes or discards its reference.
    return () => {
      activeFiles.delete(file.uri);
    };
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", abort);
    if (!succeeded) {
      activeFiles.delete(file.uri);
      if (part.exists) part.delete();
      if (file.exists) file.delete();
    }
  }
}
