import { useCallback, useRef } from "react";
import { LayoutChangeEvent, ScrollView, View } from "react-native";
import type { FieldErrors } from "react-hook-form";

type FieldName = string;

type FieldRegistration = {
  ref: (node: View | null) => void;
  onLayout: (event: LayoutChangeEvent) => void;
};

type UseRegistrationErrorScrollProps = {
  scrollRef: React.RefObject<ScrollView | null>;
  currentStep: number;
};

function measureFieldPosition(
  node: View,
  names: FieldName[],
  fieldPositions: React.RefObject<Record<FieldName, number>>,
  scrollRef: React.RefObject<ScrollView | null>,
  attemptsLeft = 5,
) {
  const scrollView = scrollRef.current as unknown as View | null;

  if (!scrollView) {
    // On first mount, the ScrollView's own ref may not be attached
    // yet when a child field's onLayout first fires — retry briefly
    // instead of silently dropping this field's position forever.
    if (attemptsLeft > 0) {
      setTimeout(() => {
        measureFieldPosition(
          node,
          names,
          fieldPositions,
          scrollRef,
          attemptsLeft - 1,
        );
      }, 50);
    }
    return;
  }

  node.measureLayout(
    scrollView,
    (_x, y) => {
      for (const name of names) {
        fieldPositions.current[name] = y;
      }
    },
    () => {
      // Measurement failed — leave any previously known position in place.
    },
  );
}

/**
 * Tracks the positions of validation fields within the active
 * registration step and scrolls the registration container to
 * the first field containing a validation error.
 */
export default function useRegistrationErrorScroll({
  scrollRef,
}: UseRegistrationErrorScrollProps) {
  const fieldNodes = useRef<Record<FieldName, View | null>>({});
  const fieldPositions = useRef<Record<FieldName, number>>({});

  const registerErrorScrollTarget = useCallback(
    (...names: FieldName[]): FieldRegistration => ({
      ref: (node) => {
        for (const name of names) {
          fieldNodes.current[name] = node;

          // A field that unmounts (e.g. leaving this step) can no
          // longer be a valid scroll target — drop its stale position.
          if (node === null) {
            delete fieldPositions.current[name];
          }
        }
      },

      onLayout: () => {
        const node = fieldNodes.current[names[0]];

        if (!node) {
          return;
        }

        measureFieldPosition(node, names, fieldPositions, scrollRef);
      },
    }),
    [scrollRef],
  );

  /**
   * Scrolls to the first registered field that has a validation error.
   *
   * Accepts a getter rather than a snapshot of `errors` — react-hook-form's
   * formState.errors can still be mid-flush (especially with an async
   * resolver like zodResolver) at the moment validation resolves, so a
   * captured snapshot can be stale/empty on the very first attempt. Reading
   * fresh on each retry lets it pick up the real errors once they land.
   */
  const scrollToFirstError = useCallback(
    (getErrors: () => FieldErrors, attemptsLeft = 8) => {
      const errors = getErrors();

      const firstInvalidField = Object.entries(fieldPositions.current)
        .filter(([name]) => hasFieldError(errors, name))
        .sort(([, firstY], [, secondY]) => firstY - secondY)[0];

      if (!firstInvalidField) {
        if (attemptsLeft > 0) {
          setTimeout(() => {
            scrollToFirstError(getErrors, attemptsLeft - 1);
          }, 50);
        }
        return;
      }

      const [, y] = firstInvalidField;

      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(y - 24, 0),
          animated: true,
        });
      });
    },
    [scrollRef],
  );

  return {
    registerErrorScrollTarget,
    scrollToFirstError,
  };
}

function hasFieldError(errors: FieldErrors, fieldName: string): boolean {
  const parts = fieldName.split(".");

  let current: unknown = errors;

  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return false;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current !== undefined;
}
