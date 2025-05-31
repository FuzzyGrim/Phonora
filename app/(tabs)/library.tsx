import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { Music, Disc, Users, Tag, ChevronRight } from "lucide-react-native";
import { router } from "expo-router";

export default function LibraryScreen() {
  const { colors } = useTheme();

  const menuItems = [
    { icon: Disc, title: "Playlists", route: "/(library)/playlists" },
    { icon: Users, title: "Artists", route: "/(library)/artists" },
    { icon: Music, title: "Albums", route: "/(library)/albums" },
    { icon: Tag, title: "Genres", route: "/(library)/genres" },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
      </View>
      <View style={styles.content}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.menuItem, { borderBottomColor: colors.border }]}
            onPress={() => router.push(item.route as any)}
          >
            <View style={styles.menuItemLeft}>
              <item.icon size={24} color={colors.primary} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {item.title}
              </Text>
            </View>
            <Text
              style={[styles.menuItemCount, { color: colors.textSecondary }]}
            >
              <ChevronRight size={20} color={colors.textSecondary} />
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  menuItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
  },
  menuItemCount: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
  },
  menuItemLeft: {
    alignItems: "center",
    flexDirection: "row",
  },
  menuItemText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginLeft: 15,
  },
  title: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
  },
});
