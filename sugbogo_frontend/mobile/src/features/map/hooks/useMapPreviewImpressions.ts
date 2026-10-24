import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Keyboard, View, type LayoutChangeEvent } from "react-native";

import useBusinessImpressions from "@/features/explore/hooks/useBusinessImpressions";
import {
  isBusinessCardVisible,
  type VisibilityRect,
} from "@/features/explore/utils/businessImpressions";
import type { PreviewIdentityGeometry } from "../components/MSMEPreviewCard";

/** Measures the selected preview and its identifiable content for the shared observer. */
export default function useMapPreviewImpressions(
  businessId: number | undefined,
  bottomInset: number,
  topInset: number,
  enabled: boolean,
) {
  const viewportRef = useRef<View>(null);
  const previewRef = useRef<View>(null);
  const measurementVersion = useRef(0);
  const geometry = useRef({
    viewport: null as VisibilityRect | null,
    preview: null as { businessId: number; rect: VisibilityRect } | null,
    identity: null as PreviewIdentityGeometry | null,
  });
  const [visibleIdentityId, setVisibleIdentityId] = useState<number | null>(
    null,
  );
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const subscriptions = [
      Keyboard.addListener("keyboardWillShow", () => setKeyboardVisible(true)),
      Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true)),
      Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);
  const impressions = useBusinessImpressions(
    bottomInset,
    topInset,
    enabled &&
      !keyboardVisible &&
      businessId !== undefined &&
      visibleIdentityId === businessId,
  );
  const {
    retainBusinesses,
    onSectionLayout,
    onListLayout,
    onCardLayout,
    onViewportLayout,
  } = impressions;

  useLayoutEffect(() => {
    retainBusinesses(businessId === undefined ? [] : [businessId]);
  }, [businessId, retainBusinesses]);

  const updateIdentityVisibility = useCallback(() => {
    const { viewport, preview, identity } = geometry.current;
    let visible = false;
    if (viewport && preview && identity && preview.businessId === businessId) {
      const translatedIdentity = {
        ...identity.identity,
        x: preview.rect.x + identity.identity.x,
        y: preview.rect.y + identity.identity.y,
      };
      // Both the internal ScrollView and the map's unobscured viewport clip identity.
      visible = isBusinessCardVisible(translatedIdentity, [
        {
          x: 0,
          y: topInset,
          width: viewport.width,
          height: Math.max(0, viewport.height - bottomInset - topInset),
        },
        {
          ...identity.viewport,
          x: preview.rect.x + identity.viewport.x,
          y: preview.rect.y + identity.viewport.y,
        },
      ]);
    }
    setVisibleIdentityId(
      visible && businessId !== undefined ? businessId : null,
    );
  }, [businessId, bottomInset, topInset]);

  const onIdentityGeometryChange = useCallback(
    (identity: PreviewIdentityGeometry | null) => {
      geometry.current.identity = identity;
      updateIdentityVisibility();
    },
    [updateIdentityVisibility],
  );

  const measurePreview = useCallback(() => {
    const preview = previewRef.current;
    const version = ++measurementVersion.current;
    if (!preview || !viewportRef.current || businessId === undefined) return;

    onListLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 0, height: 0 } },
    } as LayoutChangeEvent);
    preview.measureLayout(
      viewportRef.current,
      (x, y, width, height) => {
        if (
          previewRef.current !== preview ||
          version !== measurementVersion.current
        )
          return;

        geometry.current.preview = {
          businessId,
          rect: { x, y, width, height },
        };
        updateIdentityVisibility();
        onSectionLayout({
          nativeEvent: { layout: { x, y, width, height } },
        } as LayoutChangeEvent);
        const localLayout = {
          nativeEvent: { layout: { x: 0, y: 0, width, height } },
        } as LayoutChangeEvent;
        onListLayout(localLayout);
        onCardLayout(businessId, localLayout);
      },
      () => undefined,
    );
  }, [
    businessId,
    onSectionLayout,
    onListLayout,
    onCardLayout,
    updateIdentityVisibility,
  ]);

  const onViewportMeasured = useCallback(
    (event: LayoutChangeEvent) => {
      geometry.current.viewport = event.nativeEvent.layout;
      onViewportLayout(event);
      updateIdentityVisibility();
      measurePreview();
    },
    [onViewportLayout, updateIdentityVisibility, measurePreview],
  );

  return {
    viewportRef,
    previewRef,
    onViewportLayout: onViewportMeasured,
    measurePreview,
    onIdentityGeometryChange,
  };
}
