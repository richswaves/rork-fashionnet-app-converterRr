import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import LegalDoc, { legalScreenOptions } from "../../components/LegalDoc";
import { COOKIE_POLICY } from "../../constants/legalDocs";

export default function CookiePolicyScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Cookie / Tracking Policy", ...legalScreenOptions }} />
      <LegalDoc title="Cookie / Tracking Policy" body={COOKIE_POLICY} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0B0F" },
});
