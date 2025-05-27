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
  const { config } = useMusicPlayerStore();

  useEffect(() => {
    // Fetch albums from the server
    const fetchAlbums = async () => {
      setIsLoading(true);
      try {
        // This is a placeholder. You'll need to implement the actual API call
        // to fetch albums from your Subsonic server
        
        // Example data for UI development
        setAlbums([
          { id: "1", name: "Abbey Road", artist: "The Beatles", songCount: 17 },
          { id: "2", name: "Dark Side of the Moon", artist: "Pink Floyd", songCount: 10 },
          { id: "3", name: "A Night at the Opera", artist: "Queen", songCount: 12 },
          { id: "4", name: "Led Zeppelin IV", artist: "Led Zeppelin", songCount: 8 },
          { id: "5", name: "The Rise and Fall of Ziggy Stardust", artist: "David Bowie", songCount: 11 },
        ]);
      } catch (error) {
        console.error("Error fetching albums:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbums();
  }, []);

  const renderAlbumItem = ({ item }: { item: Album }) => (
    <TouchableOpacity
      style={styles.albumItem}
      onPress={() => {
        // Navigate to album details screen
        // This would be implemented in a future step
      }}
    >
      <View style={styles.albumImageContainer}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.albumImage} />
        ) : (
          <View style={[styles.albumPlaceholder, { backgroundColor: colors.surface }]}>
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
    width: '48%',
    marginBottom: 20,
  },
  albumImageContainer: {
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
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
