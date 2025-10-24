import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Building2, Filter, MapPin, ThumbsUp } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";

interface ProfileRow {
  user_id: string;
  full_name?: string;
  profile_picture?: string;
  profession?: string;
  username?: string;
}

interface OpportunityRow {
  id: string;
  title?: string;
  company?: string | null;
  location?: string | null;
  type?: string | null;
  cover_image?: string | null;
  created_at?: string;
  user_id?: string;
  profiles?: ProfileRow;
}

export default function OpportunitiesScreen() {
  const insets = useSafeAreaInsets();
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const container = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);

  const { data, isLoading, error } = useQuery<OpportunityRow[]>({
    queryKey: ["opportunities", "all"],
    queryFn: async () => {
      const rows = await sbSelect<OpportunityRow>("opportunities", {
        select: "*,profiles:user_id(*)",
        order: { column: "created_at", ascending: false },
        limit: 50,
      });
      return rows;
    },
  });

  function toggleUpvote(id: string) {
    setLiked((s) => ({ ...s, [id]: !s[id] }));
  }

  return (
    <View style={container} testID="opportunities-screen">
      <View style={styles.header}>
        <Text style={styles.h1}>Opportunities</Text>
        <Pressable style={styles.filterBtn} onPress={() => {}} testID="opp-filter">
          <Filter color="#E5E7EB" size={18} />
          <Text style={styles.filterText}>Filters</Text>
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.loaderRow} testID="opps-loading">
          <ActivityIndicator color="#E5E7EB" />
        </View>
      )}
      {!!error && (
        <Text style={styles.errorText} testID="opps-error">Failed to load opportunities</Text>
      )}

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const title = item.title ?? "Opportunity";
          const company = item.company ?? item.profiles?.full_name ?? item.profiles?.username ?? "";
          const locationText = [item.location ?? "", item.type ?? ""].filter(Boolean).join(" • ");
          const imageUri = item.cover_image ?? "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=1200&auto=format&fit=crop&q=60";
          const upvotes = 0;
          return (
            <View style={styles.card} testID={`opp-${item.id}`}>
              <Image source={{ uri: imageUri }} style={styles.cover} resizeMode="cover" />
              <View style={styles.body}>
                <Text numberOfLines={2} style={styles.title}>{title}</Text>
                <View style={styles.row}>
                  <Building2 color="#9CA3AF" size={14} />
                  <Text numberOfLines={1} style={styles.metaText}>{company}</Text>
                </View>
                <View style={styles.row}>
                  <MapPin color="#9CA3AF" size={14} />
                  <Text numberOfLines={1} style={styles.metaText}>{locationText}</Text>
                </View>

                <View style={styles.footerRow}>
                  <Pressable style={styles.upvote} onPress={() => toggleUpvote(item.id)} testID={`upvote-${item.id}`}>
                    <ThumbsUp color={liked[item.id] ? "#10B981" : "#E5E7EB"} size={16} />
                    <Text style={[styles.upvoteText, liked[item.id] && styles.upvoteActive]}>{upvotes + (liked[item.id] ? 1 : 0)}</Text>
                  </Pressable>

                  <Pressable style={styles.applyBtn} onPress={() => {}} testID={`apply-${item.id}`}>
                    <Text style={styles.applyText}>Apply</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B0B0F" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  h1: { color: "#E5E7EB", fontSize: 24, fontWeight: "900" },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  filterText: { color: "#E5E7EB", fontSize: 13, fontWeight: "700" },
  list: { padding: 12, paddingBottom: 24 },
  card: {
    backgroundColor: "#121218",
    borderColor: "#23232B",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  cover: { width: "100%", height: 160 },
  body: { padding: 12 },
  title: { color: "#E5E7EB", fontSize: 16, fontWeight: "900", marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  metaText: { color: "#9CA3AF", fontSize: 12, flexShrink: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  upvote: { flexDirection: "row", alignItems: "center", gap: 6 },
  upvoteText: { color: "#E5E7EB", fontSize: 12, fontWeight: "800" },
  upvoteActive: { color: "#10B981" },
  applyBtn: { backgroundColor: "#E5E7EB", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  applyText: { color: "#0B0B0F", fontSize: 14, fontWeight: "900" },
  loaderRow: { paddingVertical: 10, alignItems: "center" },
  errorText: { color: "#ef4444", fontSize: 13, fontWeight: "700" },
});
