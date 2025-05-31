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
import { useMusicPlayerStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { Genre } from "@/store/types";

export default function GenresScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Access fetchGenres from the store using shallow equality
  const { fetchGenres } = useMusicPlayerStore(
    useShallow((state) => ({
      fetchGenres: state.fetchGenres,
    })),
  );

  useEffect(() => {
    // Fetch genres from the server
    const loadGenres = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const genresData = await fetchGenres();
        setGenres(genresData);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to fetch genres");
        console.error("Error fetching genres:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadGenres();
  }, [fetchGenres]);

  const renderGenreItem = ({ item }: { item: Genre }) => (
    <TouchableOpacity
      style={[
        styles.genreItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      onPress={() => {
        // Navigate to genre songs screen
        router.push({
          pathname: "/(tabs)/genre-songs",
          params: {
            id: item.id,
            name: item.name,
          },
        });
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
      ) : error ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
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
  genreCount: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    textAlign: "center",
  },
  genreIcon: {
    marginBottom: 8,
  },
  genreItem: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "column",
    marginBottom: 15,
    padding: 15,
    width: "48%",
  },
  genreName: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginBottom: 4,
    textAlign: "center",
  },
  genresRow: {
    justifyContent: "space-between",
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
