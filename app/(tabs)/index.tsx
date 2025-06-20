import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import { Song } from "@/store/types";
import { Music2, Pause, Play, WifiOff } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
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
    isLoadingMore,
    error,
    fetchSongs,
    fetchMoreSongs,
    clearSongs,
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
      // Clear existing songs and fetch fresh ones
      clearSongs();
      await fetchSongs();
      setRefreshing(false);
    }
  }, [fetchSongs, clearSongs, isOfflineMode]);

  const handleLoadMore = React.useCallback(async () => {
    if (!isOfflineMode && !isLoadingMore && !isLoading) {
      await fetchMoreSongs();
    }
  }, [fetchMoreSongs, isOfflineMode, isLoadingMore, isLoading]);

  const renderSongItem = ({ item: song }: { item: Song }) => (
    <TouchableOpacity key={song.id} style={getSongCardStyle(song)}>
      {song.coverArt && getCoverImageSource(song) ? (
        <Image source={getCoverImageSource(song)!} style={styles.coverArt} />
      ) : (
        <View
          style={[styles.placeholderCover, { backgroundColor: colors.border }]}
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
        <Text style={[styles.duration, { color: colors.textSecondary }]}>
          {formatDuration(song.duration)}
        </Text>
        <TouchableOpacity
          style={[styles.playButton, { backgroundColor: colors.primary }]}
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
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text
          style={[styles.footerLoaderText, { color: colors.textSecondary }]}
        >
          Loading more songs...
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Music2 size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
        {isOfflineMode
          ? "No cached songs available for offline playback"
          : "No songs available"}
      </Text>
      {isOfflineMode && (
        <Text
          style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}
        >
          Connect to the internet to browse and cache music
        </Text>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={[styles.title, { color: colors.text }]}>
          {isOfflineMode ? "Offline Music" : "Your Music"}
        </Text>
        {isOfflineMode && (
          <View style={styles.offlineIndicator}>
            <WifiOff size={16} color={colors.textSecondary} />
            <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
              Offline
            </Text>
          </View>
        )}
      </View>
      {!networkState.isConnected && (
        <View style={[styles.networkBanner, { backgroundColor: colors.error }]}>
          <Text style={[styles.networkBannerText, { color: colors.text }]}>
            No internet connection. Offline mode enabled automatically.
          </Text>
        </View>
      )}
    </View>
  );

  const handlePlayPress = async (song: Song) => {
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

  const getCoverImageSource = (song: Song) => {
    if (!song.coverArt) return null;

    // In offline mode, try to use cached image path
    if (isOfflineMode) {
      // For now, we'll fall back to the URL - in production you might want to
      // track which images are cached and use local paths when available
      return { uri: getCoverArtUrl(song.coverArt) };
    }

    return { uri: getCoverArtUrl(song.coverArt) };
  };

  const getSongCardStyle = (song: Song) => {
    const isCurrentSong = playback.currentSong?.id === song.id;
    return [
      styles.songCard,
      {
        backgroundColor: colors.surface,
        ...(isCurrentSong && {
          borderColor: colors.primary,
          borderWidth: 1,
        }),
      },
    ];
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={availableSongs}
        renderItem={renderSongItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            enabled={!isOfflineMode}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        contentContainerStyle={
          availableSongs.length === 0 ? styles.emptyContainer : styles.content
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  albumName: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  artistName: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginBottom: 2,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  coverArt: {
    borderRadius: 8,
    height: 56,
    width: 56,
  },
  duration: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyStateSubtext: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  errorText: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  footerLoader: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  footerLoaderText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginTop: 8,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerContent: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  networkBanner: {
    borderRadius: 8,
    marginTop: 8,
    padding: 12,
  },
  networkBannerText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
  offlineIndicator: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  offlineText: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  placeholderCover: {
    alignItems: "center",
    borderRadius: 8,
    height: 56,
    justifyContent: "center",
    width: 56,
  },
  playButton: {
    alignItems: "center",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  retryButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
  },
  songActions: {
    alignItems: "flex-end",
  },
  songCard: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: 12,
    padding: 12,
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  songTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginBottom: 4,
  },
  title: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
  },
});
