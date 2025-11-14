import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import LegalDoc, { legalScreenOptions } from "../../components/LegalDoc";
import { PRIVACY_POLICY } from "../../constants/legalDocs";

export default function PrivacyScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Privacy Policy", ...legalScreenOptions }} />
      <LegalDoc title="Privacy Policy" body={PRIVACY_POLICY} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0B0F" },
});
