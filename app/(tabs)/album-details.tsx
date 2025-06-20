import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import { ChevronLeft, Play, Music } from "lucide-react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useShallow } from "zustand/react/shallow";

// Song interface for this component
interface AlbumSong {
  id: string;
  title: string;
  artist: string;
  duration: number;
  track?: number;
  coverArt?: string;
}

// Album interface for this component
interface AlbumDetails {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverArt?: string;
  year?: number;
  genre?: string;
  songCount: number;
  duration?: number;
  songs: AlbumSong[];
}

export default function AlbumDetailsScreen() {
  const { colors } = useTheme();
  const { playSongFromSource, getCoverArtUrl } = useMusicPlayerStore();

  // Access config and auth functions from the store
  const { config, generateAuthParams } = useMusicPlayerStore(
    useShallow((state) => ({
      config: state.config,
      generateAuthParams: state.generateAuthParams,
    })),
  );

  const params = useLocalSearchParams();
  const albumId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [album, setAlbum] = useState<AlbumDetails | null>(null);

  const handleBackNavigation = () => {
    const source = params.source as string | undefined;
    if (source === "search") {
      router.push("/(tabs)/search");
    } else {
      router.back();
    }
  };

  useEffect(() => {
    const fetchAlbumDetails = async () => {
      if (!config || !config.serverUrl) {
        setError("Server configuration is missing");
        setIsLoading(false);
        return;
      }

      try {
        const authParams = generateAuthParams();

        const response = await fetch(
          `${config.serverUrl}/rest/getAlbum.view?id=${albumId}&${authParams.toString()}`,
        );

        const albumData = await response.json();

        if (
          albumData["subsonic-response"].status === "ok" &&
          albumData["subsonic-response"].album
        ) {
          const albumInfo = albumData["subsonic-response"].album;
          const formattedSongs: AlbumSong[] = albumInfo.song
            ? albumInfo.song.map((song: any) => ({
              id: song.id,
              title: song.title,
              artist: song.artist,
              duration: song.duration,
              track: song.track,
              coverArt: song.coverArt,
            }))
            : [];

          setAlbum({
            id: albumInfo.id,
            name: albumInfo.name,
            artist: albumInfo.artist,
            artistId: albumInfo.artistId,
            coverArt: albumInfo.coverArt,
            year: albumInfo.year,
            genre: albumInfo.genre,
            songCount: albumInfo.songCount,
            duration: albumInfo.duration,
            songs: formattedSongs,
          });
        } else {
          throw new Error(
            albumData["subsonic-response"].error?.message ||
            "Failed to fetch album details",
          );
        }
      } catch (error) {
        console.error("Error fetching album details:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlbumDetails();
  }, [albumId, config, generateAuthParams]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handlePlaySong = (song: AlbumSong) => {
    const songObject = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: album?.name || "",
      duration: song.duration,
      coverArt: song.coverArt,
    };

    // Convert all album songs to the Song format for the playlist
    const allSongs =
      album?.songs.map((s) => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: album?.name || "",
        duration: s.duration,
        coverArt: s.coverArt,
      })) || [];

    // Play the song with album as the source
    playSongFromSource(songObject, "album", allSongs);
  };

  const navigateToArtist = () => {
    if (album?.artistId) {
      // Preserve the source parameter if we came from search
      const source = params.source as string | undefined;
      router.push({
        pathname: "/(tabs)/artist-details",
        params: { id: album.artistId, source: source },
      });
    }
  };

  const playAllSongs = () => {
    if (album?.songs && album.songs.length > 0) {
      handlePlaySong(album.songs[0]);
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
            Album
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !album) {
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
            Album
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error || "Failed to load album details"}
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Album</Text>
      </View>

      <FlatList
        data={album.songs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.albumHeader}>
            {album.coverArt ? (
              <Image
                source={{ uri: getCoverArtUrl(album.coverArt) }}
                style={styles.albumCover}
              />
            ) : (
              <View
                style={[
                  styles.placeholderCover,
                  { backgroundColor: colors.cardBackground },
                ]}
              >
                <Music size={50} color={colors.textSecondary} />
              </View>
            )}
            <Text style={[styles.albumTitle, { color: colors.text }]}>
              {album.name}
            </Text>
            <TouchableOpacity onPress={navigateToArtist}>
              <Text style={[styles.artistName, { color: colors.primary }]}>
                {album.artist}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.albumInfo, { color: colors.textSecondary }]}>
              {album.year ? `${album.year} • ` : ""}
              {album.songCount} song{album.songCount !== 1 ? "s" : ""}
              {album.duration
                ? ` • ${Math.floor(album.duration / 60)} min`
                : ""}
            </Text>

            <TouchableOpacity
              style={[
                styles.playAllButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={playAllSongs}
            >
              <Play size={16} color={colors.background} />
              <Text style={[styles.playAllText, { color: colors.background }]}>
                Play All
              </Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.songItem, { borderBottomColor: colors.border }]}
            onPress={() => handlePlaySong(item)}
          >
            {item.coverArt ? (
              <Image
                source={{ uri: getCoverArtUrl(item.coverArt) }}
                style={styles.songCover}
              />
            ) : (
              <View
                style={[
                  styles.songPlaceholder,
                  { backgroundColor: colors.cardBackground },
                ]}
              >
                <Music size={20} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.songInfo}>
              <Text style={[styles.songTitle, { color: colors.text }]}>
                {item.title}
              </Text>
              <Text
                style={[styles.songArtist, { color: colors.textSecondary }]}
              >
                {item.artist}
              </Text>
            </View>
            <Text
              style={[styles.songDuration, { color: colors.textSecondary }]}
            >
              {formatDuration(item.duration)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  albumCover: {
    borderRadius: 8,
    height: 200,
    marginBottom: 20,
    width: 200,
  },
  albumHeader: {
    alignItems: "center",
    padding: 20,
  },
  albumInfo: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginBottom: 20,
  },
  albumTitle: {
    fontFamily: "Inter-Bold",
    fontSize: 22,
    marginBottom: 5,
    textAlign: "center",
  },
  artistName: {
    fontFamily: "Inter-SemiBold",
    fontSize: 18,
    marginBottom: 5,
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
  placeholderCover: {
    alignItems: "center",
    borderRadius: 8,
    height: 200,
    justifyContent: "center",
    marginBottom: 20,
    width: 200,
  },
  playAllButton: {
    alignItems: "center",
    borderRadius: 20,
    flexDirection: "row",
    marginBottom: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  playAllText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    marginLeft: 8,
  },
  songArtist: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
  },
  songCover: {
    borderRadius: 4,
    height: 40,
    marginRight: 12,
    width: 40,
  },
  songDuration: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginLeft: 10,
  },
  songInfo: {
    flex: 1,
  },
  songItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  songPlaceholder: {
    alignItems: "center",
    borderRadius: 4,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  songTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginBottom: 4,
  },
});
