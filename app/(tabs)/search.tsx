import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import {
  Search as SearchIcon,
  Music,
  User,
  Disc,
  Play,
  Pause,
} from "lucide-react-native";
import { router } from "expo-router";
import { Song, Artist, Album } from "@/store/types";

// Type for items in our FlatList
type SearchItem =
  | { type: "header"; title: string }
  | { type: "artist"; data: Artist }
  | { type: "album"; data: Album }
  | { type: "song"; data: Song };

export default function SearchScreen() {
  const { colors } = useTheme();
  const {
    search,
    searchResults,
    isSearching,
    getCoverArtUrl,
    playSongFromSource,
    playback,
    pauseSong,
    resumeSong,
  } = useMusicPlayerStore();
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle search when query changes
  useEffect(() => {
    // Clear previous timeout to debounce input
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Don't search if query is empty
    if (!searchQuery.trim()) {
      search("");
      return;
    }

    // Debounce search to avoid too many API requests
    const timeout = setTimeout(() => {
      search(searchQuery);
    }, 500);

    searchTimeoutRef.current = timeout;

    // Cleanup function
    return () => {
      clearTimeout(timeout);
    };
  }, [searchQuery, search]);

  const handlePlaySong = (song: Song) => {
    // If the song is already playing, pause it
    if (
      playback.currentSong &&
      playback.currentSong.id === song.id &&
      playback.isPlaying
    ) {
      pauseSong();
    }
    // If the song is paused, resume it
    else if (
      playback.currentSong &&
      playback.currentSong.id === song.id &&
      !playback.isPlaying
    ) {
      resumeSong();
    }
    // Otherwise play the new song
    else {
      // Get all songs from search results
      const searchSongs = searchResults?.songs || [];
      if (searchSongs.length > 0) {
        playSongFromSource(song, searchSongs);
      } else {
        // If no search songs, use global songs as fallback
        const { songs } = useMusicPlayerStore.getState();
        playSongFromSource(song, songs);
      }
    }
  };

  const navigateToAlbum = (albumId: string) => {
    router.push({
      pathname: "/(tabs)/album-details",
      params: { id: albumId, source: "search" },
    });
  };

  const navigateToArtist = (artistId: string) => {
    router.push({
      pathname: "/(tabs)/artist-details",
      params: { id: artistId, source: "search" },
    });
  };

  // Prepare data for FlatList
  const getSearchItems = (): SearchItem[] => {
    if (!searchResults) return [];

    const items: SearchItem[] = [];

    // Add artists section if there are any
    if (searchResults.artists.length > 0) {
      items.push({ type: "header", title: "Artists" });
      searchResults.artists.forEach((artist: Artist) =>
        items.push({ type: "artist", data: artist }),
      );
    }

    // Add albums section if there are any
    if (searchResults.albums.length > 0) {
      items.push({ type: "header", title: "Albums" });
      searchResults.albums.forEach((album: Album) =>
        items.push({ type: "album", data: album }),
      );
    }

    // Add songs section if there are any
    if (searchResults.songs.length > 0) {
      items.push({ type: "header", title: "Songs" });
      searchResults.songs.forEach((song: Song) =>
        items.push({ type: "song", data: song }),
      );
    }

    return items;
  };

  const renderSearchItem = ({ item }: { item: SearchItem }) => {
    if (item.type === "header") {
      return (
        <Text style={[styles.sectionHeader, { color: colors.text }]}>
          {item.title}
        </Text>
      );
    } else if (item.type === "artist") {
      return (
        <TouchableOpacity
          style={[styles.itemContainer, { borderBottomColor: colors.border }]}
          onPress={() => navigateToArtist(item.data.id)}
        >
          <View style={styles.iconContainer}>
            <User size={24} color={colors.textSecondary} />
          </View>
          <View style={styles.itemDetails}>
            <Text
              style={[styles.itemTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.data.name}
            </Text>
            <Text
              style={[styles.itemSubtitle, { color: colors.textSecondary }]}
            >
              Artist
            </Text>
          </View>
        </TouchableOpacity>
      );
    } else if (item.type === "album") {
      return (
        <TouchableOpacity
          style={[styles.itemContainer, { borderBottomColor: colors.border }]}
          onPress={() => navigateToAlbum(item.data.id)}
        >
          {item.data.coverArt ? (
            <Image
              source={{ uri: getCoverArtUrl(item.data.coverArt) }}
              style={styles.albumCover}
            />
          ) : (
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surface },
              ]}
            >
              <Disc size={24} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.itemDetails}>
            <Text
              style={[styles.itemTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.data.name}
            </Text>
            <Text
              style={[styles.itemSubtitle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.data.artist} • {item.data.songCount} songs
            </Text>
          </View>
        </TouchableOpacity>
      );
    } else if (item.type === "song") {
      return (
        <TouchableOpacity
          style={[styles.itemContainer, { borderBottomColor: colors.border }]}
          onPress={() => handlePlaySong(item.data)}
        >
          {item.data.coverArt ? (
            <Image
              source={{ uri: getCoverArtUrl(item.data.coverArt) }}
              style={styles.albumCover}
            />
          ) : (
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.surface },
              ]}
            >
              <Music size={24} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.itemDetails}>
            <Text
              style={[styles.itemTitle, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.data.title}
            </Text>
            <Text
              style={[styles.itemSubtitle, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.data.artist} • {item.data.album}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => handlePlaySong(item.data)}
          >
            {playback.currentSong &&
            playback.currentSong.id === item.data.id &&
            playback.isPlaying ? (
              <Pause size={18} color={colors.text} />
            ) : (
              <Play size={18} color={colors.text} />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
          <SearchIcon size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search songs, albums, or artists"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {isSearching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Searching...
          </Text>
        </View>
      ) : !searchQuery.trim() ? (
        <View style={styles.content}>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            Start typing to search
          </Text>
        </View>
      ) : searchResults ? (
        <FlatList
          data={getSearchItems()}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          renderItem={renderSearchItem}
          ListEmptyComponent={
            <View style={styles.content}>
              <Text style={[styles.text, { color: colors.textSecondary }]}>
                No results found
              </Text>
            </View>
          }
          contentContainerStyle={
            getSearchItems().length === 0 ? styles.emptyList : styles.list
          }
        />
      ) : (
        <View style={styles.content}>
          <Text style={[styles.text, { color: colors.textSecondary }]}>
            No results found
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  albumCover: {
    borderRadius: 4,
    height: 50,
    width: 50,
  },
  container: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  emptyList: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  iconContainer: {
    alignItems: "center",
    borderRadius: 4,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  itemContainer: {
    alignItems: "center",
    borderBottomWidth: 0.5,
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  itemDetails: {
    flex: 1,
    marginLeft: 15,
  },
  itemSubtitle: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
  },
  itemTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginBottom: 4,
  },
  list: {
    paddingBottom: 80, // Extra space for mini player
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  playButton: {
    padding: 10,
  },
  searchBar: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    padding: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter-Regular",
    fontSize: 16,
    marginLeft: 10,
  },
  sectionHeader: {
    fontFamily: "Inter-Bold",
    fontSize: 18,
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  text: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
  },
});
