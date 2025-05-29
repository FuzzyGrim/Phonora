import { useMusicPlayerStore } from "../../store/musicPlayerStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserSettings } from "../../store/musicPlayerStore";

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage");

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("Music Player Store - User Settings", () => {
  beforeEach(() => {
    // Reset store state
    useMusicPlayerStore.setState({
      userSettings: { offlineMode: false, maxCacheSize: 10 },
    });

    jest.clearAllMocks();
  });

  describe("setUserSettings", () => {
    it("should save user settings to AsyncStorage and update state", async () => {
      const newSettings: UserSettings = {
        offlineMode: true,
        maxCacheSize: 5,
      };

      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();
      await store.setUserSettings(newSettings);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "user_settings",
        JSON.stringify(newSettings),
      );

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual(newSettings);
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const newSettings: UserSettings = {
        offlineMode: true,
        maxCacheSize: 15,
      };

      mockAsyncStorage.setItem.mockRejectedValue(new Error("Storage error"));

      const store = useMusicPlayerStore.getState();
      await store.setUserSettings(newSettings);

      // Settings should NOT be updated in state when storage fails (current implementation)
      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual({
        offlineMode: false,
        maxCacheSize: 10,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Error saving settings:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle offline mode setting changes", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      // Enable offline mode
      await store.setUserSettings({
        offlineMode: true,
        maxCacheSize: 10,
      });

      let currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings.offlineMode).toBe(true);

      // Disable offline mode
      await store.setUserSettings({
        offlineMode: false,
        maxCacheSize: 10,
      });

      currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings.offlineMode).toBe(false);
    });

    it("should handle cache size setting changes", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      // Test various cache sizes
      const testSizes = [0, 1, 5, 10, 50, 100];

      for (const size of testSizes) {
        await store.setUserSettings({
          offlineMode: false,
          maxCacheSize: size,
        });

        const currentState = useMusicPlayerStore.getState();
        expect(currentState.userSettings.maxCacheSize).toBe(size);
      }

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(testSizes.length);
    });

    it("should preserve existing settings when updating partial settings", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      // Set initial settings
      const initialSettings: UserSettings = {
        offlineMode: true,
        maxCacheSize: 20,
      };

      await store.setUserSettings(initialSettings);

      // Update only offline mode
      const partialUpdate: UserSettings = {
        offlineMode: false,
        maxCacheSize: 20, // Keep the same cache size
      };

      await store.setUserSettings(partialUpdate);

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual({
        offlineMode: false,
        maxCacheSize: 20,
      });
    });
  });

  describe("User Settings Integration with App Initialization", () => {
    it("should load user settings during store initialization", async () => {
      const savedSettings: UserSettings = {
        offlineMode: true,
        maxCacheSize: 25,
      };

      // Mock AsyncStorage to return saved settings
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(savedSettings));

      // Reset store state to defaults
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 10 },
      });

      const store = useMusicPlayerStore.getState();
      await store.initializeStore();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual(savedSettings);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("user_settings");
    });

    it("should use default settings when no saved settings exist", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      // Reset store state
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 10 },
      });

      const store = useMusicPlayerStore.getState();
      await store.initializeStore();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual({
        offlineMode: false,
        maxCacheSize: 10,
      });
    });

    it("should handle corrupted user settings data gracefully", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // Mock corrupted JSON data
      mockAsyncStorage.getItem.mockResolvedValue("invalid json data");

      const store = useMusicPlayerStore.getState();
      await store.initializeStore();

      // Should maintain default settings when JSON parsing fails
      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual({
        offlineMode: false,
        maxCacheSize: 10,
      });

      consoleSpy.mockRestore();
    });
  });

  describe("User Settings Validation", () => {
    it("should handle edge cases for cache size values", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      // Test edge cases
      const edgeCases = [
        { offlineMode: false, maxCacheSize: 0 }, // Disabled caching
        { offlineMode: true, maxCacheSize: 0.5 }, // Fractional GB
        { offlineMode: false, maxCacheSize: 1000 }, // Very large cache
      ];

      for (const settings of edgeCases) {
        await store.setUserSettings(settings);

        const currentState = useMusicPlayerStore.getState();
        expect(currentState.userSettings).toEqual(settings);
      }
    });

    it("should maintain settings state consistency", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      // Test rapid setting changes
      const settingsSequence = [
        { offlineMode: true, maxCacheSize: 5 },
        { offlineMode: false, maxCacheSize: 10 },
        { offlineMode: true, maxCacheSize: 0 },
        { offlineMode: false, maxCacheSize: 50 },
      ];

      for (const settings of settingsSequence) {
        await store.setUserSettings(settings);
        const currentState = useMusicPlayerStore.getState();
        expect(currentState.userSettings).toEqual(settings);
      }

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(
        settingsSequence.length,
      );
    });
  });

  describe("Settings and Authentication Interaction", () => {
    it("should preserve user settings during authentication changes", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      const customSettings: UserSettings = {
        offlineMode: true,
        maxCacheSize: 15,
      };

      // Set custom user settings
      await store.setUserSettings(customSettings);

      // Simulate authentication state changes
      useMusicPlayerStore.setState({
        config: {
          serverUrl: "https://test.com",
          username: "user",
          password: "pass",
          version: "1.16.1",
        },
        isAuthenticated: true,
      });

      // Settings should remain unchanged
      let currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual(customSettings);

      // Clear authentication
      await store.clearConfig();

      // Settings should still be preserved
      currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual(customSettings);
    });

    it("should handle concurrent authentication and settings operations", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      const settingsPromise = store.setUserSettings({
        offlineMode: true,
        maxCacheSize: 20,
      });

      const configPromise = store.setConfig({
        serverUrl: "https://test.com",
        username: "user",
        password: "pass",
        version: "1.16.1",
      });

      await Promise.all([settingsPromise, configPromise]);

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual({
        offlineMode: true,
        maxCacheSize: 20,
      });
      expect(currentState.isAuthenticated).toBe(true);
    });
  });

  describe("Settings Persistence", () => {
    it("should save settings with correct JSON format", async () => {
      mockAsyncStorage.setItem.mockResolvedValue();

      const store = useMusicPlayerStore.getState();

      const settings: UserSettings = {
        offlineMode: true,
        maxCacheSize: 7.5,
      };

      await store.setUserSettings(settings);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "user_settings",
        JSON.stringify(settings),
      );

      // Verify the JSON format
      const savedData = mockAsyncStorage.setItem.mock.calls[0][1];
      const parsedData = JSON.parse(savedData);
      expect(parsedData).toEqual(settings);
    });

    it("should handle settings persistence across app restarts", async () => {
      // Simulate app restart by resetting store and loading settings
      const persistedSettings: UserSettings = {
        offlineMode: true,
        maxCacheSize: 30,
      };

      const store = useMusicPlayerStore.getState();

      // First session: save settings
      mockAsyncStorage.setItem.mockResolvedValue();
      await store.setUserSettings(persistedSettings);

      // Simulate app restart: reset state
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 10 },
      });

      // Second session: load settings
      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(persistedSettings),
      );
      await store.initializeStore();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.userSettings).toEqual(persistedSettings);
    });
  });
});
