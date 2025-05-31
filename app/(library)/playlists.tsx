import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { ChevronLeft, Music } from "lucide-react-native";
import { router } from "expo-router";
import { useMusicPlayerStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { Playlist } from "@/store/types";

export default function PlaylistsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { getCoverArtUrl, fetchPlaylists } = useMusicPlayerStore(
    useShallow((state) => ({
      getCoverArtUrl: state.getCoverArtUrl,
      fetchPlaylists: state.fetchPlaylists,
    })),
  );

  useEffect(() => {
    // Fetch playlists from the server
    const loadPlaylists = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const playlistsData = await fetchPlaylists();
        setPlaylists(playlistsData);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to fetch playlists");
        console.error("Error fetching playlists:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlaylists();
  }, [fetchPlaylists]);

  const renderPlaylistItem = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      style={[styles.playlistItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        // Navigate to playlist details screen
        router.push({
          pathname: "/(tabs)/playlist-details",
          params: { id: item.id, name: item.name },
        });
      }}
    >
      <View style={styles.playlistItemLeft}>
        {item.coverArt ? (
          <Image
            source={{ uri: getCoverArtUrl(item.coverArt) }}
            style={styles.playlistImage}
          />
        ) : (
          <View
            style={[styles.playlistIcon, { backgroundColor: colors.surface }]}
          >
            <Music size={24} color={colors.primary} />
          </View>
        )}
        <View style={styles.playlistDetails}>
          <Text style={[styles.playlistName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.playlistCount, { color: colors.textSecondary }]}>
            {item.songCount} {item.songCount === 1 ? "song" : "songs"}
          </Text>
          {item.owner && (
            <Text
              style={[styles.playlistOwner, { color: colors.textSecondary }]}
            >
              by {item.owner}
            </Text>
          )}
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
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
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
  backButton: {
    marginRight: 12,
  },
  container: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Inter-Medium",
    fontSize: 18,
  },
  errorText: {
    fontFamily: "Inter-Medium",
    fontSize: 16,
    padding: 20,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    padding: 20,
    paddingTop: 60,
  },
  listContainer: {
    padding: 20,
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
    marginTop: 10,
  },
  playlistCount: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
  },
  playlistDetails: {
    marginLeft: 15,
  },
  playlistIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  playlistImage: {
    borderRadius: 8,
    height: 48,
    width: 48,
  },
  playlistItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
  },
  playlistItemLeft: {
    alignItems: "center",
    flexDirection: "row",
  },
  playlistName: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginBottom: 4,
  },
  playlistOwner: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    marginTop: 2,
  },
  title: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
  },
});
