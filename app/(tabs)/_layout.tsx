import { Tabs } from "expo-router";
import { Network, BriefcaseBusiness } from "lucide-react-native";
import React from "react";

import Colors from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: "#0C0C12",
          borderTopColor: "#23232B",
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
      <Tabs.Screen
        name="network"
        options={{
          title: "Network",
          tabBarIcon: ({ color, size }) => <Network color={color} size={size ?? 20} />,
        }}
      />
      <Tabs.Screen
        name="opportunities"
        options={{
          title: "Opportunities",
          tabBarIcon: ({ color, size }) => (
            <BriefcaseBusiness color={color} size={size ?? 20} />
          ),
        }}
      />
    </Tabs>
  );
}
