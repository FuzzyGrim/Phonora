import { useMusicPlayerStore } from "../../store/musicPlayerStore";

// Mock dependencies
jest.mock("expo-secure-store");
jest.mock("md5", () => ({
  __esModule: true,
  default: jest.fn((input: string) => `hashed_${input}`),
}));

global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("Music Player Store - Data Fetching", () => {
  let store: ReturnType<typeof useMusicPlayerStore.getState>;

  const mockConfig = {
    serverUrl: "https://demo.subsonic.org",
    username: "testuser",
    password: "testpass",
    version: "1.16.1",
  };

  beforeEach(() => {
    // Reset store state
    store = useMusicPlayerStore.getState();
    useMusicPlayerStore.setState({
      config: mockConfig,
      isAuthenticated: true,
      songs: [],
      isLoading: false,
      isSearching: false,
      error: null,
      searchResults: null,
    });

    jest.clearAllMocks();
  });

  describe("fetchSongs", () => {
    it("should fetch random songs successfully", async () => {
      const mockResponse = {
        "subsonic-response": {
          status: "ok",
          randomSongs: {
            song: [
              {
                id: "1",
                title: "Test Song 1",
                artist: "Test Artist 1",
                album: "Test Album 1",
                duration: 180,
                coverArt: "cover1",
              },
              {
                id: "2",
                title: "Test Song 2",
                artist: "Test Artist 2",
                album: "Test Album 2",
                duration: 240,
                coverArt: "cover2",
              },
            ],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await store.fetchSongs();

      const currentState = useMusicPlayerStore.getState();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://demo.subsonic.org/rest/getRandomSongs.view",
        ),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("size=100"),
      );

      expect(currentState.songs).toHaveLength(2);
      expect(currentState.songs[0]).toEqual({
        id: "1",
        title: "Test Song 1",
        artist: "Test Artist 1",
        album: "Test Album 1",
        duration: 180,
        coverArt: "cover1",
      });
      expect(currentState.isLoading).toBe(false);
      expect(currentState.error).toBeNull();
    });

    it("should handle API error responses", async () => {
      const mockErrorResponse = {
        "subsonic-response": {
          status: "failed",
          error: {
            code: 40,
            message: "Wrong username or password",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse),
      } as Response);

      await store.fetchSongs();

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.songs).toEqual([]);
      expect(currentState.isLoading).toBe(false);
      expect(currentState.error).toBe("Wrong username or password");
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await store.fetchSongs();

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.songs).toEqual([]);
      expect(currentState.isLoading).toBe(false);
      expect(currentState.error).toBe("Network error");
    });

    it("should not fetch songs when no config is present", async () => {
      useMusicPlayerStore.setState({
        config: null,
        isAuthenticated: false,
      });

      await store.fetchSongs();

      expect(mockFetch).not.toHaveBeenCalled();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.songs).toEqual([]);
    });

    it("should set loading state during fetch", async () => {
      let resolvePromise: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(fetchPromise as Promise<Response>);

      // Start the fetch but don't await it
      const fetchPromise2 = store.fetchSongs();

      // Check that loading state is set
      expect(useMusicPlayerStore.getState().isLoading).toBe(true);
      expect(useMusicPlayerStore.getState().error).toBeNull();

      // Resolve the fetch
      resolvePromise!({
        ok: true,
        json: () =>
          Promise.resolve({
            "subsonic-response": {
              status: "ok",
              randomSongs: { song: [] },
            },
          }),
      });

      await fetchPromise2;

      // Check that loading state is cleared
      expect(useMusicPlayerStore.getState().isLoading).toBe(false);
    });
  });

  describe("search", () => {
    it("should search successfully with all result types", async () => {
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

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      } as Response);

      await store.search("test query");

      const currentState = useMusicPlayerStore.getState();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://demo.subsonic.org/rest/search3.view"),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("query=test%20query"),
      );

      expect(currentState.searchResults).toEqual({
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
      });
      expect(currentState.isSearching).toBe(false);
      expect(currentState.error).toBeNull();
    });

    it("should handle empty search results gracefully", async () => {
      const mockSearchResponse = {
        "subsonic-response": {
          status: "ok",
          searchResult3: {
            // No artist, album, or song arrays
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchResponse),
      } as Response);

      await store.search("no results query");

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.searchResults).toEqual({
        artists: [],
        albums: [],
        songs: [],
      });
      expect(currentState.isSearching).toBe(false);
    });

    it("should clear search results for empty query", async () => {
      // Set some initial search results
      useMusicPlayerStore.setState({
        searchResults: {
          artists: [{ id: "artist1", name: "Test Artist" }],
          albums: [],
          songs: [],
        },
        isSearching: true,
      });

      await store.search("");

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.searchResults).toBeNull();
      expect(currentState.isSearching).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should clear search results for whitespace-only query", async () => {
      await store.search("   ");

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.searchResults).toBeNull();
      expect(currentState.isSearching).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle search API errors", async () => {
      const mockErrorResponse = {
        "subsonic-response": {
          status: "failed",
          error: {
            code: 10,
            message: "Required parameter is missing",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse),
      } as Response);

      await store.search("test");

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.searchResults).toBeNull();
      expect(currentState.isSearching).toBe(false);
      expect(currentState.error).toBe("Required parameter is missing");
    });

    it("should handle search network errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      await store.search("test");

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.searchResults).toBeNull();
      expect(currentState.isSearching).toBe(false);
      expect(currentState.error).toBe("Network timeout");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Search error:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should not search when no config is present", async () => {
      useMusicPlayerStore.setState({
        config: null,
        isAuthenticated: false,
      });

      await store.search("test");

      expect(mockFetch).not.toHaveBeenCalled();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.searchResults).toBeNull();
      expect(currentState.isSearching).toBe(false);
    });

    it("should set searching state during search", async () => {
      let resolvePromise: (value: any) => void;
      const searchPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(searchPromise as Promise<Response>);

      // Start the search but don't await it
      const searchPromise2 = store.search("test");

      // Check that searching state is set
      expect(useMusicPlayerStore.getState().isSearching).toBe(true);
      expect(useMusicPlayerStore.getState().error).toBeNull();

      // Resolve the search
      resolvePromise!({
        ok: true,
        json: () =>
          Promise.resolve({
            "subsonic-response": {
              status: "ok",
              searchResult3: {},
            },
          }),
      });

      await searchPromise2;

      // Check that searching state is cleared
      expect(useMusicPlayerStore.getState().isSearching).toBe(false);
    });
  });

  describe("Data fetching integration with authentication", () => {
    it("should include proper authentication parameters in requests", async () => {
      // Mock Math.random for predictable auth params
      const originalMathRandom = Math.random;
      Math.random = jest.fn(() => 0.123456789);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            "subsonic-response": {
              status: "ok",
              randomSongs: { song: [] },
            },
          }),
      } as Response);

      await store.fetchSongs();

      const fetchCall = mockFetch.mock.calls[0][0] as string;

      expect(fetchCall).toContain("u=testuser");
      expect(fetchCall).toContain("v=1.16.1");
      expect(fetchCall).toContain("c=subsonicapp");
      expect(fetchCall).toContain("f=json");
      expect(fetchCall).toContain("s="); // Salt should be present
      expect(fetchCall).toContain("t="); // Token should be present

      // Restore Math.random
      Math.random = originalMathRandom;
    });

    it("should handle authentication failures in API responses", async () => {
      const mockAuthErrorResponse = {
        "subsonic-response": {
          status: "failed",
          error: {
            code: 40,
            message: "Wrong username or password",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAuthErrorResponse),
      } as Response);

      await store.fetchSongs();

      const currentState = useMusicPlayerStore.getState();

      expect(currentState.error).toBe("Wrong username or password");
      expect(currentState.isLoading).toBe(false);
      expect(currentState.songs).toEqual([]);
    });
  });
});
