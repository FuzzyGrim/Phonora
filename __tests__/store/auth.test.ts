import { useMusicPlayerStore } from "../../store/musicPlayerStore";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Mock dependencies
jest.mock("expo-secure-store");
jest.mock("@react-native-async-storage/async-storage");
jest.mock("expo-file-system");
jest.mock("expo-audio");
jest.mock("md5", () => ({
  __esModule: true,
  default: jest.fn((input: string) => `hashed_${input}`),
}));

// Mock fetch
global.fetch = jest.fn();

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("Music Player Store - Authentication", () => {
  beforeEach(() => {
    // Reset store state before each test
    useMusicPlayerStore.setState({
      config: null,
      isAuthenticated: false,
      songs: [],
      userSettings: { offlineMode: false, maxCacheSize: 10 },
      isLoading: false,
      error: null,
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("initializeStore", () => {
    it("should load credentials from secure storage and set authenticated state", async () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      const mockUserSettings = {
        offlineMode: true,
        maxCacheSize: 5,
      };

      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify(mockConfig),
      );
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(mockUserSettings),
      );

      // Mock fetchSongs method on the store
      const originalFetchSongs = useMusicPlayerStore.getState().fetchSongs;
      const mockFetchSongs = jest.fn().mockResolvedValue(undefined);
      useMusicPlayerStore.setState({ fetchSongs: mockFetchSongs });

      const store = useMusicPlayerStore.getState();
      await store.initializeStore();

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "subsonic_credentials",
      );
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("user_settings");

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.config).toEqual(mockConfig);
      expect(currentState.isAuthenticated).toBe(true);
      expect(currentState.userSettings).toEqual(mockUserSettings);
      expect(mockFetchSongs).toHaveBeenCalled();

      // Restore original function
      useMusicPlayerStore.setState({ fetchSongs: originalFetchSongs });
    });

    it("should handle missing credentials gracefully", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      mockAsyncStorage.getItem.mockResolvedValue(null);

      // Mock fetchSongs to ensure it's not called
      const mockFetchSongs = jest.fn().mockResolvedValue(undefined);
      useMusicPlayerStore.setState({ fetchSongs: mockFetchSongs });

      const store = useMusicPlayerStore.getState();
      await store.initializeStore();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.config).toBeNull();
      expect(currentState.isAuthenticated).toBe(false);
      expect(mockFetchSongs).not.toHaveBeenCalled();
    });

    it("should handle credentials without user settings", async () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify(mockConfig),
      );
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const mockFetchSongs = jest.fn().mockResolvedValue(undefined);
      useMusicPlayerStore.setState({ fetchSongs: mockFetchSongs });

      const store = useMusicPlayerStore.getState();
      await store.initializeStore();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.config).toEqual(mockConfig);
      expect(currentState.isAuthenticated).toBe(true);
      expect(currentState.userSettings).toEqual({
        offlineMode: false,
        maxCacheSize: 10,
      });
      expect(mockFetchSongs).toHaveBeenCalled();
    });

    it("should handle storage errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockSecureStore.getItemAsync.mockRejectedValue(
        new Error("Storage error"),
      );

      const store = useMusicPlayerStore.getState();
      await store.initializeStore();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.config).toBeNull();
      expect(currentState.isAuthenticated).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error initializing store:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("setConfig", () => {
    it("should save config to secure storage and set authenticated state", async () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      mockSecureStore.setItemAsync.mockResolvedValue();
      const mockFetchSongs = jest.fn().mockResolvedValue(undefined);
      useMusicPlayerStore.setState({ fetchSongs: mockFetchSongs });

      const store = useMusicPlayerStore.getState();
      await store.setConfig(mockConfig);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "subsonic_credentials",
        JSON.stringify(mockConfig),
      );

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.config).toEqual(mockConfig);
      expect(currentState.isAuthenticated).toBe(true);
      expect(mockFetchSongs).toHaveBeenCalled();
    });

    it("should handle secure storage errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      mockSecureStore.setItemAsync.mockRejectedValue(
        new Error("Storage error"),
      );

      const store = useMusicPlayerStore.getState();
      await store.setConfig(mockConfig);

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.config).toBeNull();
      expect(currentState.isAuthenticated).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error saving credentials:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("clearConfig", () => {
    it("should remove credentials from secure storage and reset state", async () => {
      // Set initial authenticated state
      useMusicPlayerStore.setState({
        config: {
          serverUrl: "https://demo.subsonic.org",
          username: "testuser",
          password: "testpass",
          version: "1.16.1",
        },
        isAuthenticated: true,
        songs: [
          {
            id: "1",
            title: "Test Song",
            artist: "Test Artist",
            album: "Test Album",
            duration: 180,
          },
        ],
      });

      mockSecureStore.deleteItemAsync.mockResolvedValue();

      const store = useMusicPlayerStore.getState();
      await store.clearConfig();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "subsonic_credentials",
      );

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.config).toBeNull();
      expect(currentState.isAuthenticated).toBe(false);
      expect(currentState.songs).toEqual([]);
    });

    it("should handle storage deletion errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockSecureStore.deleteItemAsync.mockRejectedValue(
        new Error("Storage error"),
      );

      const store = useMusicPlayerStore.getState();
      await store.clearConfig();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error clearing credentials:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("generateAuthParams", () => {
    it("should generate correct authentication parameters when config exists", () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      useMusicPlayerStore.setState({
        config: mockConfig,
        isAuthenticated: true,
      });

      // Mock Math.random to get predictable salt
      const originalMathRandom = Math.random;
      Math.random = jest.fn(() => 0.123456789);

      const store = useMusicPlayerStore.getState();
      const authParams = store.generateAuthParams();

      Math.random = jest.fn(() => 0.123456789); // Reset for consistent salt
      const consistentSalt = Math.random().toString(36).substring(2);

      expect(authParams.get("u")).toBe("testuser");
      expect(authParams.get("s")).toBe(consistentSalt);
      expect(authParams.get("v")).toBe("1.16.1");
      expect(authParams.get("c")).toBe("subsonicapp");
      expect(authParams.get("f")).toBe("json");

      // Restore Math.random
      Math.random = originalMathRandom;
    });

    it("should return empty URLSearchParams when no config exists", () => {
      useMusicPlayerStore.setState({
        config: null,
        isAuthenticated: false,
      });

      const store = useMusicPlayerStore.getState();
      const authParams = store.generateAuthParams();

      expect(authParams.toString()).toBe("");
    });

    it("should generate different salts on multiple calls", () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      useMusicPlayerStore.setState({
        config: mockConfig,
        isAuthenticated: true,
      });

      const store = useMusicPlayerStore.getState();
      const authParams1 = store.generateAuthParams();
      const authParams2 = store.generateAuthParams();

      // Salts should be different (since Math.random is not mocked here)
      expect(authParams1.get("s")).not.toBe(authParams2.get("s"));
      // But tokens should also be different due to different salts
      expect(authParams1.get("t")).not.toBe(authParams2.get("t"));
      // Other parameters should be the same
      expect(authParams1.get("u")).toBe(authParams2.get("u"));
      expect(authParams1.get("v")).toBe(authParams2.get("v"));
    });
  });

  describe("getCoverArtUrl", () => {
    it("should generate correct cover art URL when config exists", () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      useMusicPlayerStore.setState({
        config: mockConfig,
        isAuthenticated: true,
      });

      const store = useMusicPlayerStore.getState();
      const coverArtUrl = store.getCoverArtUrl("cover123");

      expect(coverArtUrl).toContain(
        "https://demo.subsonic.org/rest/getCoverArt.view",
      );
      expect(coverArtUrl).toContain("id=cover123");
      expect(coverArtUrl).toContain("u=testuser");
      expect(coverArtUrl).toContain("v=1.16.1");
      expect(coverArtUrl).toContain("c=subsonicapp");
      expect(coverArtUrl).toContain("f=json");
    });

    it("should return empty string when no config exists", () => {
      useMusicPlayerStore.setState({
        config: null,
        isAuthenticated: false,
      });

      const store = useMusicPlayerStore.getState();
      const coverArtUrl = store.getCoverArtUrl("cover123");

      expect(coverArtUrl).toBe("");
    });
  });

  describe("getStreamUrl", () => {
    it("should generate correct stream URL when config exists", () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      useMusicPlayerStore.setState({
        config: mockConfig,
        isAuthenticated: true,
      });

      const store = useMusicPlayerStore.getState();
      const streamUrl = store.getStreamUrl("song123");

      expect(streamUrl).toContain("https://demo.subsonic.org/rest/stream.view");
      expect(streamUrl).toContain("id=song123");
      expect(streamUrl).toContain("u=testuser");
      expect(streamUrl).toContain("v=1.16.1");
      expect(streamUrl).toContain("c=subsonicapp");
      expect(streamUrl).toContain("f=json");
    });

    it("should return empty string when no config exists", () => {
      useMusicPlayerStore.setState({
        config: null,
        isAuthenticated: false,
      });

      const store = useMusicPlayerStore.getState();
      const streamUrl = store.getStreamUrl("song123");

      expect(streamUrl).toBe("");
    });
  });

  describe("Authentication Integration", () => {
    it("should maintain authentication state across store operations", async () => {
      const mockConfig = {
        serverUrl: "https://demo.subsonic.org",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      };

      // Mock storage operations
      mockSecureStore.setItemAsync.mockResolvedValue();
      mockSecureStore.getItemAsync.mockResolvedValue(
        JSON.stringify(mockConfig),
      );
      const mockFetchSongs = jest.fn().mockResolvedValue(undefined);
      useMusicPlayerStore.setState({ fetchSongs: mockFetchSongs });

      const store = useMusicPlayerStore.getState();

      // Set config
      await store.setConfig(mockConfig);
      expect(useMusicPlayerStore.getState().isAuthenticated).toBe(true);
      expect(useMusicPlayerStore.getState().config).toEqual(mockConfig);

      // Verify auth params work
      const authParams = store.generateAuthParams();
      expect(authParams.get("u")).toBe("testuser");

      // Verify URLs can be generated
      const streamUrl = store.getStreamUrl("test");
      const coverArtUrl = store.getCoverArtUrl("test");

      expect(streamUrl).not.toBe("");
      expect(coverArtUrl).not.toBe("");

      // Clear config
      mockSecureStore.deleteItemAsync.mockResolvedValue();
      await store.clearConfig();

      expect(useMusicPlayerStore.getState().isAuthenticated).toBe(false);
      expect(useMusicPlayerStore.getState().config).toBeNull();

      // Verify auth params return empty after clearing
      const emptyAuthParams = store.generateAuthParams();
      expect(emptyAuthParams.toString()).toBe("");
    });
  });
});
