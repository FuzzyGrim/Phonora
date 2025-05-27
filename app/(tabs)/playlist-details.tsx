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
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { ChevronLeft, Play, Music } from "lucide-react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useShallow } from 'zustand/react/shallow';

// Song interface for this component
interface PlaylistSong {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    track?: number;
    coverArt?: string;
}

// Playlist interface for this component
interface PlaylistDetails {
    id: string;
    name: string;
    songCount: number;
    duration?: number;
    owner?: string;
    public?: boolean;
    created?: string;
    changed?: string;
    coverArt?: string;
    songs: PlaylistSong[];
}

export default function PlaylistDetailsScreen() {
    const { colors } = useTheme();
    const { playSong, playSongFromSource, getCoverArtUrl } = useMusicPlayerStore();

    // Access config and auth functions from the store
    const { config, generateAuthParams } = useMusicPlayerStore(useShallow((state) => ({
        config: state.config,
        generateAuthParams: state.generateAuthParams,
    })));

    const params = useLocalSearchParams();
    const playlistId = params.id as string;

    const handleBackNavigation = () => {
        router.back();
    };

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);

    useEffect(() => {
        const fetchPlaylistDetails = async () => {
            if (!config || !config.serverUrl) {
                setError("Server configuration is missing");
                setIsLoading(false);
                return;
            }

            try {
                const authParams = generateAuthParams();

                const response = await fetch(
                    `${config.serverUrl}/rest/getPlaylist.view?id=${playlistId}&${authParams.toString()}`
                );

                const playlistData = await response.json();

                if (
                    playlistData["subsonic-response"].status === "ok" &&
                    playlistData["subsonic-response"].playlist
                ) {
                    const playlistInfo = playlistData["subsonic-response"].playlist;
                    const formattedSongs: PlaylistSong[] = playlistInfo.entry
                        ? playlistInfo.entry.map((song: any) => ({
                            id: song.id,
                            title: song.title,
                            artist: song.artist,
                            album: song.album,
                            duration: song.duration,
                            track: song.track,
                            coverArt: song.coverArt,
                        }))
                        : [];

                    // Calculate total duration if not provided
                    const totalDuration = formattedSongs.reduce((total, song) => total + (song.duration || 0), 0);

                    setPlaylist({
                        id: playlistInfo.id,
                        name: playlistInfo.name,
                        songCount: playlistInfo.songCount || formattedSongs.length,
                        owner: playlistInfo.owner,
                        public: playlistInfo.public,
                        created: playlistInfo.created,
                        changed: playlistInfo.changed,
                        coverArt: playlistInfo.coverArt,
                        duration: playlistInfo.duration || totalDuration,
                        songs: formattedSongs,
                    });
                } else {
                    throw new Error(
                        playlistData["subsonic-response"].error?.message || "Failed to fetch playlist details"
                    );
                }
            } catch (error) {
                console.error("Error fetching playlist details:", error);
                setError(error instanceof Error ? error.message : "An error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlaylistDetails();
    }, [playlistId, config, generateAuthParams]);

    const formatDuration = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handlePlaySong = (song: PlaylistSong) => {
        const songObject = {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            coverArt: song.coverArt,
        };

        // Convert all playlist songs to the Song format for the playlist
        const allSongs = playlist?.songs.map(s => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: s.album,
            duration: s.duration,
            coverArt: s.coverArt,
        })) || [];

        // Play the song with playlist as the source
        playSongFromSource(songObject, 'playlist', allSongs);
    };

    const playAllSongs = () => {
        if (playlist?.songs && playlist.songs.length > 0) {
            handlePlaySong(playlist.songs[0]);
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
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Playlist</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </View>
        );
    }

    if (error || !playlist) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBackNavigation}
                    >
                        <ChevronLeft color={colors.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Playlist</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: colors.error }]}>
                        {error || "Failed to load playlist details"}
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
                <Text style={[styles.headerTitle, { color: colors.text }]}>Playlist</Text>
            </View>

            <FlatList
                data={playlist.songs}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <View style={styles.playlistHeader}>
                        {playlist.coverArt ? (
                            <Image
                                source={{ uri: getCoverArtUrl(playlist.coverArt) }}
                                style={styles.playlistCover}
                            />
                        ) : (
                            <View style={[styles.placeholderCover, { backgroundColor: colors.cardBackground }]}>
                                <Music size={50} color={colors.textSecondary} />
                            </View>
                        )}
                        <Text style={[styles.playlistTitle, { color: colors.text }]}>
                            {playlist.name}
                        </Text>
                        {playlist.owner && (
                            <Text style={[styles.ownerName, { color: colors.textSecondary }]}>
                                by {playlist.owner}
                            </Text>
                        )}
                        <Text style={[styles.playlistInfo, { color: colors.textSecondary }]}>
                            {playlist.songCount} song{playlist.songCount !== 1 ? "s" : ""}
                            {playlist.duration ? ` • ${Math.floor(playlist.duration / 60)} min` : ""}
                        </Text>

                        <TouchableOpacity
                            style={[styles.playAllButton, { backgroundColor: colors.primary }]}
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
                        <View style={styles.songInfo}>
                            <Text style={[styles.songTitle, { color: colors.text }]}>
                                {item.title}
                            </Text>
                            <Text style={[styles.songArtist, { color: colors.textSecondary }]}>
                                {item.artist}
                            </Text>
                        </View>
                        <Text style={[styles.songDuration, { color: colors.textSecondary }]}>
                            {formatDuration(item.duration)}
                        </Text>
                    </TouchableOpacity>
                )}
            />
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
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 15,
    },
    backButton: {
        marginRight: 10,
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: "Inter-SemiBold",
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
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
    playlistHeader: {
        alignItems: "center",
        padding: 20,
    },
    playlistCover: {
        width: 200,
        height: 200,
        borderRadius: 8,
        marginBottom: 20,
    },
    placeholderCover: {
        width: 200,
        height: 200,
        borderRadius: 8,
        marginBottom: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    playlistTitle: {
        fontSize: 22,
        fontFamily: "Inter-Bold",
        textAlign: "center",
        marginBottom: 5,
    },
    ownerName: {
        fontSize: 16,
        fontFamily: "Inter-SemiBold",
        marginBottom: 5,
    },
    playlistInfo: {
        fontSize: 14,
        fontFamily: "Inter-Regular",
        marginBottom: 20,
    },
    playAllButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        marginBottom: 20,
    },
    playAllText: {
        marginLeft: 8,
        fontSize: 14,
        fontFamily: "Inter-SemiBold",
    },
    songItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
    },
    songInfo: {
        flex: 1,
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
        marginLeft: 10,
    },
});
