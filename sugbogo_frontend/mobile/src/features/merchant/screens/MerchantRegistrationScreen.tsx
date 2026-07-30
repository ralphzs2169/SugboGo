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

import useClusters from "../hooks/useClusters";
import useCategories from "../hooks/useCategories";

import { REGISTRATION_STEPS } from "../constants/registrationSteps";
import BusinessIdentityStep from "../components/registration/steps/BusinessIdentityStep";
import BusinessLocationStep from "../components/registration/steps/BusinessLocationStep";
import OperatingHoursStep from "../components/registration/steps/OperatingHoursStep";
import BusinessPhotosStep from "../components/registration/steps/BusinessPhotosStep";
import VerificationDocumentsStep from "../components/registration/steps/VerificationDocumentsStep";
import ReviewStep from "../components/registration/steps/ReviewSubmitStep";

export default function MerchantRegistrationScreen() {
  const [currentStep, setCurrentStep] = useState(1);

  // Scroll to the top of the form when moving to the next step.
  const scrollRef = useRef<ScrollView>(null);

  const {
    clusters,
    isLoading: isLoadingClusters,
    error: clustersError,
    refetch: refetchClusters,
  } = useClusters();

  const {
    categories,
    isLoading: isLoadingCategories,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories();

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <BusinessIdentityStep
            clusters={clusters}
            categories={categories}
            isLoadingClusters={isLoadingClusters}
            isLoadingCategories={isLoadingCategories}
            clustersError={clustersError}
            categoriesError={categoriesError}
            refetchClusters={refetchClusters}
            refetchCategories={refetchCategories}
          />
        );

      case 2:
        return <BusinessLocationStep />;

      case 3:
        return <OperatingHoursStep />;

      case 4:
        return <BusinessPhotosStep />;

      case 5:
        return <VerificationDocumentsStep />;

      case 6:
        return <ReviewStep />;

      default:
        return null;
    }
  };
  const form = useForm<MerchantRegistrationForm>({
    resolver: zodResolver(merchantRegistrationSchema),

    defaultValues: {
      // Business Identity
      businessName: "",
      businessCluster: "",
      businessCategory: "",
      businessDescription: "",

      // Contact
      representativeName: "",
      representativeRole: "",
      contactNumber: "",
      businessEmail: "",
      website: "",

      // Location
      // Business Location
      province: "",
      city: "",
      barangay: "",
      streetAddress: "",
      unit: "",
      landmark: "",
      latitude: null,
      longitude: null,

      operatingHours: {
        monday: {
          isOpen: true,
          openTime: "08:00",
          closeTime: "17:00",
        },
        tuesday: {
          isOpen: true,
          openTime: "08:00",
          closeTime: "17:00",
        },
        wednesday: {
          isOpen: true,
          openTime: "08:00",
          closeTime: "17:00",
        },
        thursday: {
          isOpen: true,
          openTime: "08:00",
          closeTime: "17:00",
        },
        friday: {
          isOpen: true,
          openTime: "08:00",
          closeTime: "17:00",
        },
        saturday: {
          isOpen: false,
          openTime: "",
          closeTime: "",
        },
        sunday: {
          isOpen: false,
          openTime: "",
          closeTime: "",
        },
      },
      // Business Photos
      businessPhotos: {
        storefront: null,
        interior: [],
        products: [],
        additional: [],
      },

      // Verification Documents
      verificationDocuments: {
        businessRegistration: null,
        authorizationDocument: null,
        additionalDocuments: [],
      },
    },
  });

  const handleNext = async () => {
    const isLastStep = currentStep === REGISTRATION_STEPS.length;

    if (isLastStep) {
      // submit later
      return;
    }

    scrollRef.current?.scrollTo({
      y: 0,
      animated: false,
    });

    setCurrentStep((step) => step + 1);
  };
  return (
    <>
      <FormProvider {...form}>
        <RegistrationLayout
          scrollRef={scrollRef}
          stepper={
            <RegistrationStepper
              currentStep={currentStep}
              totalSteps={REGISTRATION_STEPS.length}
              title={REGISTRATION_STEPS[currentStep - 1].title}
            />
          }
          footer={
            <RegistrationFooter
              currentStep={currentStep}
              totalSteps={REGISTRATION_STEPS.length}
              onNext={handleNext}
              onBack={() => setCurrentStep((step) => Math.max(1, step - 1))}
            />
          }
        >
          {renderStep()}
        </RegistrationLayout>
      </FormProvider>
    </>
  );
}
