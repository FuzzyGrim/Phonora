import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import { Song } from "@/store/types";
import * as FileSystem from "expo-file-system";
import { ChevronLeft, HardDrive, Music2 } from "lucide-react-native";
import { router } from "expo-router";

// Define cache directory
const CACHE_DIRECTORY = FileSystem.cacheDirectory + "phonora_cache/";

// Interface for a grouped song with its associated image
interface CachedSongGroup {
  songId: string;
  title: string;
  artist: string;
  album: string;
  songSize: number;
  songPath: string;
  imageId?: string;
  imageSize?: number;
  imagePath?: string;
}

export default function CachedSongsScreen() {
  const { colors } = useTheme();
  const { songs, clearCache, loadSongMetadata } = useMusicPlayerStore();
  const [isLoading, setIsLoading] = useState(true);
  // const [cachedFiles, setCachedFiles] = useState<CachedFileInfo[]>([]);
  const [cachedSongs, setCachedSongs] = useState<CachedSongGroup[]>([]);
  const [totalCacheSize, setTotalCacheSize] = useState(0);

  // Format file size for display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // Fetch all cached files on mount
  useEffect(() => {
    const fetchCachedFiles = async () => {
      setIsLoading(true);
      try {
        // Check if directory exists
        const dirInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, {
            intermediates: true,
          });
          setCachedSongs([]);
          setTotalCacheSize(0);
          setIsLoading(false);
          return;
        }

        // List all files in the cache directory
        const files = await FileSystem.readDirectoryAsync(CACHE_DIRECTORY);
        let totalSize = 0;
        const fileInfoPromises = files.map(async (filename) => {
          const path = `${CACHE_DIRECTORY}${filename}`;
          const info = await FileSystem.getInfoAsync(path, { size: true });
          const size = info.exists && "size" in info ? info.size : 0;
          totalSize += size;

          // Split filename to get id and extension
          const [id, extension] = filename.split(".");
          const isImage = extension === "jpg";

          // Find associated song for images
          let associatedSong;
          if (isImage) {
            const song = songs.find((s: Song) => s.coverArt === id);
            if (song) {
              associatedSong = {
                title: song.title,
                artist: song.artist,
                album: song.album,
              };
            }
          }

          return {
            id,
            path,
            size,
            extension,
            isImage,
            associatedSong,
          };
        });

        const cachedFileDetails = await Promise.all(fileInfoPromises);
        setTotalCacheSize(totalSize);

        // Load cached song metadata
        const cachedMetadata = await loadSongMetadata();

        // Group audio files with their cover images
        const audioFiles = cachedFileDetails.filter(
          (file) => file.extension === "mp3",
        );
        const imageFiles = cachedFileDetails.filter((file) => file.isImage);

        // Process song groups
        const songGroups: CachedSongGroup[] = [];

        for (const audioFile of audioFiles) {
          // First try to find song in current store
          let song = songs.find((s: Song) => s.id === audioFile.id);

          // If not found in store, try cached metadata
          if (!song && cachedMetadata[audioFile.id]) {
            const metadata = cachedMetadata[audioFile.id];
            song = {
              id: audioFile.id,
              title: metadata.title || "Unknown Song",
              artist: metadata.artist || "Unknown Artist",
              album: metadata.album || "Unknown Album",
              duration: 0, // We don't store duration in metadata
              coverArt: metadata.coverArt,
            };
          }

          if (song) {
            // Find matching image for this song if it exists
            const matchingImage = imageFiles.find(
              (img) => img.id === song.coverArt,
            );

            songGroups.push({
              songId: audioFile.id,
              title: song.title,
              artist: song.artist,
              album: song.album,
              songSize: audioFile.size,
              songPath: audioFile.path,
              imageId: matchingImage?.id,
              imageSize: matchingImage?.size,
              imagePath: matchingImage?.path,
            });
          } else {
            // Handle orphaned audio files (no matching song in store or metadata)
            songGroups.push({
              songId: audioFile.id,
              title: "Unknown Song",
              artist: "Unknown Artist",
              album: "Unknown Album",
              songSize: audioFile.size,
              songPath: audioFile.path,
            });
          }
        }

        setCachedSongs(songGroups);
      } catch (error) {
        console.error("Error fetching cached files:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCachedFiles();
  }, [songs, loadSongMetadata]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Cached Songs</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading cached files...
          </Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <View
            style={[
              styles.summaryContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.summaryStats}>
              <View style={styles.statItem}>
                <View style={styles.statWithIcon}>
                  <HardDrive
                    color={colors.primary}
                    size={20}
                    style={styles.statIcon}
                  />
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {formatFileSize(totalCacheSize)}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Total Size
                    </Text>
                  </View>
                </View>
              </View>
              <View
                style={[styles.statDivider, { backgroundColor: colors.border }]}
              />
              <View style={styles.statItem}>
                <View style={[styles.statWithIcon, styles.statWithIconPadding]}>
                  <Music2
                    color={colors.primary}
                    size={20}
                    style={styles.statIcon}
                  />
                  <View style={styles.statTextContainer}>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {cachedSongs.length}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Songs
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {cachedSongs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No cached songs found
              </Text>
            </View>
          ) : (
            <View style={styles.cachedSongsContainer}>
              <FlatList
                data={cachedSongs}
                keyExtractor={(item) => item.songId}
                contentContainerStyle={styles.listContent}
                style={styles.flatList}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.songCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.songImageContainer}>
                      {item.imagePath ? (
                        <Image
                          source={{ uri: item.imagePath }}
                          style={styles.songImage}
                        />
                      ) : (
                        <View
                          style={[
                            styles.placeholderImage,
                            { backgroundColor: colors.border },
                          ]}
                        />
                      )}
                    </View>
                    <View style={styles.songDetails}>
                      <Text
                        style={[styles.songTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.songArtist,
                          { color: colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {item.artist} • {item.album}
                      </Text>
                      <View style={styles.sizeInfo}>
                        <Text
                          style={[
                            styles.sizeText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          Audio: {formatFileSize(item.songSize)}
                        </Text>
                        {item.imageSize && (
                          <Text
                            style={[
                              styles.sizeText,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Image: {formatFileSize(item.imageSize)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              />

              <TouchableOpacity
                style={[
                  styles.clearCacheButton,
                  { backgroundColor: colors.error },
                ]}
                onPress={() => {
                  Alert.alert(
                    "Clear Cache",
                    "Are you sure you want to clear all cached songs and images?",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Clear",
                        style: "destructive",
                        onPress: async () => {
                          setIsLoading(true);
                          try {
                            await clearCache();
                            setCachedSongs([]);
                            setTotalCacheSize(0);
                          } catch (error) {
                            console.error("Error clearing cache:", error);
                          } finally {
                            setIsLoading(false);
                          }
                        },
                      },
                    ],
                  );
                }}
              >
                <Text
                  style={[styles.clearCacheButtonText, { color: colors.text }]}
                >
                  Clear Cache
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    marginRight: 12,
  },
  cachedSongsContainer: {
    flexShrink: 1,
  },
  clearCacheButton: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    margin: 20,
    marginBottom: 40,
    padding: 15,
  },
  clearCacheButtonText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    display: "flex",
    flex: 1,
    flexDirection: "column",
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
  flatList: {
    flexGrow: 0,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    padding: 20,
    paddingTop: 60,
  },
  listContent: {
    padding: 16,
    paddingBottom: 16,
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
  placeholderImage: {
    borderRadius: 6,
    height: "100%",
    width: "100%",
  },
  sizeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sizeText: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  songArtist: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginBottom: 6,
  },
  songCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 12,
  },
  songDetails: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 12,
  },
  songImage: {
    height: "100%",
    width: "100%",
  },
  songImageContainer: {
    borderRadius: 6,
    height: 60,
    overflow: "hidden",
    width: 60,
  },
  songTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
    marginBottom: 4,
  },
  statDivider: {
    height: 40,
    width: 1,
  },
  statIcon: {
    marginRight: 12,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontFamily: "Inter-Bold",
    fontSize: 18,
  },
  statWithIcon: {
    alignItems: "center",
    flexDirection: "row",
  },
  statWithIconPadding: {
    paddingLeft: 16,
  },
  summaryContainer: {
    borderRadius: 12,
    borderWidth: 1,
    margin: 16,
    overflow: "hidden",
  },
  summaryStats: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 16,
  },
  title: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
  },
});
