import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import LegalDoc, { legalScreenOptions } from "../../components/LegalDoc";
import { MODERATION_APPEALS_POLICY } from "../../constants/legalDocs";

export default function ModerationAppealsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Moderation & Appeals Policy", ...legalScreenOptions }} />
      <LegalDoc title="Moderation & Appeals Policy" body={MODERATION_APPEALS_POLICY} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0B0F" },
});
