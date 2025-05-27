import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { ChevronLeft, Disc } from "lucide-react-native";
import { router } from "expo-router";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";

interface Playlist {
  id: string;
  name: string;
  songCount: number;
}

export default function PlaylistsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const { config } = useMusicPlayerStore();

  useEffect(() => {
    // Fetch playlists from the server
    const fetchPlaylists = async () => {
      setIsLoading(true);
      try {
        // This is a placeholder. You'll need to implement the actual API call
        // to fetch playlists from your Subsonic server
        
        // Example data for UI development
        setPlaylists([
          { id: "1", name: "Favorites", songCount: 12 },
          { id: "2", name: "Recently Added", songCount: 25 },
          { id: "3", name: "Rock", songCount: 42 },
          { id: "4", name: "Relaxing", songCount: 18 },
        ]);
      } catch (error) {
        console.error("Error fetching playlists:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylists();
  }, []);

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={[styles.playlistItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        // Navigate to playlist details screen
        // This would be implemented in a future step
      }}
    >
      <View style={styles.playlistItemLeft}>
        <View style={[styles.playlistIcon, { backgroundColor: colors.surface }]}>
          <Disc size={24} color={colors.primary} />
        </View>
        <View style={styles.playlistDetails}>
          <Text style={[styles.playlistName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.playlistCount, { color: colors.textSecondary }]}>
            {item.songCount} {item.songCount === 1 ? "song" : "songs"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Playlists</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading playlists...
          </Text>
        </View>
      ) : playlists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No playlists found
          </Text>
        </View>
      ) : (
        <FlatList
          data={playlists}
          keyExtractor={(item) => item.id}
          renderItem={renderPlaylistItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter-Bold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    fontFamily: "Inter-Regular",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 18,
    fontFamily: "Inter-Medium",
  },
  listContainer: {
    padding: 20,
  },
  playlistItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  playlistItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  playlistDetails: {
    marginLeft: 15,
  },
  playlistName: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    marginBottom: 4,
  },
  playlistCount: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
});
