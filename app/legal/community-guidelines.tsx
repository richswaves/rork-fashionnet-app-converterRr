import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import LegalDoc, { legalScreenOptions } from "../../components/LegalDoc";
import { COMMUNITY_GUIDELINES } from "../../constants/legalDocs";

export default function CommunityGuidelinesScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Community Guidelines", ...legalScreenOptions }} />
      <LegalDoc title="Community Guidelines" body={COMMUNITY_GUIDELINES} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0B0F" },
});
