import React, { useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform, Linking, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, Shield, Crown, ChevronRight, Info } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const FEATURES: { id: string; title: string; subtitle: string }[] = [
  { id: "f1", title: "Unlimited Networking", subtitle: "Message and connect without limits" },
  { id: "f2", title: "Priority Exposure", subtitle: "Show up first in searches and feeds" },
  { id: "f3", title: "Pro Portfolio", subtitle: "Premium layout with HD media" },
];

export default function PaywallScreen() {
  const router = useRouter();
  const [agree, setAgree] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const price = useMemo(() => "$9.99/mo", []);
  const trial = useMemo(() => "7‑day free trial", []);

  const handleOpenLegal = useCallback((path: "/legal/terms" | "/legal/privacy" | "/legal/subscription") => {
    try {
      router.push(path);
    } catch (e) {
      console.log("Nav error", e);
    }
  }, [router]);

  const handleSubscribe = useCallback(async () => {
    if (!agree || isProcessing) return;

    setIsProcessing(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      console.log("[Paywall] Start subscribe flow");

      const msg = Platform.select({
        web: "Purchases are not available in the web preview. Build the app for iOS/Android to use App Store / Play Billing.",
        default: "Purchases require a built app (not Expo Go). This is a demo flow only.",
      }) as string;

      console.log("[Paywall] Info:", msg);
      alert(msg);

      // After real purchase succeeds, navigate back or unlock
      // router.back();
    } catch (e) {
      console.log("[Paywall] Subscribe error", e);
    } finally {
      setIsProcessing(false);
    }
  }, [agree, isProcessing]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0F" }} testID="paywall-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#0B0B0F", "#0B0B0F" ]} style={StyleSheet.absoluteFill} />

      <SafeAreaView edges={["top"]}>
        <View style={styles.headerRow}>
          <View style={styles.badge}>
            <Crown color="#111" size={16} />
            <Text style={styles.badgeText}>thebrxnd Plus</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Level up your reach</Text>
        <Text style={styles.subtitle}>Everything you need to grow your creative network</Text>

        <View style={styles.card}>
          {FEATURES.map((f) => (
            <View key={f.id} style={styles.featureRow}>
              <CheckCircle2 color="#10B981" size={20} />
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
              </View>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            <Text style={styles.trial}>{trial}</Text>
          </View>
        </View>

        <Pressable
          testID="agree-toggle"
          onPress={() => setAgree((s) => !s)}
          style={({ pressed }) => [styles.agreeRow, pressed && { opacity: 0.7 }]}
        >
          <View style={[styles.checkbox, agree && styles.checkboxOn]} />
          <Text style={styles.agreeText}>
            I have read and agree to the Terms, Privacy Policy and Subscription Terms
          </Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => handleOpenLegal("/legal/terms")} style={styles.legalLink} testID="link-terms">
            <Shield color="#9CA3AF" size={16} />
            <Text style={styles.legalText}>Terms of Service</Text>
            <ChevronRight color="#6B7280" size={16} />
          </Pressable>
          <Pressable onPress={() => handleOpenLegal("/legal/privacy")} style={styles.legalLink} testID="link-privacy">
            <Shield color="#9CA3AF" size={16} />
            <Text style={styles.legalText}>Privacy Policy</Text>
            <ChevronRight color="#6B7280" size={16} />
          </Pressable>
          <Pressable onPress={() => handleOpenLegal("/legal/subscription")} style={styles.legalLink} testID="link-subscription">
            <Info color="#9CA3AF" size={16} />
            <Text style={styles.legalText}>Subscription Terms</Text>
            <ChevronRight color="#6B7280" size={16} />
          </Pressable>
        </View>

        <Pressable
          testID="subscribe-btn"
          onPress={handleSubscribe}
          disabled={!agree || isProcessing}
          style={({ pressed }) => [
            styles.cta,
            (!agree || isProcessing) && styles.ctaDisabled,
            pressed && agree && !isProcessing && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.ctaText}>{isProcessing ? "Processing…" : "Start Free Trial"}</Text>
        </Pressable>

        <Text style={styles.storeNote}>
          Purchases are processed by Apple/Google. Manage in your device account settings. We never store your card.
        </Text>
      </ScrollView>

      <SafeAreaView edges={["bottom"]}>
        <Pressable
          testID="restore-btn"
          onPress={() => alert("Restore Purchases is available in the built app. Not supported in Expo Go/web preview.")}
          style={({ pressed }) => [styles.restore, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { paddingHorizontal: 16, paddingVertical: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", backgroundColor: "#FDE68A", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: "#111827", fontWeight: "800", fontSize: 12 },
  scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", textAlign: "center", marginTop: 8 },
  subtitle: { color: "#9CA3AF", fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 8 },
  card: { backgroundColor: "#121218", borderRadius: 16, borderColor: "#23232B", borderWidth: StyleSheet.hairlineWidth, padding: 16, marginTop: 16 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  featureTitle: { color: "#E5E7EB", fontSize: 16, fontWeight: "800" },
  featureSubtitle: { color: "#9CA3AF", fontSize: 13, fontWeight: "600", marginTop: 2 },
  divider: { height: 1, backgroundColor: "#23232B", marginVertical: 12 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  trial: { color: "#A7F3D0", fontSize: 14, fontWeight: "800" },
  agreeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: "#3B82F6" },
  checkboxOn: { backgroundColor: "#3B82F6" },
  agreeText: { color: "#9CA3AF", fontSize: 13, fontWeight: "600", flex: 1 },
  legalRow: { marginTop: 8 },
  legalLink: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  legalText: { color: "#E5E7EB", fontSize: 14, fontWeight: "700", flex: 1 },
  cta: { marginTop: 16, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: "#000000", fontWeight: "800", fontSize: 16 },
  storeNote: { color: "#6B7280", fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 10 },
  restore: { paddingVertical: 14, alignItems: "center" },
  restoreText: { color: "#9CA3AF", fontSize: 13, fontWeight: "700", textDecorationLine: "underline" as const },
});
