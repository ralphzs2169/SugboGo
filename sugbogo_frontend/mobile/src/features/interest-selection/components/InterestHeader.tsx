import { Text } from "react-native";

export default function InterestHeader() {
  return (
    <>
      <Text className="mb-3 text-3xl font-bold  text-text-primary">
        What are you interested in?
      </Text>

      <Text className="mb-6 text-body leading-relaxed text-text-secondary">
        Select at least <Text className="font-semibold">3 interests</Text>.
        These help shape your personal feed. The rest of Cebu is still yours to
        explore.
      </Text>
    </>
  );
}
