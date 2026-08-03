import { useRef, useState } from "react";
import type { ScrollView } from "react-native";

type UseRegistrationNavigationProps = {
  reviewStep: number;
};

export default function useRegistrationNavigation({
  reviewStep,
}: UseRegistrationNavigationProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [editingStep, setEditingStep] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const scrollToTop = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });
    });
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
    scrollToTop();
  };

  const goToReview = () => {
    setEditingStep(null);
    goToStep(reviewStep);
  };

  const handleBack = () => {
    setCurrentStep((step) => Math.max(1, step - 1));
    scrollToTop();
  };

  const handleEditSection = (step: number) => {
    setEditingStep(step);
    goToStep(step);
  };

  return {
    currentStep,
    editingStep,
    scrollRef,
    goToStep,
    goToReview,
    handleBack,
    handleEditSection,
  };
}
