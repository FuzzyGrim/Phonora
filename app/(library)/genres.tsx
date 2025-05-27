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
import { useShallow } from "zustand/react/shallow";

interface Genre {
  id: string;
  name: string;
  songCount: number;
}

export default function GenresScreen() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Access config and utility functions from the store using shallow equality
  const { config, generateAuthParams } = useMusicPlayerStore(useShallow((state) => ({
    config: state.config,
    generateAuthParams: state.generateAuthParams,
  })));

  useEffect(() => {
    // Fetch genres from the server
    const fetchGenres = async () => {
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

        // Make API request to get genres
        const response = await fetch(
          `${config.serverUrl}/rest/getGenres.view?${authParams.toString()}`
        );
        const data = await response.json();

        if (data["subsonic-response"].status === "ok") {
          const genresData = data["subsonic-response"].genres?.genre || [];

          const genresArray = Array.isArray(genresData) ? genresData : [genresData];

          // Format and set genres with simplified logic
          const formattedGenres = genresArray
            .filter((genre: any) => genre && genre.value) // Filter out genres without a value
            .map((genre: any) => ({
              id: genre.value,
              name: genre.value, // Use value for the name
              songCount: genre.songCount || 0,
            }));

          // Sort alphabetically by name
          formattedGenres.sort((a: Genre, b: Genre) =>
            (a.name || "").localeCompare(b.name || "")
          );

          setGenres(formattedGenres);
        } else {
          throw new Error(
            data["subsonic-response"].error?.message || "Failed to fetch genres"
          );
        }
      } catch (error) {
        console.error("Error fetching genres:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGenres();
  }, [config, generateAuthParams]);

  const renderGenreItem = ({ item }: { item: Genre }) => (
    <TouchableOpacity
      style={[styles.genreItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => {
        // Navigate to genre songs screen
        router.push({
          pathname: "/(tabs)/genre-songs",
          params: {
            id: item.id,
            name: item.name
          }
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
