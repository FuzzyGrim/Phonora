import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import { ChevronLeft, User, Disc, Play } from "lucide-react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useShallow } from "zustand/react/shallow";

// Album interface for artist's album listing
interface ArtistAlbum {
  id: string;
  name: string;
  coverArt?: string;
  songCount: number;
  year?: number;
}

// Song interface for this component
interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverArt?: string;
}

// Artist interface for this component
interface ArtistDetails {
  id: string;
  name: string;
  albumCount?: number;
  albums: ArtistAlbum[];
}

export default function ArtistDetailsScreen() {
  const { colors } = useTheme();
  const { playSongFromSource, getCoverArtUrl } = useMusicPlayerStore();
  const { config, generateAuthParams } = useMusicPlayerStore(
    useShallow((state) => ({
      config: state.config,
      generateAuthParams: state.generateAuthParams,
    })),
  );

  const params = useLocalSearchParams();
  const artistId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSongs, setIsLoadingSongs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artist, setArtist] = useState<ArtistDetails | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);

  const handleBackNavigation = () => {
    const source = params.source as string | undefined;
    if (source === "search") {
      router.push("/(tabs)/search");
    } else {
      router.back();
    }
  };

  useEffect(() => {
    const fetchArtistDetails = async () => {
      if (!config || !config.serverUrl) {
        setError("Server configuration is missing");
        setIsLoading(false);
        return;
      }

      try {
        const authParams = generateAuthParams();

        const response = await fetch(
          `${config.serverUrl}/rest/getArtist.view?id=${artistId}&${authParams.toString()}`,
        );

        const artistData = await response.json();

        if (
          artistData["subsonic-response"].status === "ok" &&
          artistData["subsonic-response"].artist
        ) {
          const artistInfo = artistData["subsonic-response"].artist;
          const formattedAlbums: ArtistAlbum[] = artistInfo.album
            ? artistInfo.album.map((album: any) => ({
                id: album.id,
                name: album.name,
                coverArt: album.coverArt,
                songCount: album.songCount,
                year: album.year,
              }))
            : [];

          setArtist({
            id: artistInfo.id,
            name: artistInfo.name,
            albumCount: artistInfo.albumCount,
            albums: formattedAlbums,
          });

          // Now fetch songs for all albums
          if (formattedAlbums.length > 0) {
            setIsLoadingSongs(true);
            const allSongs: Song[] = [];

            for (const album of formattedAlbums) {
              try {
                const albumResponse = await fetch(
                  `${config.serverUrl}/rest/getAlbum.view?id=${album.id}&${authParams.toString()}`,
                );

                const albumData = await albumResponse.json();

                if (
                  albumData["subsonic-response"].status === "ok" &&
                  albumData["subsonic-response"].album &&
                  albumData["subsonic-response"].album.song
                ) {
                  const albumSongs = albumData[
                    "subsonic-response"
                  ].album.song.map((song: any) => ({
                    id: song.id,
                    title: song.title,
                    artist: song.artist,
                    album: song.album,
                    duration: song.duration,
                    coverArt: song.coverArt,
                  }));

                  allSongs.push(...albumSongs);
                }
              } catch (error) {
                console.error(
                  `Error fetching songs for album ${album.id}:`,
                  error,
                );
                // Continue with other albums even if one fails
              }
            }

            setAllSongs(allSongs);
            setIsLoadingSongs(false);
          }
        } else {
          throw new Error(
            artistData["subsonic-response"].error?.message ||
              "Failed to fetch artist details",
          );
        }
      } catch (error) {
        console.error("Error fetching artist details:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchArtistDetails();
  }, [artistId, config, generateAuthParams]);

  const navigateToAlbum = (albumId: string) => {
    router.push({
      pathname: "/(tabs)/album-details",
      params: { id: albumId },
    });
  };

  const playAllAlbums = () => {
    if (allSongs.length > 0) {
      // Play the first song with artist as the source
      playSongFromSource(allSongs[0], "artist", allSongs);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackNavigation}
          >
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Artist
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading artist details...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !artist) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackNavigation}
          >
            <ChevronLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Artist
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error || "Failed to load artist details"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackNavigation}
        >
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Artist</Text>
      </View>

      <FlatList
        data={artist.albums}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.albumGrid}
        ListHeaderComponent={
          <View style={styles.artistHeader}>
            <View
              style={[
                styles.artistIconContainer,
                { backgroundColor: colors.surface },
              ]}
            >
              <User size={50} color={colors.textSecondary} />
            </View>
            <Text style={[styles.artistName, { color: colors.text }]}>
              {artist.name}
            </Text>
            <Text style={[styles.albumCount, { color: colors.textSecondary }]}>
              {artist.albumCount || artist.albums.length} Albums
            </Text>

            <TouchableOpacity
              style={[
                styles.playAllButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={playAllAlbums}
              disabled={isLoadingSongs || allSongs.length === 0}
            >
              {isLoadingSongs ? (
                <ActivityIndicator size="small" color={colors.background} />
              ) : (
                <>
                  <Play size={16} color={colors.background} />
                  <Text
                    style={[styles.playAllText, { color: colors.background }]}
                  >
                    Play All
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.albumCard, { backgroundColor: colors.surface }]}
            onPress={() => navigateToAlbum(item.id)}
          >
            {item.coverArt ? (
              <Image
                source={{ uri: getCoverArtUrl(item.coverArt) }}
                style={styles.albumCover}
              />
            ) : (
              <View
                style={[
                  styles.placeholderCover,
                  { backgroundColor: colors.cardBackground },
                ]}
              >
                <Disc size={40} color={colors.textSecondary} />
              </View>
            )}
            <Text
              style={[styles.albumTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.albumInfo, { color: colors.textSecondary }]}>
              {item.year ? `${item.year} • ` : ""}
              {item.songCount} song{item.songCount !== 1 ? "s" : ""}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  albumCard: {
    borderRadius: 8,
    marginBottom: 15,
    overflow: "hidden",
    width: "48%",
  },
  albumCount: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
    marginBottom: 20,
  },
  albumCover: {
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    width: "100%",
  },
  albumGrid: {
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  albumInfo: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    paddingBottom: 10,
    paddingHorizontal: 10,
  },
  albumTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    padding: 10,
    paddingBottom: 4,
  },
  artistHeader: {
    alignItems: "center",
    marginBottom: 10,
    padding: 20,
  },
  artistIconContainer: {
    alignItems: "center",
    borderRadius: 60,
    height: 120,
    justifyContent: "center",
    marginBottom: 15,
    width: 120,
  },
  artistName: {
    fontFamily: "Inter-Bold",
    fontSize: 24,
    marginBottom: 6,
    textAlign: "center",
  },
  backButton: {
    marginRight: 10,
  },
  container: {
    flex: 1,
  },
  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  errorText: {
    fontFamily: "Inter-Medium",
    fontSize: 16,
    textAlign: "center",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    paddingBottom: 15,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 18,
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
  placeholderCover: {
    alignItems: "center",
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    justifyContent: "center",
    width: "100%",
  },
  playAllButton: {
    alignItems: "center",
    borderRadius: 20,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  playAllText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    marginLeft: 8,
  },
});
