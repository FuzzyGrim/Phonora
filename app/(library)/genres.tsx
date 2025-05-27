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
import { ChevronLeft, Tag } from "lucide-react-native";
import { router } from "expo-router";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";

interface Genre {
  id: string;
  name: string;
  songCount: number;
}

export default function GenresScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [genres, setGenres] = useState<Genre[]>([]);
  const { config } = useMusicPlayerStore();

  useEffect(() => {
    // Fetch genres from the server
    const fetchGenres = async () => {
      setIsLoading(true);
      try {
        // This is a placeholder. You'll need to implement the actual API call
        // to fetch genres from your Subsonic server
        
        // Example data for UI development
        setGenres([
          { id: "1", name: "Rock", songCount: 256 },
          { id: "2", name: "Pop", songCount: 189 },
          { id: "3", name: "Jazz", songCount: 120 },
          { id: "4", name: "Classical", songCount: 85 },
          { id: "5", name: "Electronic", songCount: 168 },
          { id: "6", name: "Hip Hop", songCount: 147 },
          { id: "7", name: "Metal", songCount: 203 },
          { id: "8", name: "Blues", songCount: 98 },
          { id: "9", name: "Country", songCount: 132 },
          { id: "10", name: "Folk", songCount: 76 },
        ]);
      } catch (error) {
        console.error("Error fetching genres:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenres();
  }, []);

  const renderGenreItem = ({ item }: { item: Genre }) => (
    <TouchableOpacity
      style={[styles.genreItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        // Navigate to genre details screen
        // This would be implemented in a future step
      }}
    >
      <Tag size={20} color={colors.primary} style={styles.genreIcon} />
      <Text style={[styles.genreName, { color: colors.text }]}>
        {item.name}
      </Text>
      <Text style={[styles.genreCount, { color: colors.textSecondary }]}>
        {item.songCount}
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
        <Text style={[styles.title, { color: colors.text }]}>Genres</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading genres...
          </Text>
        </View>
      ) : genres.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No genres found
          </Text>
        </View>
      ) : (
        <FlatList
          data={genres}
          keyExtractor={(item) => item.id}
          renderItem={renderGenreItem}
          contentContainerStyle={styles.listContainer}
          numColumns={2}
          columnWrapperStyle={styles.genresRow}
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
  genresRow: {
    justifyContent: "space-between",
  },
  genreItem: {
    width: '48%',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    flexDirection: "column",
    alignItems: "center",
  },
  genreIcon: {
    marginBottom: 8,
  },
  genreName: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    marginBottom: 4,
    textAlign: "center",
  },
  genreCount: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
});
