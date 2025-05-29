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
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { useShallow } from "zustand/react/shallow";

interface Album {
  id: string;
  name: string;
  artist: string;
  songCount: number;
  imageUrl?: string;
}

export default function AlbumsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [albums, setAlbums] = useState<Album[]>([]);

  // Access config from the store using shallow equality
  const { config, getCoverArtUrl } = useMusicPlayerStore(
    useShallow((state) => ({
      config: state.config,
      getCoverArtUrl: state.getCoverArtUrl,
    })),
  );

  useEffect(() => {
    // Fetch albums from the server
    const fetchAlbums = async () => {
      setIsLoading(true);
      try {
        if (!config || !config.serverUrl) {
          console.error("Server configuration is missing");
          setIsLoading(false);
          return;
        }

        // Get the auth parameters from the store
        const { generateAuthParams } = useMusicPlayerStore.getState();
        const authParams = generateAuthParams();

        // Make the API call to get all albums
        const response = await fetch(
          `${config.serverUrl}/rest/getAlbumList2.view?type=alphabeticalByName&size=500&${authParams.toString()}`,
        );

        const data = await response.json();

        if (
          data["subsonic-response"].status === "ok" &&
          data["subsonic-response"].albumList2
        ) {
          const albumsData = data["subsonic-response"].albumList2.album || [];

          // Map the API response to our Album interface
          const formattedAlbums: Album[] = albumsData.map((album: any) => ({
            id: album.id,
            name: album.name,
            artist: album.artist,
            songCount: album.songCount,
            imageUrl: album.coverArt
              ? getCoverArtUrl(album.coverArt)
              : undefined,
          }));

          setAlbums(formattedAlbums);
        } else {
          throw new Error(
            data["subsonic-response"].error?.message ||
              "Failed to fetch albums",
          );
        }
      } catch (error) {
        console.error("Error fetching albums:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbums();
  }, [config, getCoverArtUrl]);

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
    padding: 15,
  },
  albumsRow: {
    justifyContent: "space-between",
  },
  albumItem: {
    width: "48%",
    marginBottom: 20,
  },
  albumImageContainer: {
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  albumImage: {
    width: "100%",
    height: "100%",
  },
  albumPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  albumName: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    marginBottom: 2,
  },
  albumArtist: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
  },
});
