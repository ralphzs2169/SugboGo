import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export const toastConfig = {
  success: (props: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 24,
        backgroundColor: "#ffffff",
        shadowColor: "#1a2e2a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: "#e6f4ee",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="check" size={16} color="#2e9166" />
      </View>

      <View style={{ marginLeft: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#1a2e2a" }}>
          {props.text1}
        </Text>
      </View>
    </View>
  ),

  error: (props: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 24,
        backgroundColor: "#ffffff",
        shadowColor: "#2e1a1a",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
        zIndex: 9999,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: "#fbe9e7",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="close" size={16} color="#c0392b" />
      </View>

      <View style={{ marginLeft: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: "#1a2e2a" }}>
          {props.text1}
        </Text>
      </View>
    </View>
  ),
};
