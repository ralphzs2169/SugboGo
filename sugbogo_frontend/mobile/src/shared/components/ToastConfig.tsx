import { View } from "react-native";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { BaseToast, ErrorToast } from "react-native-toast-message";
import { Text } from "react-native";
export const toastConfig = {
  success: (props: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        paddingVertical: 14,
        paddingHorizontal: 14,

        backgroundColor: "#ffffff",
        borderLeftWidth: 4,
        zIndex: 9999,
        borderLeftColor: "#4caf8a",
        shadowColor: "#1a2e2a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#e6f4ee",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="check" size={20} color="#2e9166" />
      </View>

      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#1a2e2a",
          }}
        >
          {props.text1}
        </Text>

        {!!props.text2 && (
          <Text
            style={{
              fontSize: 12,
              color: "#5c6b66",
              marginTop: 2,
            }}
          >
            {props.text2}
          </Text>
        )}
      </View>
    </View>
  ),

  error: (props: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        paddingVertical: 14,
        paddingHorizontal: 14,

        backgroundColor: "#ffffff",
        borderLeftWidth: 4,
        zIndex: 9999,
        borderLeftColor: "#d9695f",
        shadowColor: "#2e1a1a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: "#fbe9e7",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="close" size={20} color="#c0392b" />
      </View>

      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#1a2e2a",
          }}
        >
          {props.text1}
        </Text>

        {!!props.text2 && (
          <Text
            style={{
              fontSize: 12,
              color: "#5c6b66",
              marginTop: 2,
            }}
          >
            {props.text2}
          </Text>
        )}
      </View>
    </View>
  ),
};
