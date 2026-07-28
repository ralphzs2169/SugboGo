import { useState, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import RegistrationLayout from "../components/registration/RegistrationLayout";
import RegistrationFooter from "../components/registration/RegistartionFooter";
import RegistrationStepper from "../components/registration/RegistrationStepper";
import { ScrollView } from "react-native";
import {
  merchantRegistrationSchema,
  MerchantRegistrationForm,
} from "../validation/merchantRegistration.schema";
import { REGISTRATION_STEPS } from "../constants/registrationSteps";
import BusinessIdentityStep from "../components/registration/steps/BusinessIdentityStep";

export default function MerchantRegistrationScreen() {
  const [currentStep, setCurrentStep] = useState(1);

  const scrollRef = useRef<ScrollView>(null);

  const form = useForm<MerchantRegistrationForm>({
    resolver: zodResolver(merchantRegistrationSchema),

    defaultValues: {
      businessName: "",
      businessCategory: "",
      businessDescription: "",
      contactNumber: "",
      businessEmail: "",
      website: "",
    },
  });

  const handleNext = async () => {
    scrollRef.current?.scrollTo({
      y: 0,
      animated: false,
    });

    setCurrentStep((step) => step + 1);
  };
  return (
    <FormProvider {...form}>
      <RegistrationLayout
        scrollRef={scrollRef}
        stepper={
          <RegistrationStepper
            title="Business Identity"
            currentStep={currentStep}
            totalSteps={REGISTRATION_STEPS.length}
          />
        }
        footer={
          <RegistrationFooter
            currentStep={currentStep}
            totalSteps={REGISTRATION_STEPS.length}
            onNext={handleNext}
            onBack={() => setCurrentStep((step) => step - 1)}
          />
        }
      >
        <BusinessIdentityStep />
      </RegistrationLayout>
    </FormProvider>
  );
}
