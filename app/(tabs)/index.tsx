import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { Music2, Pause, Play, WifiOff } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const {
    isLoading,
    error,
    fetchSongs,
    getCoverArtUrl,
    pauseSong,
    resumeSong,
    playback,
    playSongFromSource,
    isOfflineMode,
    networkState,
    getAvailableSongs,
  } = useMusicPlayerStore();
  const [refreshing, setRefreshing] = React.useState(false);

  // Get available songs based on current mode (online/offline)
  const availableSongs = getAvailableSongs();

  const onRefresh = React.useCallback(async () => {
    if (!isOfflineMode) {
      setRefreshing(true);
      await fetchSongs();
      setRefreshing(false);
    }
  }, [fetchSongs, isOfflineMode]);

  const handlePlayPress = async (song: any) => {
    if (playback.currentSong?.id === song.id) {
      if (playback.isPlaying) {
        await pauseSong();
      } else {
        await resumeSong();
      }
    } else {
      // Use playSongFromSource instead to set up the playlist properly
      await playSongFromSource(song, "library", availableSongs);
    }
  };

  const getCoverImageSource = (song: any) => {
    if (!song.coverArt) return null;

    // In offline mode, try to use cached image path
    if (isOfflineMode) {
      // For now, we'll fall back to the URL - in production you might want to
      // track which images are cached and use local paths when available
      return { uri: getCoverArtUrl(song.coverArt) };
    }

    return { uri: getCoverArtUrl(song.coverArt) };
  };

  if (isLoading && !refreshing) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[
          styles.container,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={fetchSongs}
        >
          <Text style={[styles.retryButtonText, { color: colors.text }]}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          enabled={!isOfflineMode}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isOfflineMode ? "Offline Music" : "Your Music"}
          </Text>
          {isOfflineMode && (
            <View style={styles.offlineIndicator}>
              <WifiOff size={16} color={colors.textSecondary} />
              <Text
                style={[styles.offlineText, { color: colors.textSecondary }]}
              >
                Offline
              </Text>
            </View>
          )}
        </View>
        {!networkState.isConnected && (
          <View
            style={[styles.networkBanner, { backgroundColor: colors.error }]}
          >
            <Text style={[styles.networkBannerText, { color: colors.text }]}>
              No internet connection. Offline mode enabled automatically.
            </Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        {availableSongs.length === 0 ? (
          <View style={styles.emptyState}>
            <Music2 size={48} color={colors.textSecondary} />
            <Text
              style={[styles.emptyStateText, { color: colors.textSecondary }]}
            >
              {isOfflineMode
                ? "No cached songs available for offline playback"
                : "No songs available"}
            </Text>
            {isOfflineMode && (
              <Text
                style={[
                  styles.emptyStateSubtext,
                  { color: colors.textSecondary },
                ]}
              >
                Connect to the internet to browse and cache music
              </Text>
            )}
          </View>
        ) : (
          availableSongs.map((song) => (
            <TouchableOpacity
              key={song.id}
              style={[
                styles.songCard,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    playback.currentSong?.id === song.id
                      ? colors.primary
                      : "transparent",
                  borderWidth: playback.currentSong?.id === song.id ? 1 : 0,
                },
              ]}
            >
              {song.coverArt && getCoverImageSource(song) ? (
                <Image
                  source={getCoverImageSource(song)!}
                  style={styles.coverArt}
                />
              ) : (
                <View
                  style={[
                    styles.placeholderCover,
                    { backgroundColor: colors.border },
                  ]}
                >
                  <Music2 size={24} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.songInfo}>
                <Text
                  style={[styles.songTitle, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {song.title}
                </Text>
                <Text
                  style={[styles.artistName, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {song.artist}
                </Text>
                <Text
                  style={[styles.albumName, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {song.album}
                </Text>
              </View>
              <View style={styles.songActions}>
                <Text
                  style={[styles.duration, { color: colors.textSecondary }]}
                >
                  {formatDuration(song.duration)}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.playButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => handlePlayPress(song)}
                >
                  {(() => {
                    const isCurrentSong = playback.currentSong?.id === song.id;
                    return isCurrentSong && playback.isPlaying ? (
                      <Pause size={16} color={colors.text} />
                    ) : (
                      <Play size={16} color={colors.text} />
                    );
                  })()}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter-Bold",
  },
  offlineIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  offlineText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
  },
  networkBanner: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  networkBannerText: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
    textAlign: "center",
  },
  content: {
    padding: 20,
  },
  songCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  coverArt: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  placeholderCover: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  songTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    marginBottom: 4,
  },
  artistName: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginBottom: 2,
  },
  albumName: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
  },
  songActions: {
    alignItems: "flex-end",
  },
  duration: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
    marginBottom: 8,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
    marginTop: 16,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginTop: 8,
    textAlign: "center",
  },
});
