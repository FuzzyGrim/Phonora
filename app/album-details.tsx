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
    const { config, generateAuthParams, getCoverArtUrl, playSong, playSongFromSource } = useMusicPlayerStore();
    const params = useLocalSearchParams();
    const albumId = params.id as string;

    const [album, setAlbum] = useState<AlbumDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAlbumDetails = async () => {
            if (!config || !albumId) {
                setError("No album ID provided or not connected to server");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const authParams = generateAuthParams();
                const response = await fetch(
                    `${config.serverUrl}/rest/getAlbum.view?id=${albumId}&${authParams.toString()}`
                );

                const data = await response.json();

                if (data["subsonic-response"].status === "ok") {
                    const albumData = data["subsonic-response"].album;

                    const formattedSongs = albumData.song.map((song: any) => ({
                        id: song.id,
                        title: song.title,
                        artist: song.artist,
                        duration: song.duration,
                        track: song.track,
                        coverArt: song.coverArt,
                    }));

                    setAlbum({
                        id: albumData.id,
                        name: albumData.name,
                        artist: albumData.artist,
                        artistId: albumData.artistId,
                        coverArt: albumData.coverArt,
                        year: albumData.year,
                        genre: albumData.genre,
                        songCount: albumData.songCount,
                        duration: albumData.duration,
                        songs: formattedSongs,
                    });
                } else {
                    throw new Error(
                        data["subsonic-response"].error?.message || "Failed to fetch album details"
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
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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
        const allSongs = album?.songs.map(s => ({
            id: s.id,
            title: s.title,
            artist: s.artist,
            album: album?.name || "",
            duration: s.duration,
            coverArt: s.coverArt,
        })) || [];

        // Play the song with album as the source
        playSongFromSource(songObject, 'album', allSongs);
    };

    const navigateToArtist = () => {
        if (album?.artistId) {
            router.push({
                pathname: "/artist-details",
                params: { id: album.artistId }
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
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <ChevronLeft color={colors.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Album</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading album details...
                    </Text>
                </View>
            </View>
        );
    }

    if (error || !album) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <ChevronLeft color={colors.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Album</Text>
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
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
                            <View style={[styles.placeholderCover, { backgroundColor: colors.surface }]}>
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
                            {album.year ? `${album.year} • ` : ''}
                            {album.songCount} songs • {album.duration ? formatDuration(album.duration) : ''}
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
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        style={[styles.songItem, { borderBottomColor: colors.border }]}
                        onPress={() => handlePlaySong(item)}
                    >
                        <Text style={[styles.trackNumber, { color: colors.textSecondary }]}>
                            {item.track || index + 1}
                        </Text>
                        <View style={styles.songDetails}>
                            <Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
                                {item.title}
                            </Text>
                            <Text style={[styles.songDuration, { color: colors.textSecondary }]}>
                                {formatDuration(item.duration)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.playSongButton}
                            onPress={() => handlePlaySong(item)}
                        >
                            <Play size={16} color={colors.text} />
                        </TouchableOpacity>
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
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 10,
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
    albumHeader: {
        alignItems: "center",
        padding: 20,
    },
    albumCover: {
        width: 200,
        height: 200,
        borderRadius: 10,
        marginBottom: 20,
    },
    placeholderCover: {
        width: 200,
        height: 200,
        borderRadius: 10,
        marginBottom: 20,
        justifyContent: "center",
        alignItems: "center",
    },
    albumTitle: {
        fontSize: 24,
        fontFamily: "Inter-Bold",
        textAlign: "center",
        marginBottom: 8,
    },
    artistName: {
        fontSize: 18,
        fontFamily: "Inter-SemiBold",
        marginBottom: 8,
    },
    albumInfo: {
        fontSize: 14,
        fontFamily: "Inter-Regular",
        marginBottom: 20,
    },
    playAllButton: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        marginBottom: 20,
    },
    playAllText: {
        marginLeft: 8,
        fontSize: 16,
        fontFamily: "Inter-SemiBold",
    },
    songItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderBottomWidth: 0.5,
    },
    trackNumber: {
        width: 30,
        fontSize: 14,
        fontFamily: "Inter-Regular",
        textAlign: "center",
    },
    songDetails: {
        flex: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        marginLeft: 10,
    },
    songTitle: {
        flex: 1,
        fontSize: 16,
        fontFamily: "Inter-Medium",
    },
    songDuration: {
        fontSize: 14,
        fontFamily: "Inter-Regular",
        marginLeft: 10,
    },
    playSongButton: {
        padding: 10,
        marginLeft: 10,
    },
});
