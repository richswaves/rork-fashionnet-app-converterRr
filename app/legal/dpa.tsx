import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import LegalDoc, { legalScreenOptions } from "../../components/LegalDoc";
import { DATA_PROCESSING_AGREEMENT } from "../../constants/legalDocs";

export default function DPAScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Data Processing Agreement", ...legalScreenOptions }} />
      <LegalDoc title="Data Processing Agreement" body={DATA_PROCESSING_AGREEMENT} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0B0F" },
});
