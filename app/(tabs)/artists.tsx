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
import { ChevronLeft, User } from "lucide-react-native";
import { router } from "expo-router";
import { useMusicPlayerStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { Artist } from "@/store/types";

export default function ArtistsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const { fetchArtists, fetchArtistsOffline, isOfflineMode } =
    useMusicPlayerStore(
      useShallow((state) => ({
        fetchArtists: state.fetchArtists,
        fetchArtistsOffline: state.fetchArtistsOffline,
        isOfflineMode: state.isOfflineMode,
      })),
    );

  useEffect(() => {
    // Fetch artists from the server or cache based on offline mode
    const loadArtists = async () => {
      setIsLoading(true);
      try {
        let artistsData: Artist[];
        if (isOfflineMode) {
          artistsData = await fetchArtistsOffline();
        } else {
          artistsData = await fetchArtists();
        }
        setArtists(artistsData);
      } catch (error) {
        console.error("Error fetching artists:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadArtists();
  }, [fetchArtists, fetchArtistsOffline, isOfflineMode]);

  const renderArtistItem = ({ item }: { item: Artist }) => (
    <TouchableOpacity
      style={[styles.artistItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        // Navigate to artist details screen
        router.push({
          pathname: "/(tabs)/artist-details",
          params: { id: item.id, name: item.name },
        });
      }}
    >
      <View style={styles.artistItemLeft}>
        {item.coverArt ? (
          <Image source={{ uri: item.coverArt }} style={styles.artistImage} />
        ) : (
          <View
            style={[styles.artistIcon, { backgroundColor: colors.surface }]}
          >
            <User size={24} color={colors.primary} />
          </View>
        )}
        <View style={styles.artistDetails}>
          <Text style={[styles.artistName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.artistCount, { color: colors.textSecondary }]}>
            {item.albumCount} {item.albumCount === 1 ? "album" : "albums"}
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
        <Text style={[styles.title, { color: colors.text }]}>Artists</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading artists...
          </Text>
        </View>
      ) : artists.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No artists found
          </Text>
        </View>
      ) : (
        <FlatList
          data={artists}
          keyExtractor={(item) => item.id}
          renderItem={renderArtistItem}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  artistCount: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
  },
  artistDetails: {
    marginLeft: 15,
  },
  artistIcon: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  artistImage: {
    borderRadius: 24,
    height: 48,
    width: 48,
  },
  artistItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 15,
  },
  artistItemLeft: {
    alignItems: "center",
    flexDirection: "row",
  },
  artistName: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginBottom: 4,
  },
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
  title: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
  },
});
