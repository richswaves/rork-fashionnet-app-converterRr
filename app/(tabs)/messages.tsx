import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const container = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);
  return (
    <View style={container} testID="messages-screen">
      <Text style={styles.text}>Messages coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F", alignItems: "center", justifyContent: "center" },
  text: { color: "#E5E7EB", fontSize: 16, fontWeight: "800" },
});
