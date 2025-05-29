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
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
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
  const { songs, clearCache } = useMusicPlayerStore();
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
            const song = songs.find((s) => s.coverArt === id);
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

        // Group audio files with their cover images
        const audioFiles = cachedFileDetails.filter(
          (file) => file.extension === "mp3",
        );
        const imageFiles = cachedFileDetails.filter((file) => file.isImage);

        // Process song groups
        const songGroups: CachedSongGroup[] = [];

        for (const audioFile of audioFiles) {
          const song = songs.find((s) => s.id === audioFile.id);
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
            // Handle orphaned audio files (no matching song in state)
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
  }, [songs]);

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
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={[styles.statWithIcon, { paddingLeft: 16 }]}>
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
            <>
              <FlatList
                data={cachedSongs}
                keyExtractor={(item) => item.songId}
                contentContainerStyle={styles.listContent}
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
                <Text style={[styles.clearCacheButtonText, { color: "#fff" }]}>
                  Clear Cache
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
  contentContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  summaryContainer: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: 16,
  },
  statItem: {
    flex: 1,
  },
  statWithIcon: {
    flexDirection: "row",
    alignItems: "center",
  },
  statIcon: {
    marginRight: 12,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontFamily: "Inter-Bold",
  },
  statLabel: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
  statDivider: {
    height: 40,
    width: 1,
    backgroundColor: "rgba(150, 150, 150, 0.3)",
  },
  clearCacheButton: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
    borderRadius: 12,
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
  },
  clearCacheButtonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
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
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  songCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  songImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 6,
    overflow: "hidden",
  },
  songImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
  },
  songDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  songTitle: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginBottom: 6,
  },
  sizeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sizeText: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
  },
});
