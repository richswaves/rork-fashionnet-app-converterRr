import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack } from "expo-router";

interface LegalDocProps {
  title: string;
  body: string;
}

export default function LegalDoc({ title, body }: LegalDocProps) {
  const paragraphs = useMemo(() => body.split("\n\n"), [body]);

  return (
    <View style={styles.container} testID={`legal-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` }>
      <Stack.Screen options={{ title, headerStyle: { backgroundColor: "#0B0B0F" }, headerTintColor: "#E5E7EB" }} />
      <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          <Text style={styles.title}>{title}</Text>
          {paragraphs.map((p, i) => (
            <Text key={i} style={styles.paragraph}>{p}</Text>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "800" as const, marginBottom: 8 },
  paragraph: { color: "#D1D5DB", fontSize: 15, lineHeight: 22 },
});
