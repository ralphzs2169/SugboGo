import { View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { BaseToast, ErrorToast } from "react-native-toast-message";

export const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      renderLeadingIcon={() => (
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            paddingLeft: 14,
          }}
        >
          <MaterialIcons name="check-circle" size={24} color="#16A34A" />
        </View>
      )}
      style={{
        borderLeftColor: "#16A34A",
        borderLeftWidth: 5,
        height: 80,
      }}
      contentContainerStyle={{
        paddingHorizontal: 16,
      }}

      text1Style={{
        fontSize: 15,
        fontWeight: "700",
        color: "#111827",
      }}
      text2Style={{
        fontSize: 13,
        color: "#6B7280",
      }}
      text2NumberOfLines={3}
    />
  ),

  error: (props: any) => (
    <ErrorToast
      {...props}
      renderLeadingIcon={() => (
        <View
          style={{
            justifyContent: "center",
            alignItems: "center",
            paddingLeft: 14,
          }}
        >
          <MaterialIcons name="error" size={24} color="#DC2626" />
        </View>
      )}
      style={{
        borderLeftColor: "#DC2626",
        borderLeftWidth: 5,
        height: 80,
      }}
      text2NumberOfLines={3}
    />
  ),
};
