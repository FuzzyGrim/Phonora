import React from "react";
import { Tabs } from "expo-router";
import { useTheme } from "@/context/ThemeContext";
import { Home, Search, Library, Settings } from "lucide-react-native";
import { View, StyleSheet } from "react-native";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import MiniPlayer from "@/components/MiniPlayer";

export default function TabLayout() {
  const { colors } = useTheme();
  const { playback } = useMusicPlayerStore();
  const showMiniPlayer = playback.currentSong !== null;

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.text,
          // This creates space for the MiniPlayer when it's visible
          tabBarItemStyle: showMiniPlayer ? { paddingBottom: 0 } : undefined,
        }}
        // Use tabBar prop with BottomTabBar from @react-navigation/bottom-tabs
        tabBar={(props) => (
          <View>
            {showMiniPlayer && <MiniPlayer />}
            <BottomTabBar {...props} />
          </View>
        )}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => (
              <Search size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color, size }) => (
              <Library size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Settings size={size} color={color} />
            ),
          }}
        />
        {/* Hide these screens from the tab bar */}
        <Tabs.Screen
          name="artist-details"
          options={{
            href: null, // This prevents it from being a root tab
          }}
        />
        <Tabs.Screen
          name="album-details"
          options={{
            href: null, // This prevents it from being a root tab
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
