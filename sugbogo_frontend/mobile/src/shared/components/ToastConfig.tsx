import { View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export const toastConfig = {
  success: (props: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "center",
        maxWidth: "88%",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#E6F4EC",
        shadowColor: "#1a2e2a",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#1B6E4A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
      </View>

      <View style={{ marginLeft: 10, flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13.5,
            fontWeight: "600",
            color: "#14251F",
          }}
        >
          {props.text1}
        </Text>

        {props.text2 && (
          <Text
            numberOfLines={2}
            style={{
              fontSize: 12,
              fontWeight: "400",
              color: "#5B6B65",
              marginTop: 1,
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
        alignSelf: "center",
        maxWidth: "88%",
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "#FBE3E1",
        shadowColor: "#3b1d1d",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#B42318",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MaterialCommunityIcons name="alert" size={15} color="#FFFFFF" />
      </View>

      <View style={{ marginLeft: 10, flexShrink: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontSize: 13.5,
            fontWeight: "600",
            color: "#3B1414",
          }}
        >
          {props.text1}
        </Text>

        {props.text2 && (
          <Text
            numberOfLines={2}
            style={{
              fontSize: 12,
              fontWeight: "400",
              color: "#7A5252",
              marginTop: 1,
            }}
          >
            {props.text2}
          </Text>
        )}
      </View>
    </View>
  ),
};
