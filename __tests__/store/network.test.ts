/**
 * Tests for store/network.ts
 */

import NetInfo from "@react-native-community/netinfo";
import { createNetworkSlice } from "../../store/network";
import { NetworkState, Song } from "../../store/types";

// Mock NetInfo
jest.mock("@react-native-community/netinfo");

// Mock database manager
jest.mock("../../store/database", () => ({
  dbManager: {
    getAllCachedSongs: jest.fn(),
  },
}));

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
      mockNetInfo.addEventListener.mockReturnValue(() => { });

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
    });
  });

  describe("getAvailableSongs", () => {
    // Tests moved to home screen integration tests since this functionality
    // was moved from network slice to the home screen component
  });

  describe("Network State Transitions", () => {
    it("should handle transition from online to offline", () => {
      const mockSetUserSettings = jest.fn();

      mockGet.mockReturnValue({
        userSettings: { offlineMode: false, maxCacheSize: 10 },
        setUserSettings: mockSetUserSettings,
        isOfflineMode: false,
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
    });

    it("should handle transition from offline to online with manual offline mode", () => {
      const mockSetUserSettings = jest.fn();

      mockGet.mockReturnValue({
        userSettings: { offlineMode: true, maxCacheSize: 10 },
        setUserSettings: mockSetUserSettings,
        isOfflineMode: false,
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
    });
  });
});
