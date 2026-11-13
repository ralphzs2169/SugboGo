import AppText from "@/shared/components/AppText";

/** Introduces the optional onboarding personalization step. */
export default function InterestHeader() {
  return (
    <>
      <AppText weight="bold" className="mb-3 text-3xl text-text-primary">
        What are you interested in?
      </AppText>

      <AppText className="mb-6 text-body leading-relaxed text-text-secondary">
        Pick up to 3 specialties to get started. You can skip this step or add
        more anytime in Profile → Your Interests.
      </AppText>
    </>
  );
}
