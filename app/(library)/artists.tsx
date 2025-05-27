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
import { useMusicPlayerStore } from "@/store/musicPlayerStore";

interface Artist {
  id: string;
  name: string;
  albumCount: number;
  imageUrl?: string;
}

export default function ArtistsScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [artists, setArtists] = useState<Artist[]>([]);
  const { config } = useMusicPlayerStore();

  useEffect(() => {
    // Fetch artists from the server
    const fetchArtists = async () => {
      setIsLoading(true);
      try {
        // This is a placeholder. You'll need to implement the actual API call
        // to fetch artists from your Subsonic server
        
        // Example data for UI development
        setArtists([
          { id: "1", name: "The Beatles", albumCount: 12 },
          { id: "2", name: "Pink Floyd", albumCount: 8 },
          { id: "3", name: "Queen", albumCount: 15 },
          { id: "4", name: "Led Zeppelin", albumCount: 9 },
          { id: "5", name: "David Bowie", albumCount: 22 },
        ]);
      } catch (error) {
        console.error("Error fetching artists:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtists();
  }, []);

  const renderArtistItem = ({ item }: { item: Artist }) => (
    <TouchableOpacity
      style={[styles.artistItem, { borderBottomColor: colors.border }]}
      onPress={() => {
        // Navigate to artist details screen
        // This would be implemented in a future step
      }}
    >
      <View style={styles.artistItemLeft}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.artistImage} />
        ) : (
          <View style={[styles.artistIcon, { backgroundColor: colors.surface }]}>
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
  artistItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  artistItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  artistImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  artistIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  artistDetails: {
    marginLeft: 15,
  },
  artistName: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    marginBottom: 4,
  },
  artistCount: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
});
