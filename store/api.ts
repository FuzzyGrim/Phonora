/**
 * API calls and URL generation functions
 */

import { Song, SearchResults, Album, Artist, Genre, Playlist } from "./types";

/**
 * API slice for the store
 */
export interface ApiSlice {
  // State
  songs: Song[];
  fetchedSongIds: Set<string>;
  searchResults: SearchResults | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSearching: boolean;
  error: string | null;

  // Actions
  fetchSongs: () => Promise<void>;
  fetchMoreSongs: () => Promise<void>;
  clearSongs: () => void;
  fetchAlbums: () => Promise<Album[]>;
  fetchArtists: () => Promise<Artist[]>;
  fetchGenres: () => Promise<Genre[]>;
  fetchPlaylists: () => Promise<Playlist[]>;
  search: (query: string) => Promise<void>;
  getCoverArtUrl: (id: string) => string;
  getStreamUrl: (id: string) => string;
}

/**
 * Create API slice
 */
export const createApiSlice = (set: any, get: any): ApiSlice => ({
  // Initial state
  songs: [],
  fetchedSongIds: new Set<string>(),
  searchResults: null,
  isLoading: false,
  isLoadingMore: false,
  isSearching: false,
  error: null,

  /**
   * Clear all songs and reset the fetched IDs
   */
  clearSongs: () => {
    set({ songs: [], fetchedSongIds: new Set<string>() });
  },

  /**
   * Generate URL for fetching cover art images
   */
  getCoverArtUrl: (id: string) => {
    const { config, generateAuthParams } = get();
    if (!config) return "";
    const params = generateAuthParams();
    return `${config.serverUrl}/rest/getCoverArt.view?id=${id}&${params.toString()}`;
  },

  /**
   * Generate URL for streaming audio files
   */
  getStreamUrl: (id: string) => {
    const { config, generateAuthParams } = get();
    if (!config) return "";
    const params = generateAuthParams();
    return `${config.serverUrl}/rest/stream.view?id=${id}&${params.toString()}`;
  },

  /**
   * Fetch a random selection of songs from the server
   * Used to populate the home screen (initial load)
   */
  fetchSongs: async () => {
    const { config, generateAuthParams } = get();
    if (!config) return;

    set({ isLoading: true, error: null });

    try {
      const params = generateAuthParams();
      const response = await fetch(
        `${config.serverUrl}/rest/getRandomSongs.view?size=100&${params.toString()}`,
      );
      const data = await response.json();

      if (data["subsonic-response"].status === "ok") {
        // Map the server response to our Song interface
        const newSongs = data["subsonic-response"].randomSongs.song.map(
          (song: any) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            coverArt: song.coverArt,
          }),
        );

        // Filter out duplicates and update fetchedSongIds
        const { fetchedSongIds } = get();
        const uniqueSongs = newSongs.filter((song: Song) => !fetchedSongIds.has(song.id));
        const newFetchedSongIds = new Set([...fetchedSongIds, ...uniqueSongs.map((song: Song) => song.id)]);

        set({
          songs: uniqueSongs,
          fetchedSongIds: newFetchedSongIds,
          isLoading: false
        });

        // Update cached songs list after fetching new songs
        get().loadCachedSongs();
      } else {
        throw new Error(
          data["subsonic-response"].error?.message || "Failed to fetch songs",
        );
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch songs",
        isLoading: false,
      });
    }
  },

  /**
   * Fetch more random songs for infinite scrolling
   */
  fetchMoreSongs: async () => {
    const { config, generateAuthParams, isLoadingMore } = get();
    if (!config || isLoadingMore) return;

    set({ isLoadingMore: true, error: null });

    try {
      const params = generateAuthParams();
      const response = await fetch(
        `${config.serverUrl}/rest/getRandomSongs.view?size=50&${params.toString()}`,
      );
      const data = await response.json();

      if (data["subsonic-response"].status === "ok") {
        // Map the server response to our Song interface
        const newSongs = data["subsonic-response"].randomSongs.song.map(
          (song: any) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            coverArt: song.coverArt,
          }),
        );

        // Filter out duplicates and append unique songs
        const { songs, fetchedSongIds } = get();
        const uniqueSongs = newSongs.filter((song: Song) => !fetchedSongIds.has(song.id));
        const newFetchedSongIds = new Set([...fetchedSongIds, ...uniqueSongs.map((song: Song) => song.id)]);

        set({
          songs: [...songs, ...uniqueSongs],
          fetchedSongIds: newFetchedSongIds,
          isLoadingMore: false
        });
      } else {
        throw new Error(
          data["subsonic-response"].error?.message || "Failed to fetch more songs",
        );
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch more songs",
        isLoadingMore: false,
      });
    }
  },

  /**
   * Search for songs, albums, and artists
   */
  search: async (query: string) => {
    const { config, generateAuthParams } = get();
    if (!config || !query.trim()) {
      set({ searchResults: null, isSearching: false });
      return;
    }

    set({ isSearching: true, error: null });

    try {
      const params = generateAuthParams();
      const response = await fetch(
        `${config.serverUrl}/rest/search3.view?query=${encodeURIComponent(query)}&artistCount=20&albumCount=20&songCount=50&${params.toString()}`,
      );
      const data = await response.json();

      if (data["subsonic-response"].status === "ok") {
        const searchData = data["subsonic-response"].searchResult3;

        // Create empty arrays if any part of the response is missing
        const artists = searchData.artist
          ? searchData.artist.map((artist: any) => ({
            id: artist.id,
            name: artist.name,
          }))
          : [];

        const albums = searchData.album
          ? searchData.album.map((album: any) => ({
            id: album.id,
            name: album.name,
            artist: album.artist,
            artistId: album.artistId,
            coverArt: album.coverArt,
            songCount: album.songCount || 0,
          }))
          : [];

        const songs = searchData.song
          ? searchData.song.map((song: any) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            coverArt: song.coverArt,
          }))
          : [];

        set({
          searchResults: { artists, albums, songs },
          isSearching: false,
        });
      } else {
        throw new Error(
          data["subsonic-response"].error?.message || "Search failed",
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      set({
        error: error instanceof Error ? error.message : "Search failed",
        isSearching: false,
      });
    }
  },

  /**
   * Fetch all albums from the server
   */
  fetchAlbums: async () => {
    const { config, generateAuthParams, getCoverArtUrl } = get();
    if (!config) throw new Error("Server configuration is missing");

    const authParams = generateAuthParams();
    const response = await fetch(
      `${config.serverUrl}/rest/getAlbumList2.view?type=alphabeticalByName&size=500&${authParams.toString()}`,
    );

    const data = await response.json();

    if (
      data["subsonic-response"].status === "ok" &&
      data["subsonic-response"].albumList2
    ) {
      const albumsData = data["subsonic-response"].albumList2.album || [];
      return albumsData.map((album: any) => ({
        id: album.id,
        name: album.name,
        artist: album.artist,
        songCount: album.songCount,
        coverArt: album.coverArt ? getCoverArtUrl(album.coverArt) : undefined,
      }));
    } else {
      throw new Error(
        data["subsonic-response"].error?.message || "Failed to fetch albums",
      );
    }
  },

  /**
   * Fetch all artists from the server
   */
  fetchArtists: async () => {
    const { config, generateAuthParams, getCoverArtUrl } = get();
    if (!config) throw new Error("Server configuration is missing");

    const authParams = generateAuthParams();
    const response = await fetch(
      `${config.serverUrl}/rest/getArtists.view?${authParams.toString()}`,
    );

    const data = await response.json();

    if (
      data["subsonic-response"].status === "ok" &&
      data["subsonic-response"].artists
    ) {
      const indexes = data["subsonic-response"].artists.index || [];
      let allArtists: Artist[] = [];

      indexes.forEach((index: any) => {
        if (index.artist && Array.isArray(index.artist)) {
          const artistsInIndex = index.artist.map((artist: any) => ({
            id: artist.id,
            name: artist.name,
            albumCount: artist.albumCount || 0,
            coverArt: artist.coverArt
              ? getCoverArtUrl(artist.coverArt)
              : undefined,
          }));
          allArtists = [...allArtists, ...artistsInIndex];
        }
      });

      return allArtists.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      throw new Error(
        data["subsonic-response"].error?.message || "Failed to fetch artists",
      );
    }
  },

  /**
   * Fetch all genres from the server
   */
  fetchGenres: async () => {
    const { config, generateAuthParams } = get();
    if (!config) throw new Error("Server configuration is missing");

    const authParams = generateAuthParams();
    const response = await fetch(
      `${config.serverUrl}/rest/getGenres.view?${authParams.toString()}`,
    );
    const data = await response.json();

    if (data["subsonic-response"].status === "ok") {
      const genresData = data["subsonic-response"].genres?.genre || [];
      const genresArray = Array.isArray(genresData) ? genresData : [genresData];

      const formattedGenres = genresArray
        .filter((genre: any) => genre && genre.value)
        .map((genre: any) => ({
          id: genre.value,
          name: genre.value,
          songCount: genre.songCount || 0,
        }));

      return formattedGenres.sort((a: Genre, b: Genre) =>
        (a.name || "").localeCompare(b.name || ""),
      );
    } else {
      throw new Error(
        data["subsonic-response"].error?.message || "Failed to fetch genres",
      );
    }
  },

  /**
   * Fetch all playlists from the server
   */
  fetchPlaylists: async () => {
    const { config, generateAuthParams } = get();
    if (!config) throw new Error("Server configuration is missing");

    const authParams = generateAuthParams();
    const response = await fetch(
      `${config.serverUrl}/rest/getPlaylists.view?${authParams.toString()}`,
    );
    const data = await response.json();

    if (data["subsonic-response"].status === "ok") {
      const playlistList = data["subsonic-response"].playlists?.playlist || [];
      return playlistList.map((playlist: any) => ({
        id: playlist.id,
        name: playlist.name,
        songCount: playlist.songCount || 0,
        coverArt: playlist.coverArt,
        owner: playlist.owner,
        public: playlist.public,
        created: playlist.created,
        changed: playlist.changed,
      }));
    } else {
      throw new Error(
        data["subsonic-response"].error?.message || "Failed to fetch playlists",
      );
    }
  },
});
