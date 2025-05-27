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
import { ChevronLeft, Disc, Music } from "lucide-react-native";
import { router } from "expo-router";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { useShallow } from 'zustand/react/shallow';

interface Playlist {
  id: string;
  name: string;
  songCount: number;
  coverArt?: string;
  owner?: string;
  public?: boolean;
  created?: string;
  changed?: string;
}

export default function PlaylistsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { getCoverArtUrl } = useMusicPlayerStore();
  const { config, generateAuthParams } = useMusicPlayerStore(useShallow((state) => ({
    config: state.config,
    generateAuthParams: state.generateAuthParams,
  })));

  useEffect(() => {
    // Fetch playlists from the server
    const fetchPlaylists = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Return early if no config is available
        if (!config || !config.serverUrl) {
          setError("Server configuration is missing");
          setIsLoading(false);
          return;
        }

        // Generate authentication parameters
        const authParams = generateAuthParams();

        // Make API request to get playlists
        const response = await fetch(
          `${config.serverUrl}/rest/getPlaylists.view?${authParams.toString()}`
        );
        const data = await response.json();

        if (data["subsonic-response"].status === "ok") {
          // Extract playlists from the response
          const playlistList = data["subsonic-response"].playlists?.playlist || [];

          // Format and set playlists
          const formattedPlaylists = playlistList.map((playlist: any) => ({
            id: playlist.id,
            name: playlist.name,
            songCount: playlist.songCount || 0,
            coverArt: playlist.coverArt,
            owner: playlist.owner,
            public: playlist.public,
            created: playlist.created,
            changed: playlist.changed
          }));

          setPlaylists(formattedPlaylists);
        } else {
          throw new Error(
            data["subsonic-response"].error?.message || "Failed to fetch playlists"
          );
        }
      } catch (error) {
        console.error("Error fetching playlists:", error);
        setError(error instanceof Error ? error.message : "Failed to fetch playlists");
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
        router.push({
          pathname: "/(tabs)/playlist-details",
          params: { id: item.id, name: item.name }
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
          <View style={[styles.playlistIcon, { backgroundColor: colors.surface }]}>
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
            <Text style={[styles.playlistOwner, { color: colors.textSecondary }]}>
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
  errorText: {
    fontSize: 16,
    fontFamily: "Inter-Medium",
    textAlign: "center",
    padding: 20,
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
  playlistImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
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
  playlistOwner: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
});
