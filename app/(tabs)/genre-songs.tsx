import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { ChevronLeft, Play, Music2 } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { useShallow } from "zustand/react/shallow";

// Song interface for this component
interface GenreSong {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    track?: number;
    coverArt?: string;
}

export default function GenreSongsScreen() {
    const { colors } = useTheme();
    const { playSong, playSongFromSource, getCoverArtUrl } = useMusicPlayerStore();
    const { config, generateAuthParams } = useMusicPlayerStore(useShallow((state) => ({
        config: state.config,
        generateAuthParams: state.generateAuthParams,
    })));

    const params = useLocalSearchParams();
    const genreId = params.id as string;
    const genreName = params.name as string;

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [songs, setSongs] = useState<GenreSong[]>([]);

    useEffect(() => {
        // Fetch songs by genre
        const fetchGenreSongs = async () => {
            setIsLoading(true);
            setError(null);
            try {
                if (!config || !config.serverUrl) {
                    setError("Server configuration is missing");
                    setIsLoading(false);
                    return;
                }

                // Generate authentication parameters
                const authParams = generateAuthParams();

                // Make API request to get songs by genre
                const response = await fetch(
                    `${config.serverUrl}/rest/getSongsByGenre.view?genre=${encodeURIComponent(genreName)}&count=500&${authParams.toString()}`
                );
                const data = await response.json();

                if (data["subsonic-response"].status === "ok" && data["subsonic-response"].songsByGenre) {
                    const songsData = data["subsonic-response"].songsByGenre.song || [];

                    // Format and set songs
                    const formattedSongs = songsData.map((song: any) => ({
                        id: song.id,
                        title: song.title,
                        artist: song.artist,
                        album: song.album,
                        duration: song.duration,
                        track: song.track,
                        coverArt: song.coverArt,
                    }));

                    setSongs(formattedSongs);
                } else {
                    throw new Error(
                        data["subsonic-response"].error?.message || "Failed to fetch songs"
                    );
                }
            } catch (error) {
                console.error(`Error fetching songs for genre ${genreName}:`, error);
                setError(error instanceof Error ? error.message : "An error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchGenreSongs();
    }, [config, generateAuthParams, genreId, genreName]);

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handlePlaySong = (song: GenreSong) => {
        const songObject = {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            coverArt: song.coverArt,
        };

        // Convert all genre songs to the Song format for the playlist
        const allSongs = songs.map(s => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            coverArt: s.coverArt,
        }));

        // Play the song with genre as the source
        playSongFromSource(songObject, 'genre', allSongs);
    };

    const playAllSongs = () => {
        if (songs && songs.length > 0) {
            handlePlaySong(songs[0]);
        }
    };

    const renderSongItem = ({ item }: { item: GenreSong }) => (
        <TouchableOpacity
            style={[styles.songItem, { borderBottomColor: colors.border }]}
            onPress={() => handlePlaySong(item)}
        >
            <View style={styles.songItemLeft}>
                {item.coverArt ? (
                    <Image
                        source={{ uri: getCoverArtUrl(item.coverArt) }}
                        style={styles.songImage}
                    />
                ) : (
                    <View style={[styles.placeholderCover, { backgroundColor: colors.border }]}>
                        <Music2 size={20} color={colors.text} />
                    </View>
                )}
                <View style={styles.songDetails}>
                    <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={[styles.songArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.artist}
                    </Text>
                </View>
            </View>
            <Text style={[styles.songDuration, { color: colors.textSecondary }]}>
                {formatDuration(item.duration)}
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
                <View style={styles.headerTextContainer}>
                    <Text style={[styles.title, { color: colors.text }]}>
                        {genreName}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {songs.length} songs
                    </Text>
                </View>
                {songs.length > 0 && (
                    <TouchableOpacity
                        style={[styles.playButton, { backgroundColor: colors.primary }]}
                        onPress={playAllSongs}
                    >
                        <Play size={20} color={colors.background} fill={colors.background} />
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading songs...
                    </Text>
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: colors.error }]}>
                        {error}
                    </Text>
                </View>
            ) : songs.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No songs found for this genre
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={songs}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSongItem}
                    contentContainerStyle={styles.listContainer}
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
    headerTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 28,
        fontFamily: "Inter-Bold",
    },
    subtitle: {
        fontSize: 14,
        fontFamily: "Inter-Regular",
        marginTop: 4,
    },
    playButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: "center",
        alignItems: "center",
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
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    errorText: {
        fontSize: 16,
        fontFamily: "Inter-Medium",
        textAlign: "center",
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
    listContainer: {
        paddingHorizontal: 20,
    },
    songItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    songItemLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    songImage: {
        width: 50,
        height: 50,
        borderRadius: 4,
    },
    placeholderCover: {
        width: 50,
        height: 50,
        borderRadius: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    songDetails: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
    },
    songTitle: {
        fontSize: 16,
        fontFamily: "Inter-SemiBold",
        marginBottom: 4,
    },
    songArtist: {
        fontSize: 14,
        fontFamily: "Inter-Regular",
    },
    songDuration: {
        fontSize: 14,
        fontFamily: "Inter-Regular",
    },
});
