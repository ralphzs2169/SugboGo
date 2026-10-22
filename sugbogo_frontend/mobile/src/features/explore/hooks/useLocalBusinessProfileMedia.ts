import { Image } from "expo-image";
import { useEffect, useState } from "react";

import type { ExploreBusinessPhoto } from "../types/exploreBusiness.types";

type MediaInput = {
  cover_photo_url: string | null;
  display_cover_photo_url: string | null;
  photos: ExploreBusinessPhoto[];
};

/** Resolves existing native files only; cache inspection never downloads an image. */
export default function useLocalBusinessProfileMedia(
  business: MediaInput | null,
  localOnly: boolean,
  managedCover?: string,
) {
  const [resolved, setResolved] = useState<{
    business: MediaInput;
    cover: string | null;
    photos: ExploreBusinessPhoto[];
  } | null>(null);

  useEffect(() => {
    if (!localOnly || !business) return;
    let cancelled = false;
    async function localUri(uri: string | null) {
      if (!uri) return null;
      if (uri.startsWith("file://")) return uri;
      try {
        const path = await Image.getCachePathAsync(uri);
        if (!path) return null;
        return path.startsWith("file://") ? path : `file://${path}`;
      } catch {
        return null;
      }
    }
    void Promise.all([
      localUri(business.display_cover_photo_url || business.cover_photo_url),
      Promise.all(
        business.photos.map(async (photo) => {
          const uri = await localUri(photo.photo_url);
          return uri ? { ...photo, photo_url: uri } : null;
        }),
      ),
    ]).then(([cover, photos]) => {
      if (!cancelled) {
        setResolved({
          business,
          cover,
          photos: photos.filter((photo) => photo !== null),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [business, localOnly]);

  if (!localOnly) {
    return {
      cover: business?.display_cover_photo_url ?? null,
      photos: business?.photos ?? [],
    };
  }
  const current = resolved?.business === business ? resolved : null;
  return {
    cover: managedCover?.startsWith("file://")
      ? managedCover
      : (current?.cover ?? null),
    photos: current?.photos ?? [],
  };
}
