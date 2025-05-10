import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    ActivityIndicator,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { ChevronLeft, User, Disc } from "lucide-react-native";
import { useLocalSearchParams, router } from "expo-router";

// Album interface for artist's album listing
interface ArtistAlbum {
    id: string;
    name: string;
    coverArt?: string;
    songCount: number;
    year?: number;
}

// Artist interface for this component
interface ArtistDetails {
    id: string;
    name: string;
    albumCount?: number;
    albums: ArtistAlbum[];
}

export default function ArtistDetailsScreen() {
    const { colors } = useTheme();
    const { config, generateAuthParams, getCoverArtUrl } = useMusicPlayerStore();
    const params = useLocalSearchParams();
    const artistId = params.id as string;

    const [artist, setArtist] = useState<ArtistDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchArtistDetails = async () => {
            if (!config || !artistId) {
                setError("No artist ID provided or not connected to server");
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const authParams = generateAuthParams();

                // First get the artist info
                const artistResponse = await fetch(
                    `${config.serverUrl}/rest/getArtist.view?id=${artistId}&${authParams.toString()}`
                );

                const artistData = await artistResponse.json();

                if (artistData["subsonic-response"].status === "ok") {
                    const artist = artistData["subsonic-response"].artist;

                    // Format the albums
                    const formattedAlbums = artist.album ? artist.album.map((album: any) => ({
                        id: album.id,
                        name: album.name,
                        coverArt: album.coverArt,
                        songCount: album.songCount || 0,
                        year: album.year,
                    })) : [];

                    // Sort albums by year (most recent first)
                    formattedAlbums.sort((a: ArtistAlbum, b: ArtistAlbum) => {
                        if (!a.year && !b.year) return 0;
                        if (!a.year) return 1;
                        if (!b.year) return -1;
                        return b.year - a.year;
                    });

                    setArtist({
                        id: artist.id,
                        name: artist.name,
                        albumCount: artist.albumCount,
                        albums: formattedAlbums,
                    });
                } else {
                    throw new Error(
                        artistData["subsonic-response"].error?.message || "Failed to fetch artist details"
                    );
                }
            } catch (error) {
                console.error("Error fetching artist details:", error);
                setError(error instanceof Error ? error.message : "An error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchArtistDetails();
    }, [artistId, config, generateAuthParams]);

    const navigateToAlbum = (albumId: string) => {
        router.push({
            pathname: "/album-details",
            params: { id: albumId }
        });
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <ChevronLeft color={colors.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Artist</Text>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading artist details...
                    </Text>
                </View>
            </View>
        );
    }

    if (error || !artist) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                        <ChevronLeft color={colors.text} size={24} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>Artist</Text>
                </View>
                <View style={styles.errorContainer}>
                    <Text style={[styles.errorText, { color: colors.error }]}>
                        {error || "Failed to load artist details"}
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
                <Text style={[styles.headerTitle, { color: colors.text }]}>Artist</Text>
            </View>

            <FlatList
                data={artist.albums}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={styles.albumGrid}
                ListHeaderComponent={
                    <View style={styles.artistHeader}>
                        <View style={[styles.artistIconContainer, { backgroundColor: colors.surface }]}>
                            <User size={50} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.artistName, { color: colors.text }]}>
                            {artist.name}
                        </Text>
                        <Text style={[styles.albumCount, { color: colors.textSecondary }]}>
                            {artist.albumCount || artist.albums.length} Albums
                        </Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.albumItem}
                        onPress={() => navigateToAlbum(item.id)}
                    >
                        {item.coverArt ? (
                            <Image
                                source={{ uri: getCoverArtUrl(item.coverArt) }}
                                style={styles.albumCover}
                            />
                        ) : (
                            <View style={[styles.placeholderCover, { backgroundColor: colors.surface }]}>
                                <Disc size={30} color={colors.textSecondary} />
                            </View>
                        )}
                        <Text
                            style={[styles.albumTitle, { color: colors.text }]}
                            numberOfLines={1}
                        >
                            {item.name}
                        </Text>
                        <Text style={[styles.albumYear, { color: colors.textSecondary }]}>
                            {item.year || "Unknown"} • {item.songCount} songs
                        </Text>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                            No albums found for this artist
                        </Text>
                    </View>
                }
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
    artistHeader: {
        alignItems: "center",
        padding: 20,
        marginBottom: 10,
    },
    artistIconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 15,
    },
    artistName: {
        fontSize: 24,
        fontFamily: "Inter-Bold",
        textAlign: "center",
        marginBottom: 6,
    },
    albumCount: {
        fontSize: 16,
        fontFamily: "Inter-Regular",
    },
    albumGrid: {
        justifyContent: "space-between",
        paddingHorizontal: 16,
    },
    albumItem: {
        width: '48%',
        marginBottom: 24,
    },
    albumCover: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 6,
        marginBottom: 8,
    },
    placeholderCover: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 6,
        marginBottom: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    albumTitle: {
        fontSize: 14,
        fontFamily: "Inter-SemiBold",
        marginBottom: 4,
    },
    albumYear: {
        fontSize: 12,
        fontFamily: "Inter-Regular",
    },
    emptyContainer: {
        padding: 20,
        alignItems: "center",
    },
    emptyText: {
        fontSize: 16,
        fontFamily: "Inter-Medium",
    },
});
