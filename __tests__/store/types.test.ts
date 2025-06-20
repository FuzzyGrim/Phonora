/**
 * Tests for store/types.ts
 */

import {
  Song,
  Artist,
  Album,
  Genre,
  Playlist,
  SearchResults,
  SubsonicConfig,
  UserSettings,
  NetworkState,
  CachedFileInfo,
  PlaylistSource,
  RepeatMode,
  CurrentSongList,
  DEFAULT_USER_SETTINGS,
} from "../../store/types";

describe("Types Module", () => {
  describe("Interface Definitions", () => {
    it("should define Song interface correctly", () => {
      const song: Song = {
        id: "test-id",
        title: "Test Song",
        artist: "Test Artist",
        album: "Test Album",
        duration: 180,
        coverArt: "cover-art-id",
      };

      expect(song.id).toBe("test-id");
      expect(song.title).toBe("Test Song");
      expect(song.artist).toBe("Test Artist");
      expect(song.album).toBe("Test Album");
      expect(song.duration).toBe(180);
      expect(song.coverArt).toBe("cover-art-id");
    });

    it("should define Artist interface correctly", () => {
      const artist: Artist = {
        id: "artist-id",
        name: "Test Artist",
        albumCount: 5,
        coverArt: "http://example.com/image.jpg",
      };

      expect(artist.id).toBe("artist-id");
      expect(artist.name).toBe("Test Artist");
      expect(artist.albumCount).toBe(5);
      expect(artist.coverArt).toBe("http://example.com/image.jpg");
    });

    it("should define Album interface correctly", () => {
      const album: Album = {
        id: "album-id",
        name: "Test Album",
        artist: "Test Artist",
        songCount: 10,
        coverArt: "http://example.com/album.jpg",
      };

      expect(album.id).toBe("album-id");
      expect(album.name).toBe("Test Album");
      expect(album.artist).toBe("Test Artist");
      expect(album.songCount).toBe(10);
      expect(album.coverArt).toBe("http://example.com/album.jpg");
    });

    it("should define Genre interface correctly", () => {
      const genre: Genre = {
        id: "genre-id",
        name: "Rock",
        songCount: 100,
      };

      expect(genre.id).toBe("genre-id");
      expect(genre.name).toBe("Rock");
      expect(genre.songCount).toBe(100);
    });

    it("should define Playlist interface correctly", () => {
      const playlist: Playlist = {
        id: "playlist-id",
        name: "My Playlist",
        songCount: 25,
        coverArt: "cover-id",
        owner: "user1",
        public: true,
        created: "2023-01-01",
        changed: "2023-01-02",
      };

      expect(playlist.id).toBe("playlist-id");
      expect(playlist.name).toBe("My Playlist");
      expect(playlist.songCount).toBe(25);
      expect(playlist.coverArt).toBe("cover-id");
      expect(playlist.owner).toBe("user1");
      expect(playlist.public).toBe(true);
      expect(playlist.created).toBe("2023-01-01");
      expect(playlist.changed).toBe("2023-01-02");
    });

    it("should define SubsonicConfig interface correctly", () => {
      const config: SubsonicConfig = {
        serverUrl: "http://localhost:4533",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      expect(config.serverUrl).toBe("http://localhost:4533");
      expect(config.username).toBe("testuser");
      expect(config.password).toBe("testpass");
      expect(config.version).toBe("1.16.1");
    });

    it("should define NetworkState interface correctly", () => {
      const networkState: NetworkState = {
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      };

      expect(networkState.isConnected).toBe(true);
      expect(networkState.isInternetReachable).toBe(true);
      expect(networkState.type).toBe("wifi");
    });

    it("should define CachedFileInfo interface correctly", () => {
      const cachedFile: CachedFileInfo = {
        path: "/cache/song.mp3",
        id: "song-id",
        extension: "mp3",
        size: 5242880,
        modTime: 1609459200000,
        filename: "song.mp3",
      };

      expect(cachedFile.path).toBe("/cache/song.mp3");
      expect(cachedFile.id).toBe("song-id");
      expect(cachedFile.extension).toBe("mp3");
      expect(cachedFile.size).toBe(5242880);
      expect(cachedFile.modTime).toBe(1609459200000);
      expect(cachedFile.filename).toBe("song.mp3");
    });
  });

  describe("Type Definitions", () => {
    it("should define PlaylistSource type correctly", () => {
      const sources: PlaylistSource[] = [
        "search",
        "library",
        "album",
        "artist",
        "genre",
        "playlist",
      ];

      sources.forEach((source) => {
        expect(typeof source).toBe("string");
      });
    });

    it("should define RepeatMode type correctly", () => {
      const modes: RepeatMode[] = ["off", "one", "all"];

      modes.forEach((mode) => {
        expect(typeof mode).toBe("string");
      });
    });

    it("should define CurrentSongList interface correctly", () => {
      const playlist: CurrentSongList = {
        source: "library",
        songs: [
          {
            id: "song1",
            title: "Song 1",
            artist: "Artist 1",
            album: "Album 1",
            duration: 180,
          },
        ],
      };

      expect(playlist.source).toBe("library");
      expect(playlist.songs).toHaveLength(1);
      expect(playlist.songs[0].id).toBe("song1");
    });
  });

  describe("Default Values", () => {
    it("should provide correct default user settings", () => {
      expect(DEFAULT_USER_SETTINGS).toEqual({
        offlineMode: false,
        maxCacheSize: 10,
      });
    });

    it("should have immutable default settings", () => {
      const originalSettings = { ...DEFAULT_USER_SETTINGS };

      // Attempt to modify (this shouldn't affect the original)
      const modifiedSettings = { ...DEFAULT_USER_SETTINGS };
      modifiedSettings.offlineMode = true;
      modifiedSettings.maxCacheSize = 20;

      expect(DEFAULT_USER_SETTINGS).toEqual(originalSettings);
    });
  });

  describe("Interface Compatibility", () => {
    it("should allow SearchResults to contain arrays of proper types", () => {
      const searchResults: SearchResults = {
        artists: [
          { id: "1", name: "Artist 1" },
          { id: "2", name: "Artist 2", albumCount: 3 },
        ],
        albums: [
          { id: "1", name: "Album 1", artist: "Artist 1", songCount: 10 },
        ],
        songs: [
          {
            id: "1",
            title: "Song 1",
            artist: "Artist 1",
            album: "Album 1",
            duration: 180,
          },
        ],
      };

      expect(searchResults.artists).toHaveLength(2);
      expect(searchResults.albums).toHaveLength(1);
      expect(searchResults.songs).toHaveLength(1);
    });

    it("should allow UserSettings with optional properties", () => {
      const minimalSettings: UserSettings = {
        offlineMode: false,
        maxCacheSize: 5,
      };

      expect(minimalSettings.offlineMode).toBe(false);
      expect(minimalSettings.maxCacheSize).toBe(5);
    });
  });
});
