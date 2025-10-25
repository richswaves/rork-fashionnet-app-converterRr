import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function PendingApproval() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Thanks for joining</Text>
        <Text style={styles.subtitle}>Your account is pending approval. You&apos;ll get access once approved.</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/opportunities" as any)} style={styles.btn} testID="pending-go-home">
          <Text style={styles.btnText}>Explore opportunities</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { flex: 1, padding: 24, gap: 16, alignItems: "center", justifyContent: "center" },
  title: { color: "#F9FAFB", fontSize: 26, fontWeight: "800" as const },
  subtitle: { color: "#D1D5DB", fontSize: 16, textAlign: "center" as const },
  btn: { backgroundColor: "#FFFFFF", paddingVertical: 14, paddingHorizontal: 18, borderRadius: 12, marginTop: 8 },
  btnText: { color: "#111827", fontWeight: "700" as const },
});
