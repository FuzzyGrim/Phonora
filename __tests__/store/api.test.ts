/**
 * Tests for store/api.ts
 */

import { createApiSlice } from "../../store/api";

// Mock fetch globally
global.fetch = jest.fn();

describe("API Slice", () => {
  let apiSlice: any;
  let mockSet: jest.Mock;
  let mockGet: jest.Mock;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockConfig = {
    serverUrl: "http://localhost:4533",
    username: "testuser",
    password: "testpass",
    version: "1.16.1",
  };

  const mockGenerateAuthParams = jest.fn(
    () =>
      new URLSearchParams({
        u: "testuser",
        t: "token123",
        s: "salt123",
        v: "1.16.1",
        c: "subsonicapp",
        f: "json",
      }),
  );

  beforeEach(() => {
    mockSet = jest.fn();
    mockGet = jest.fn();
    mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
    apiSlice = createApiSlice(mockSet, mockGet);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockGet.mockReturnValue({
      config: mockConfig,
      generateAuthParams: mockGenerateAuthParams,
      loadCachedSongs: jest.fn(),
    });
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      expect(apiSlice.songs).toEqual([]);
      expect(apiSlice.searchResults).toBeNull();
      expect(apiSlice.isLoading).toBe(false);
      expect(apiSlice.isSearching).toBe(false);
      expect(apiSlice.error).toBeNull();
    });
  });

  describe("getCoverArtUrl", () => {
    it("should generate correct cover art URL", () => {
      const url = apiSlice.getCoverArtUrl("cover123");

      expect(url).toBe(
        "http://localhost:4533/rest/getCoverArt.view?id=cover123&u=testuser&t=token123&s=salt123&v=1.16.1&c=subsonicapp&f=json",
      );
      expect(mockGenerateAuthParams).toHaveBeenCalled();
    });

    it("should return empty string when no config", () => {
      mockGet.mockReturnValue({ config: null });

      const url = apiSlice.getCoverArtUrl("cover123");

      expect(url).toBe("");
    });
  });

  describe("getStreamUrl", () => {
    it("should generate correct stream URL", () => {
      const url = apiSlice.getStreamUrl("song123");

      expect(url).toBe(
        "http://localhost:4533/rest/stream.view?id=song123&u=testuser&t=token123&s=salt123&v=1.16.1&c=subsonicapp&f=json",
      );
      expect(mockGenerateAuthParams).toHaveBeenCalled();
    });

    it("should return empty string when no config", () => {
      mockGet.mockReturnValue({ config: null });

      const url = apiSlice.getStreamUrl("song123");

      expect(url).toBe("");
    });
  });

  describe("fetchSongs", () => {
    const mockSongsResponse = {
      "subsonic-response": {
        status: "ok",
        randomSongs: {
          song: [
            {
              id: "song1",
              title: "Test Song 1",
              artist: "Test Artist",
              album: "Test Album",
              duration: 180,
              coverArt: "cover1",
            },
            {
              id: "song2",
              title: "Test Song 2",
              artist: "Test Artist",
              album: "Test Album",
              duration: 200,
              coverArt: "cover2",
            },
          ],
        },
      },
    };

    it("should fetch songs successfully", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockSongsResponse),
      } as Response);

      await apiSlice.fetchSongs();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4533/rest/getRandomSongs.view?size=100&u=testuser&t=token123&s=salt123&v=1.16.1&c=subsonicapp&f=json",
      );
      expect(mockSet).toHaveBeenCalledWith({ isLoading: true, error: null });
      expect(mockSet).toHaveBeenCalledWith({
        songs: [
          {
            id: "song1",
            title: "Test Song 1",
            artist: "Test Artist",
            album: "Test Album",
            duration: 180,
            coverArt: "cover1",
          },
          {
            id: "song2",
            title: "Test Song 2",
            artist: "Test Artist",
            album: "Test Album",
            duration: 200,
            coverArt: "cover2",
          },
        ],
        isLoading: false,
      });
    });

    it("should not fetch when no config", async () => {
      mockGet.mockReturnValue({ config: null });

      await apiSlice.fetchSongs();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const errorResponse = {
        "subsonic-response": {
          status: "failed",
          error: { message: "Authentication failed" },
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(errorResponse),
      } as Response);

      await apiSlice.fetchSongs();

      expect(mockSet).toHaveBeenCalledWith({
        error: "Authentication failed",
        isLoading: false,
      });
    });

    it("should handle fetch errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await apiSlice.fetchSongs();

      expect(mockSet).toHaveBeenCalledWith({
        error: "Network error",
        isLoading: false,
      });
    });

    it("should call loadCachedSongs after successful fetch", async () => {
      const mockLoadCachedSongs = jest.fn();
      mockGet.mockReturnValue({
        ...mockGet(),
        loadCachedSongs: mockLoadCachedSongs,
      });

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockSongsResponse),
      } as Response);

      await apiSlice.fetchSongs();

      expect(mockLoadCachedSongs).toHaveBeenCalled();
    });
  });

  describe("search", () => {
    const mockSearchResponse = {
      "subsonic-response": {
        status: "ok",
        searchResult3: {
          artist: [{ id: "artist1", name: "Test Artist" }],
          album: [
            {
              id: "album1",
              name: "Test Album",
              artist: "Test Artist",
              artistId: "artist1",
              coverArt: "cover1",
              songCount: 10,
            },
          ],
          song: [
            {
              id: "song1",
              title: "Test Song",
              artist: "Test Artist",
              album: "Test Album",
              duration: 180,
              coverArt: "cover1",
            },
          ],
        },
      },
    };

    it("should search successfully", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockSearchResponse),
      } as Response);

      await apiSlice.search("test query");

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4533/rest/search3.view?query=test%20query&artistCount=20&albumCount=20&songCount=50&u=testuser&t=token123&s=salt123&v=1.16.1&c=subsonicapp&f=json",
      );
      expect(mockSet).toHaveBeenCalledWith({ isSearching: true, error: null });
      expect(mockSet).toHaveBeenCalledWith({
        searchResults: {
          artists: [{ id: "artist1", name: "Test Artist" }],
          albums: [
            {
              id: "album1",
              name: "Test Album",
              artist: "Test Artist",
              artistId: "artist1",
              coverArt: "cover1",
              songCount: 10,
            },
          ],
          songs: [
            {
              id: "song1",
              title: "Test Song",
              artist: "Test Artist",
              album: "Test Album",
              duration: 180,
              coverArt: "cover1",
            },
          ],
        },
        isSearching: false,
      });
    });

    it("should handle empty search query", async () => {
      await apiSlice.search("");

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        searchResults: null,
        isSearching: false,
      });
    });

    it("should handle empty search results", async () => {
      const emptyResponse = {
        "subsonic-response": {
          status: "ok",
          searchResult3: {}, // No artists, albums, or songs
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(emptyResponse),
      } as Response);

      await apiSlice.search("test");

      expect(mockSet).toHaveBeenCalledWith({
        searchResults: {
          artists: [],
          albums: [],
          songs: [],
        },
        isSearching: false,
      });
    });

    it("should handle search errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockFetch.mockRejectedValue(new Error("Search failed"));

      await apiSlice.search("test");

      expect(mockSet).toHaveBeenCalledWith({
        error: "Search failed",
        isSearching: false,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        "Search error:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("fetchAlbums", () => {
    const mockAlbumsResponse = {
      "subsonic-response": {
        status: "ok",
        albumList2: {
          album: [
            {
              id: "album1",
              name: "Test Album",
              artist: "Test Artist",
              songCount: 10,
              coverArt: "cover1",
            },
          ],
        },
      },
    };

    beforeEach(() => {
      mockGet.mockReturnValue({
        ...mockGet(),
        getCoverArtUrl: jest.fn((id) => `http://example.com/cover/${id}`),
      });
    });

    it("should fetch albums successfully", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockAlbumsResponse),
      } as Response);

      const albums = await apiSlice.fetchAlbums();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:4533/rest/getAlbumList2.view?type=alphabeticalByName&size=500&u=testuser&t=token123&s=salt123&v=1.16.1&c=subsonicapp&f=json",
      );
      expect(albums).toEqual([
        {
          id: "album1",
          name: "Test Album",
          artist: "Test Artist",
          songCount: 10,
          coverArt: "http://example.com/cover/cover1",
        },
      ]);
    });

    it("should throw error when no config", async () => {
      mockGet.mockReturnValue({ config: null });

      await expect(apiSlice.fetchAlbums()).rejects.toThrow(
        "Server configuration is missing",
      );
    });

    it("should handle API errors", async () => {
      const errorResponse = {
        "subsonic-response": {
          status: "failed",
          error: { message: "Failed to fetch albums" },
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(errorResponse),
      } as Response);

      await expect(apiSlice.fetchAlbums()).rejects.toThrow(
        "Failed to fetch albums",
      );
    });
  });

  describe("fetchArtists", () => {
    const mockArtistsResponse = {
      "subsonic-response": {
        status: "ok",
        artists: {
          index: [
            {
              artist: [
                {
                  id: "artist1",
                  name: "Artist A",
                  albumCount: 5,
                  coverArt: "cover1",
                },
                {
                  id: "artist2",
                  name: "Artist B",
                  albumCount: 3,
                },
              ],
            },
            {
              artist: [
                {
                  id: "artist3",
                  name: "Artist C",
                  albumCount: 2,
                },
              ],
            },
          ],
        },
      },
    };

    beforeEach(() => {
      mockGet.mockReturnValue({
        ...mockGet(),
        getCoverArtUrl: jest.fn((id) => `http://example.com/cover/${id}`),
      });
    });

    it("should fetch artists successfully", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockArtistsResponse),
      } as Response);

      const artists = await apiSlice.fetchArtists();

      expect(artists).toEqual([
        {
          id: "artist1",
          name: "Artist A",
          albumCount: 5,
          coverArt: "http://example.com/cover/cover1",
        },
        {
          id: "artist2",
          name: "Artist B",
          albumCount: 3,
          coverArt: undefined,
        },
        {
          id: "artist3",
          name: "Artist C",
          albumCount: 2,
          coverArt: undefined,
        },
      ]);
    });

    it("should sort artists alphabetically", async () => {
      const unsortedResponse = {
        "subsonic-response": {
          status: "ok",
          artists: {
            index: [
              {
                artist: [
                  { id: "artist1", name: "Z Artist", albumCount: 1 },
                  { id: "artist2", name: "A Artist", albumCount: 1 },
                ],
              },
            ],
          },
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(unsortedResponse),
      } as Response);

      const artists = await apiSlice.fetchArtists();

      expect(artists[0].name).toBe("A Artist");
      expect(artists[1].name).toBe("Z Artist");
    });
  });

  describe("fetchGenres", () => {
    const mockGenresResponse = {
      "subsonic-response": {
        status: "ok",
        genres: {
          genre: [
            { value: "Rock", songCount: 100 },
            { value: "Pop", songCount: 50 },
            { value: "Jazz", songCount: 25 },
          ],
        },
      },
    };

    it("should fetch genres successfully", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockGenresResponse),
      } as Response);

      const genres = await apiSlice.fetchGenres();

      expect(genres).toEqual([
        { id: "Jazz", name: "Jazz", songCount: 25 },
        { id: "Pop", name: "Pop", songCount: 50 },
        { id: "Rock", name: "Rock", songCount: 100 },
      ]);
    });

    it("should handle single genre response", async () => {
      const singleGenreResponse = {
        "subsonic-response": {
          status: "ok",
          genres: {
            genre: { value: "Rock", songCount: 100 }, // Single object, not array
          },
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(singleGenreResponse),
      } as Response);

      const genres = await apiSlice.fetchGenres();

      expect(genres).toEqual([{ id: "Rock", name: "Rock", songCount: 100 }]);
    });
  });

  describe("fetchPlaylists", () => {
    const mockPlaylistsResponse = {
      "subsonic-response": {
        status: "ok",
        playlists: {
          playlist: [
            {
              id: "playlist1",
              name: "My Playlist",
              songCount: 25,
              coverArt: "cover1",
              owner: "user1",
              public: true,
              created: "2023-01-01",
              changed: "2023-01-02",
            },
          ],
        },
      },
    };

    it("should fetch playlists successfully", async () => {
      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(mockPlaylistsResponse),
      } as Response);

      const playlists = await apiSlice.fetchPlaylists();

      expect(playlists).toEqual([
        {
          id: "playlist1",
          name: "My Playlist",
          songCount: 25,
          coverArt: "cover1",
          owner: "user1",
          public: true,
          created: "2023-01-01",
          changed: "2023-01-02",
        },
      ]);
    });

    it("should handle empty playlists response", async () => {
      const emptyResponse = {
        "subsonic-response": {
          status: "ok",
          playlists: {
            playlist: [],
          },
        },
      };

      mockFetch.mockResolvedValue({
        json: () => Promise.resolve(emptyResponse),
      } as Response);

      const playlists = await apiSlice.fetchPlaylists();

      expect(playlists).toEqual([]);
    });
  });
});
