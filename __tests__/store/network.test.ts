/**
 * Tests for store/network.ts
 */

import NetInfo from "@react-native-community/netinfo";
import { createNetworkSlice } from "../../store/network";
import { NetworkState, Song } from "../../store/types";

// Mock NetInfo
jest.mock("@react-native-community/netinfo");

const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe("Network Slice", () => {
  let networkSlice: any;
  let mockSet: jest.Mock;
  let mockGet: jest.Mock;

  const mockSongs: Song[] = [
    {
      id: "song1",
      title: "Test Song 1",
      artist: "Test Artist",
      album: "Test Album",
      duration: 180,
    },
    {
      id: "song2",
      title: "Test Song 2",
      artist: "Test Artist",
      album: "Test Album",
      duration: 200,
    },
  ];

  const mockUserSettings = {
    offlineMode: false,
    maxCacheSize: 10,
  };

  beforeEach(() => {
    mockSet = jest.fn();
    mockGet = jest.fn();
    networkSlice = createNetworkSlice(mockSet, mockGet);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockGet.mockReturnValue({
      userSettings: mockUserSettings,
      songs: mockSongs,
      setUserSettings: jest.fn(),
      loadCachedSongs: jest.fn(),
      isFileCached: jest.fn(),
    });
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      expect(networkSlice.networkState).toEqual({
        isConnected: true,
        isInternetReachable: null,
        type: null,
      });
      expect(networkSlice.isOfflineMode).toBe(false);
      expect(networkSlice.cachedSongs).toEqual([]);
    });
  });

  describe("initializeNetworkMonitoring", () => {
    it("should initialize network monitoring and set up listeners", async () => {
      const mockNetworkState = {
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      };

      mockNetInfo.fetch.mockResolvedValue(mockNetworkState as any);
      mockNetInfo.addEventListener.mockReturnValue(() => {});

      const mockUpdateNetworkState = jest.fn();
      mockGet.mockReturnValue({
        ...mockGet(),
        updateNetworkState: mockUpdateNetworkState,
      });

      await networkSlice.initializeNetworkMonitoring();

      expect(mockNetInfo.fetch).toHaveBeenCalled();
      expect(mockNetInfo.addEventListener).toHaveBeenCalled();
    });

    it("should handle errors during initialization", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockNetInfo.fetch.mockRejectedValue(new Error("Network error"));

      // Call the function and wait a bit for the async promise to resolve/reject
      networkSlice.initializeNetworkMonitoring();

      // Wait for the next tick to allow the promise to reject
      await new Promise((resolve) => setTimeout(resolve, 10));

      // The error should be logged with the updated message
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error fetching initial network state:",
        expect.any(Error),
      );
      expect(mockNetInfo.fetch).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should handle null network state values", async () => {
      const mockNetworkState = {
        isConnected: null,
        isInternetReachable: null,
        type: null,
      };

      mockNetInfo.fetch.mockResolvedValue(mockNetworkState as any);

      const mockUpdateNetworkState = jest.fn();
      mockGet.mockReturnValue({
        ...mockGet(),
        updateNetworkState: mockUpdateNetworkState,
      });

      await networkSlice.initializeNetworkMonitoring();

      // Should default isConnected to false when null
      expect(mockUpdateNetworkState).toHaveBeenCalledWith({
        isConnected: false,
        isInternetReachable: null,
        type: null,
      });
    });
  });

  describe("updateNetworkState", () => {
    let mockSetUserSettings: jest.Mock;
    let mockLoadCachedSongs: jest.Mock;

    beforeEach(() => {
      mockSetUserSettings = jest.fn();
      mockLoadCachedSongs = jest.fn();

      mockGet.mockReturnValue({
        userSettings: mockUserSettings,
        setUserSettings: mockSetUserSettings,
        loadCachedSongs: mockLoadCachedSongs,
      });
    });

    it("should update network state when connected", () => {
      const networkState: NetworkState = {
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      };

      networkSlice.updateNetworkState(networkState);

      expect(mockSet).toHaveBeenCalledWith({
        networkState,
        isOfflineMode: false,
      });
      expect(mockSetUserSettings).not.toHaveBeenCalled();
      expect(mockLoadCachedSongs).not.toHaveBeenCalled();
    });

    it("should enable offline mode when disconnected", () => {
      const networkState: NetworkState = {
        isConnected: false,
        isInternetReachable: false,
        type: null,
      };

      networkSlice.updateNetworkState(networkState);

      expect(mockSet).toHaveBeenCalledWith({
        networkState,
        isOfflineMode: true,
      });
      expect(mockSetUserSettings).toHaveBeenCalledWith({
        ...mockUserSettings,
        offlineMode: true,
      });
      expect(mockLoadCachedSongs).toHaveBeenCalled();
    });

    it("should enable offline mode when internet is not reachable", () => {
      const networkState: NetworkState = {
        isConnected: true,
        isInternetReachable: false,
        type: "cellular",
      };

      networkSlice.updateNetworkState(networkState);

      expect(mockSet).toHaveBeenCalledWith({
        networkState,
        isOfflineMode: true,
      });
      expect(mockSetUserSettings).toHaveBeenCalledWith({
        ...mockUserSettings,
        offlineMode: true,
      });
      expect(mockLoadCachedSongs).toHaveBeenCalled();
    });

    it("should respect user offline mode setting when connected", () => {
      const userSettingsWithOffline = {
        ...mockUserSettings,
        offlineMode: true,
      };
      mockGet.mockReturnValue({
        userSettings: userSettingsWithOffline,
        setUserSettings: mockSetUserSettings,
        loadCachedSongs: mockLoadCachedSongs,
      });

      const networkState: NetworkState = {
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      };

      networkSlice.updateNetworkState(networkState);

      expect(mockSet).toHaveBeenCalledWith({
        networkState,
        isOfflineMode: true,
      });
      expect(mockLoadCachedSongs).toHaveBeenCalled();
    });

    it("should log network state changes", () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      const networkState: NetworkState = {
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      };

      networkSlice.updateNetworkState(networkState);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Network state updated:",
        expect.objectContaining({
          isConnected: true,
          isInternetReachable: true,
          isOfflineMode: false,
          offlineModeInSettings: false,
        }),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("loadCachedSongs", () => {
    let mockIsFileCached: jest.Mock;
    let mockLoadSongMetadata: jest.Mock;

    beforeEach(() => {
      mockIsFileCached = jest.fn();
      mockLoadSongMetadata = jest.fn();

      mockGet.mockReturnValue({
        isFileCached: mockIsFileCached,
        loadSongMetadata: mockLoadSongMetadata,
      });
    });

    it("should load cached songs successfully", async () => {
      const mockMetadata = {
        song1: {
          title: "Test Song 1",
          artist: "Test Artist",
          album: "Test Album",
          duration: 180,
        },
        song2: {
          title: "Test Song 2",
          artist: "Test Artist",
          album: "Test Album",
          duration: 200,
        },
      };

      mockLoadSongMetadata.mockResolvedValue(mockMetadata);
      mockIsFileCached
        .mockResolvedValueOnce(true) // song1 is cached
        .mockResolvedValueOnce(false); // song2 is not cached

      await networkSlice.loadCachedSongs();

      expect(mockLoadSongMetadata).toHaveBeenCalled();
      expect(mockIsFileCached).toHaveBeenCalledWith("song1", "mp3");
      expect(mockIsFileCached).toHaveBeenCalledWith("song2", "mp3");
      expect(mockSet).toHaveBeenCalledWith({
        cachedSongs: [
          {
            id: "song1",
            title: "Test Song 1",
            artist: "Test Artist",
            album: "Test Album",
            duration: 180,
            coverArt: undefined,
          },
        ], // Only song1 should be in cached songs
      });
    });

    it("should handle empty metadata", async () => {
      mockLoadSongMetadata.mockResolvedValue({});

      await networkSlice.loadCachedSongs();

      expect(mockLoadSongMetadata).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ cachedSongs: [] });
      expect(mockIsFileCached).not.toHaveBeenCalled();
    });

    it("should handle errors when checking cached files", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      mockLoadSongMetadata.mockRejectedValue(new Error("Metadata error"));

      await networkSlice.loadCachedSongs();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading cached songs:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("should log the number of cached songs found", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const mockMetadata = {
        song1: {
          title: "Test Song 1",
          artist: "Test Artist",
          album: "Test Album",
          duration: 180,
        },
        song2: {
          title: "Test Song 2",
          artist: "Test Artist",
          album: "Test Album",
          duration: 200,
        },
      };

      mockLoadSongMetadata.mockResolvedValue(mockMetadata);
      mockIsFileCached.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      await networkSlice.loadCachedSongs();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Loaded 2 cached songs for offline use",
      );
      consoleSpy.mockRestore();
    });
  });

  describe("getAvailableSongs", () => {
    it("should return all songs when online", () => {
      mockGet.mockReturnValue({
        isOfflineMode: false,
        songs: mockSongs,
        cachedSongs: [mockSongs[0]], // Only first song cached
      });

      const availableSongs = networkSlice.getAvailableSongs();

      expect(availableSongs).toEqual(mockSongs);
    });

    it("should return only cached songs when offline", () => {
      const cachedSongs = [mockSongs[0]];

      mockGet.mockReturnValue({
        isOfflineMode: true,
        songs: mockSongs,
        cachedSongs,
      });

      const availableSongs = networkSlice.getAvailableSongs();

      expect(availableSongs).toEqual(cachedSongs);
    });

    it("should return empty array when offline and no cached songs", () => {
      mockGet.mockReturnValue({
        isOfflineMode: true,
        songs: mockSongs,
        cachedSongs: [],
      });

      const availableSongs = networkSlice.getAvailableSongs();

      expect(availableSongs).toEqual([]);
    });
  });

  describe("Network State Transitions", () => {
    it("should handle transition from online to offline", () => {
      const mockSetUserSettings = jest.fn();
      const mockLoadCachedSongs = jest.fn();

      mockGet.mockReturnValue({
        userSettings: { offlineMode: false, maxCacheSize: 10 },
        setUserSettings: mockSetUserSettings,
        loadCachedSongs: mockLoadCachedSongs,
      });

      // Simulate going offline
      const offlineState: NetworkState = {
        isConnected: false,
        isInternetReachable: false,
        type: null,
      };

      networkSlice.updateNetworkState(offlineState);

      expect(mockSetUserSettings).toHaveBeenCalledWith({
        offlineMode: true,
        maxCacheSize: 10,
      });
      expect(mockLoadCachedSongs).toHaveBeenCalled();
    });

    it("should handle transition from offline to online with manual offline mode", () => {
      const mockSetUserSettings = jest.fn();
      const mockLoadCachedSongs = jest.fn();

      mockGet.mockReturnValue({
        userSettings: { offlineMode: true, maxCacheSize: 10 },
        setUserSettings: mockSetUserSettings,
        loadCachedSongs: mockLoadCachedSongs,
      });

      // Simulate going back online
      const onlineState: NetworkState = {
        isConnected: true,
        isInternetReachable: true,
        type: "wifi",
      };

      networkSlice.updateNetworkState(onlineState);

      // Should still be offline because user has manually enabled offline mode
      expect(mockSet).toHaveBeenCalledWith({
        networkState: onlineState,
        isOfflineMode: true,
      });
      expect(mockLoadCachedSongs).toHaveBeenCalled();
    });
  });
});
