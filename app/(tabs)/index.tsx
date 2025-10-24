import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Navigation, { AppView } from "@/components/Navigation";
import { sbSelect } from "@/integrations/supabase/client";
type Opportunity = { id: string; title?: string | null; created_at?: string | null };

function SupabaseDemo() {
  const [items, setItems] = useState<Opportunity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log("Fetching opportunities from Supabase...");
        const data = await sbSelect<Opportunity>("opportunities", {
          select: "id,title,created_at",
          limit: 5,
          order: { column: "created_at", ascending: false },
        });
        if (mounted) setItems(data);
      } catch (e: any) {
        console.error("Supabase fetch error", e);
        if (mounted) setError("Could not load data from Supabase");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <Text style={styles.text}>{error}</Text>;
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.text}>Connected to Supabase REST.</Text>
      <Text style={styles.text}>Latest opportunities: {items.length}</Text>
      {items.map((it) => (
        <Text key={it.id} style={styles.text} numberOfLines={1}>
          • {it.title ?? "Untitled"}
        </Text>
      ))}
    </View>
  );
}

export default function TabOneScreen() {
  const [view, setView] = useState<AppView>("jobs");
  const insets = useSafeAreaInsets();
  const containerStyle = useMemo(() => [{ ...styles.screen, paddingTop: insets.top }], [insets.top]);

  return (
    <View style={containerStyle as any}>
      <Navigation
        currentView={view}
        setCurrentView={setView}
        unreadCount={3}
        alertCount={2}
        onCreateOpportunity={() => console.log("Create opportunity")}
        onBellPress={() => setView("applicants")}
        onLogout={() => console.log("Logout pressed")}
        profileData={{ full_name: "Alex Morgan", profile_picture: undefined }}
      />

      <ScrollView contentContainerStyle={styles.content} testID="content-scroll">
        <Text style={styles.title}>{view.toUpperCase()}</Text>
        <SupabaseDemo />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  text: {
    fontSize: 16,
  },
});
