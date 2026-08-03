import { useState, useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import RegistrationLayout from "../components/registration/RegistrationLayout";
import RegistrationFooter from "../components/registration/RegistartionFooter";
import RegistrationStepper from "../components/registration/RegistrationStepper";
import { ScrollView } from "react-native";
import {
  merchantRegistrationSchema,
  MerchantRegistrationForm,
} from "../validation/merchantRegistration.schema";

import useClusters from "../hooks/registration/useClusters";
import useCategories from "../hooks/registration/useCategories";

import { REGISTRATION_STEPS } from "../constants/registration/registrationSteps";
import BusinessIdentityStep from "../components/registration/steps/BusinessIdentityStep";
import BusinessLocationStep from "../components/registration/steps/BusinessLocationStep";
import OperatingHoursStep from "../components/registration/steps/OperatingHoursStep";
import BusinessPhotosStep from "../components/registration/steps/BusinessPhotosStep";
import VerificationDocumentsStep from "../components/registration/steps/VerificationDocumentsStep";
import ReviewStep from "../components/registration/steps/ReviewSubmitStep";
import Toast from "react-native-toast-message";

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
        return <ReviewStep clusters={clusters} categories={categories} />;

      default:
        return null;
    }
  };
  const form = useForm<
    z.input<typeof merchantRegistrationSchema>,
    undefined,
    z.output<typeof merchantRegistrationSchema>
  >({
    resolver: zodResolver(merchantRegistrationSchema),

    defaultValues: {
      // Business Identity
      businessName: "",
      businessCluster: "",
      businessCategory: "",
      businessDescription: "",
      specialtyTags: [],
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
      landmarks: [],
      latitude: null,
      longitude: null,

      operatingHours: {
        monday: {
          isOpen: true,
          is24Hours: false,
          openTime: "08:00",
          closeTime: "17:00",
        },
        tuesday: {
          isOpen: true,
          is24Hours: false,
          openTime: "08:00",
          closeTime: "17:00",
        },
        wednesday: {
          isOpen: true,
          is24Hours: false,
          openTime: "08:00",
          closeTime: "17:00",
        },
        thursday: {
          isOpen: true,
          is24Hours: false,
          openTime: "08:00",
          closeTime: "17:00",
        },
        friday: {
          isOpen: true,
          is24Hours: false,
          openTime: "08:00",
          closeTime: "17:00",
        },
        saturday: {
          isOpen: false,
          is24Hours: false,
          openTime: "",
          closeTime: "",
        },
        sunday: {
          isOpen: false,
          is24Hours: false,
          openTime: "",
          closeTime: "",
        },
      },
      // Business Photos
      businessPhotos: {
        storefront: [],
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

  const STEP_ONE_FIELDS = [
    "businessName",
    "businessCluster",
    "businessCategory",
    "businessDescription",
    "contactNumber",
    "specialtyTags",
    "businessEmail",
    "website",
    "representativeName",
    "representativeRole",
  ] as const;

  const handleNext = async () => {
    const isLastStep = currentStep === REGISTRATION_STEPS.length;

    if (isLastStep) {
      // submit later
      return;
    }

    // if (currentStep === 1) {
    //   const isValid = await form.trigger(STEP_ONE_FIELDS);

    //   if (!isValid) {
    //     Toast.show({
    //       type: "error",
    //       text1: "Incomplete business information",
    //       text2: "Please review the highlighted fields before continuing.",
    //     });

    //     return;
    //   }
    // }

    if (currentStep === 2) {
      const isValid = await form.trigger([
        "province",
        "city",
        "barangay",
        "streetAddress",
        "latitude",
        "longitude",
      ]);

      if (!isValid) {
        Toast.show({
          type: "error",
          text1: "Incomplete business location",
          text2:
            "Please select your business location and complete the address.",
        });

        return;
      }
    }

    // if (currentStep === 3) {
    //   const isValid = await form.trigger("operatingHours");

    //   if (!isValid) {
    //     const operatingHoursError = form.formState.errors.operatingHours;

    //     const hasNoOpenDaysError =
    //       operatingHoursError?.message === "At least one day must be open.";

    //     Toast.show({
    //       type: "error",
    //       text1: hasNoOpenDaysError
    //         ? "No operating days selected"
    //         : "Check your operating hours",
    //       text2: hasNoOpenDaysError
    //         ? "Please select at least one day that your business is open."
    //         : "Please review the highlighted days before continuing.",
    //     });

    //     return;
    //   }
    // }

    // if (currentStep === 4) {
    //   const isValid = await form.trigger("businessPhotos");

    //   if (!isValid) {
    //     Toast.show({
    //       type: "error",
    //       text1: "Add a storefront photo",
    //       text2: "At least one storefront photo is required.",
    //     });

    //     return;
    //   }
    // }

    // if (currentStep === 5) {
    //   const isValid = await form.trigger("verificationDocuments");

    //   if (!isValid) {
    //     Toast.show({
    //       type: "error",
    //       text1: "Verification document required",
    //       text2:
    //         "Please upload your business registration document before continuing.",
    //     });
    //     return;
    //   }
    // }

    setCurrentStep((step) => step + 1);

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: 0,
        animated: false,
      });
    });
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
