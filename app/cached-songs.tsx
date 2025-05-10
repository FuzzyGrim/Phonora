import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    ActivityIndicator,
    TouchableOpacity,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import * as FileSystem from "expo-file-system";
import { ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";

// Define cache directory
const CACHE_DIRECTORY = FileSystem.cacheDirectory + "phonora_cache/";

// Interface for cached file info
interface CachedFileInfo {
    id: string;
    path: string;
    size: number;
    extension: string;
    isImage: boolean;
    associatedSong?: {
        title: string;
        artist: string;
        album: string;
    };
}

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
    const { songs } = useMusicPlayerStore();
    const [isLoading, setIsLoading] = useState(true);
    const [cachedFiles, setCachedFiles] = useState<CachedFileInfo[]>([]);
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
                    await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
                    setCachedFiles([]);
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
                    const size = info.exists && 'size' in info ? info.size : 0;
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
                setCachedFiles(cachedFileDetails);
                setTotalCacheSize(totalSize);

                // Group audio files with their cover images
                const audioFiles = cachedFileDetails.filter((file) => file.extension === "mp3");
                const imageFiles = cachedFileDetails.filter((file) => file.isImage);

                // Process song groups
                const songGroups: CachedSongGroup[] = [];

                for (const audioFile of audioFiles) {
                    const song = songs.find((s) => s.id === audioFile.id);
                    if (song) {
                        // Find matching image for this song if it exists
                        const matchingImage = imageFiles.find((img) => img.id === song.coverArt);

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
                <>
                    <View style={[styles.summaryContainer, { borderColor: colors.border }]}>
                        <Text style={[styles.summaryText, { color: colors.text }]}>
                            Total Cache Size: {formatFileSize(totalCacheSize)}
                        </Text>
                        <Text style={[styles.summaryText, { color: colors.text }]}>
                            Cached Songs: {cachedSongs.length}
                        </Text>
                    </View>

                    {cachedSongs.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No cached songs found
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={cachedSongs}
                            keyExtractor={(item) => item.songId}
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => (
                                <View style={[styles.songCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                    <View style={styles.songImageContainer}>
                                        {item.imagePath ? (
                                            <Image source={{ uri: item.imagePath }} style={styles.songImage} />
                                        ) : (
                                            <View style={[styles.placeholderImage, { backgroundColor: colors.border }]} />
                                        )}
                                    </View>
                                    <View style={styles.songDetails}>
                                        <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
                                            {item.title}
                                        </Text>
                                        <Text style={[styles.songArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                                            {item.artist} • {item.album}
                                        </Text>
                                        <View style={styles.sizeInfo}>
                                            <Text style={[styles.sizeText, { color: colors.textSecondary }]}>
                                                Audio: {formatFileSize(item.songSize)}
                                            </Text>
                                            {item.imageSize && (
                                                <Text style={[styles.sizeText, { color: colors.textSecondary }]}>
                                                    Image: {formatFileSize(item.imageSize)}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </View>
                            )}
                        />
                    )}
                </>
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
    summaryContainer: {
        padding: 15,
        margin: 16,
        borderWidth: 1,
        borderRadius: 8,
    },
    summaryText: {
        fontSize: 16,
        fontFamily: "Inter-Medium",
        marginBottom: 6,
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
