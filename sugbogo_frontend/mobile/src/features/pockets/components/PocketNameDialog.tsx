import { useRef } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";

import PocketNameForm, { type PocketNameFormProps } from "./PocketNameForm";

/** Hosts the shared name form above the keyboard without another bottom sheet. */
export default function PocketNameDialog(
  props: Omit<PocketNameFormProps, "InputComponent" | "onBusyChange">,
) {
  const busy = useRef(false);
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={() => {
        if (!busy.current) props.onCancel();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center bg-black/50 px-5 py-8"
      >
        {/* Keyboard-safe form surface */}
        <View className="max-h-[90%] w-full max-w-sm self-center overflow-hidden rounded-card bg-surface">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 24 }}
          >
            <PocketNameForm
              {...props}
              onBusyChange={(value) => {
                busy.current = value;
              }}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
