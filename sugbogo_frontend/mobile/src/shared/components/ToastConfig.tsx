import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export const toastConfig = {
  success: (props: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 24,
        backgroundColor: "#CFEFDD",
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
          backgroundColor: "#D4EFE2",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="check" size={16} color="#1B6E4A" />
      </View>

      <View style={{ marginLeft: 10 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#1B6E4A",
          }}
        >
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
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 24,
        backgroundColor: "#FDEDED", // Light red
        shadowColor: "#3b1d1d",
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
          backgroundColor: "#F8D7DA",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="close" size={16} color="#B42318" />
      </View>

      <View style={{ marginLeft: 10 }}>
        <Text
          style={{
            fontSize: 13,
            fontWeight: "600",
            color: "#B42318",
          }}
        >
          {props.text1}
        </Text>
      </View>
    </View>
  ),
};
