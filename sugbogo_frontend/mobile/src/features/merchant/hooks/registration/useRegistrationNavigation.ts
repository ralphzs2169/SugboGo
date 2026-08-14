import { useRef, useState } from "react";
import type { ScrollView } from "react-native";

type UseRegistrationNavigationProps = {
  reviewStep: number;
  onBeforeBack?: (currentStep: number) => void;
};

export default function useRegistrationNavigation({
  reviewStep,
  onBeforeBack,
}: UseRegistrationNavigationProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [highestCompletedStep, setHighestCompletedStep] = useState(0);

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
    onBeforeBack?.(currentStep);

    setCurrentStep((step) => Math.max(1, step - 1));
    scrollToTop();
  };

  const handleEditSection = (step: number) => {
    setEditingStep(step);
    goToStep(step);
  };

  const completeCurrentStep = (step: number) => {
    // Update the highest completed step if the current step is greater than the previous highest completed step
    setHighestCompletedStep((highestStep) => Math.max(highestStep, step));

    goToStep(step + 1);
  };

  return {
    currentStep,
    editingStep,
    scrollRef,
    goToStep,
    goToReview,
    handleBack,
    handleEditSection,
    completeCurrentStep,
    highestCompletedStep,

    setCurrentStep,
    setHighestCompletedStep,
  };
}
