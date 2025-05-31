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
import { ChevronLeft, Disc } from "lucide-react-native";
import { router } from "expo-router";
import { useMusicPlayerStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { Album } from "@/store/types";

export default function AlbumsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);

  // Access config from the store using shallow equality
  const { fetchAlbums } = useMusicPlayerStore(
    useShallow((state) => ({
      fetchAlbums: state.fetchAlbums,
    })),
  );

  useEffect(() => {
    // Fetch albums from the server
    const loadAlbums = async () => {
      setIsLoading(true);
      try {
        const albumsData = await fetchAlbums();
        setAlbums(albumsData);
      } catch (error) {
        console.error("Error fetching albums:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAlbums();
  }, [fetchAlbums]);

  const renderAlbumItem = ({ item }: { item: Album }) => (
    <TouchableOpacity
      style={styles.albumItem}
      onPress={() => {
        // Navigate to album details screen with the album ID
        router.push({
          pathname: "/(tabs)/album-details",
          params: { id: item.id },
        });
      }}
    >
      <View style={styles.albumImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.albumImage} />
        ) : (
          <View
            style={[
              styles.albumPlaceholder,
              { backgroundColor: colors.surface },
            ]}
          >
            <Disc size={24} color={colors.primary} />
          </View>
        )}
      </View>
      <Text
        style={[styles.albumName, { color: colors.text }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <Text
        style={[styles.albumArtist, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {item.artist}
      </Text>
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
        <Text style={[styles.title, { color: colors.text }]}>Albums</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading albums...
          </Text>
        </View>
      ) : albums.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No albums found
          </Text>
        </View>
      ) : (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.id}
          renderItem={renderAlbumItem}
          contentContainerStyle={styles.listContainer}
          numColumns={2}
          columnWrapperStyle={styles.albumsRow}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  albumArtist: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  albumImage: {
    height: "100%",
    width: "100%",
  },
  albumImageContainer: {
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 8,
    overflow: "hidden",
  },
  albumItem: {
    marginBottom: 20,
    width: "48%",
  },
  albumName: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    marginBottom: 2,
  },
  albumPlaceholder: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  albumsRow: {
    justifyContent: "space-between",
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
    padding: 15,
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
