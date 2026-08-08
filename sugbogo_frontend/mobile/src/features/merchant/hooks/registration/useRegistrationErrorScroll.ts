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

/**
 * Tracks the positions of validation fields within the active
 * registration step and scrolls the registration container to
 * the first field containing a validation error.
 */
export default function useRegistrationErrorScroll({
  scrollRef,
  currentStep,
}: UseRegistrationErrorScrollProps) {
  const fieldNodes = useRef<Record<FieldName, View | null>>({});
  const fieldPositions = useRef<Record<FieldName, number>>({});

  /**
   * Registers a field wrapper and measures its position
   * relative to the registration ScrollView.
   */
  const registerErrorScrollTarget = useCallback(
    (...names: FieldName[]): FieldRegistration => ({
      ref: (node) => {
        for (const name of names) {
          fieldNodes.current[name] = node;
        }
      },

      onLayout: () => {
        const node = fieldNodes.current[names[0]];
        const scrollView = scrollRef.current;

        if (!node || !scrollView) {
          return;
        }

        const scrollViewView = scrollView as unknown as View;

        requestAnimationFrame(() => {
          node.measureInWindow((_x, nodeY) => {
            scrollViewView.measureInWindow((_x, scrollViewY) => {
              const y = nodeY - scrollViewY;

              for (const name of names) {
                fieldPositions.current[name] = y;
              }
            });
          });
        });
      },
    }),
    [scrollRef],
  );

  /**
   * Scrolls to the first registered field that has a validation error.
   */
  const scrollToFirstError = useCallback(
    (errors: FieldErrors) => {
      const firstInvalidField = Object.entries(fieldPositions.current)
        .filter(([name]) => hasFieldError(errors, name))
        .sort(([, firstY], [, secondY]) => firstY - secondY)[0];

      if (!firstInvalidField) {
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

/**
 * Checks whether a  registration field contains
 * a React Hook Form validation error.
 */
function hasFieldError(errors: FieldErrors, fieldName: string): boolean {
  const parts = fieldName.split(".");

  let current: unknown = errors;

  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return false;
    }

    current = (current as Record<string, unknown>)[part];
  }

  if (current !== undefined) {
    return true;
  }

  return false;
}
