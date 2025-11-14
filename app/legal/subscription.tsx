import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import LegalDoc, { legalScreenOptions } from "../../components/LegalDoc";
import { SUBSCRIPTION_ADDENDUM } from "../../constants/legalDocs";

export default function SubscriptionScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <Stack.Screen options={{ title: "Subscription Addendum", ...legalScreenOptions }} />
      <LegalDoc title="Subscription Addendum" body={SUBSCRIPTION_ADDENDUM} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#0B0B0F" },
});
