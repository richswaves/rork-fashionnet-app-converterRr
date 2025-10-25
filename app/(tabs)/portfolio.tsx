import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Dimensions } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { sbSelect } from "@/integrations/supabase/client";
import type { PortfolioItemWithProfile } from "@/integrations/supabase/portfolio-types";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const COLUMN_COUNT = 2;
const GAP = 12;
const PADDING = 16;
const ITEM_WIDTH = (width - PADDING * 2 - GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: portfolioItems = [], isLoading } = useQuery<PortfolioItemWithProfile[]>({
    queryKey: ["all-portfolio"],
    queryFn: async () => {
      const items = await sbSelect<PortfolioItemWithProfile>("portfolio_items", {
        select: "*, profiles:user_id(user_id, full_name, username, profile_picture)",
        order: { column: "created_at", ascending: false },
        limit: 100,
      });
      return items;
    },
  });

  const column1: PortfolioItemWithProfile[] = [];
  const column2: PortfolioItemWithProfile[] = [];

  portfolioItems.forEach((item, index) => {
    if (index % 2 === 0) {
      column1.push(item);
    } else {
      column2.push(item);
    }
  });

  function navigateToProfile(userId: string) {
    router.push(`/profile/${userId}`);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "Portfolio",
          headerStyle: {
            backgroundColor: "#0B0B0F",
          },
          headerTintColor: "#E5E7EB",
          headerTitleStyle: {
            fontWeight: "900" as const,
            fontSize: 18,
          },
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
        testID="portfolio-scroll"
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Loading portfolio...</Text>
          </View>
        ) : portfolioItems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No Portfolio Items Yet</Text>
            <Text style={styles.emptyText}>
              Portfolio items will appear here once users start uploading their work.
            </Text>
          </View>
        ) : (
          <View style={styles.masonryWrap}>
            <View style={styles.column}>
              {column1.map((item) => {
                const aspectRatio =
                  item.width && item.height && item.height > 0
                    ? item.width / item.height
                    : 1;
                const itemHeight = ITEM_WIDTH / aspectRatio;

                return (
                  <Pressable
                    key={item.id}
                    style={[styles.item, { height: itemHeight }]}
                    onPress={() => {
                      if (item.profiles?.user_id) {
                        navigateToProfile(item.profiles.user_id);
                      }
                    }}
                    testID={`portfolio-item-${item.id}`}
                  >
                    <Image
                      source={{ uri: item.media_url }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["rgba(11,11,15,0)", "rgba(11,11,15,0.85)"]}
                      locations={[0, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.overlay}
                    >
                      {item.profiles && (
                        <View style={styles.userInfo}>
                          {item.profiles.profile_picture && (
                            <Image
                              source={{ uri: item.profiles.profile_picture }}
                              style={styles.avatar}
                            />
                          )}
                          <Text style={styles.userName} numberOfLines={1}>
                            {item.profiles.full_name || item.profiles.username || "User"}
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.column}>
              {column2.map((item) => {
                const aspectRatio =
                  item.width && item.height && item.height > 0
                    ? item.width / item.height
                    : 1;
                const itemHeight = ITEM_WIDTH / aspectRatio;

                return (
                  <Pressable
                    key={item.id}
                    style={[styles.item, { height: itemHeight }]}
                    onPress={() => {
                      if (item.profiles?.user_id) {
                        navigateToProfile(item.profiles.user_id);
                      }
                    }}
                    testID={`portfolio-item-${item.id}`}
                  >
                    <Image
                      source={{ uri: item.media_url }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                    <LinearGradient
                      colors={["rgba(11,11,15,0)", "rgba(11,11,15,0.85)"]}
                      locations={[0, 1]}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                      style={styles.overlay}
                    >
                      {item.profiles && (
                        <View style={styles.userInfo}>
                          {item.profiles.profile_picture && (
                            <Image
                              source={{ uri: item.profiles.profile_picture }}
                              style={styles.avatar}
                            />
                          )}
                          <Text style={styles.userName} numberOfLines={1}>
                            {item.profiles.full_name || item.profiles.username || "User"}
                          </Text>
                        </View>
                      )}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0F",
  },
  scroll: {
    paddingHorizontal: PADDING,
    paddingTop: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  loadingText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600" as const,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#E5E7EB",
    fontSize: 18,
    fontWeight: "900" as const,
    marginBottom: 8,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  masonryWrap: {
    flexDirection: "row",
    gap: GAP,
  },
  column: {
    flex: 1,
    gap: GAP,
  },
  item: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#14141C",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#23232B",
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700" as const,
    flex: 1,
  },
});
