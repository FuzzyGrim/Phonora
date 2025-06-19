/**
 * Authentication related functions and state management
 */

import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import md5 from "md5";
import { SubsonicConfig, UserSettings, DEFAULT_USER_SETTINGS } from "./types";

/**
 * Authentication slice for the store
 */
export interface AuthSlice {
  // State
  config: SubsonicConfig | null;
  isAuthenticated: boolean;
  userSettings: UserSettings;

  // Actions
  setConfig: (config: SubsonicConfig) => Promise<void>;
  clearConfig: () => Promise<void>;
  generateAuthParams: () => URLSearchParams;
  setUserSettings: (settings: UserSettings) => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearAllData: () => Promise<void>;
}

/**
 * Create authentication slice
 */
export const createAuthSlice = (set: any, get: any): AuthSlice => ({
  // Initial state
  config: null,
  isAuthenticated: false,
  userSettings: DEFAULT_USER_SETTINGS,

  /**
   * Initialize authentication by loading saved credentials and settings
   */
  initializeAuth: async () => {
    try {
      // Load credentials from secure storage
      const credentials = await SecureStore.getItemAsync(
        "subsonic_credentials",
      );
      if (credentials) {
        const config = JSON.parse(credentials);
        set({ config, isAuthenticated: true });
      }

      // Load user settings from regular storage
      const settings = await AsyncStorage.getItem("user_settings");
      if (settings) {
        set({ userSettings: JSON.parse(settings) });
      }
    } catch (error) {
      console.error("Error initializing authentication:", error);
    }
  },

  /**
   * Save server configuration and credentials
   * Uses SecureStore to protect sensitive information
   */
  setConfig: async (config: SubsonicConfig) => {
    try {
      await SecureStore.setItemAsync(
        "subsonic_credentials",
        JSON.stringify(config),
      );
      set({ config, isAuthenticated: true });
    } catch (error) {
      console.error("Error saving credentials:", error);
      throw error;
    }
  },

  /**
   * Remove saved credentials and reset authentication state
   */
  clearConfig: async () => {
    try {
      await SecureStore.deleteItemAsync("subsonic_credentials");
      set({ config: null, isAuthenticated: false });
    } catch (error) {
      console.error("Error clearing credentials:", error);
      throw error;
    }
  },

  /**
   * Save user settings to persistent storage
   */
  setUserSettings: async (settings: UserSettings) => {
    try {
      await AsyncStorage.setItem("user_settings", JSON.stringify(settings));
      set({ userSettings: settings });
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  },

  /**
   * Generate authentication parameters for Subsonic API requests
   * Uses salt and token authentication as per Subsonic API spec
   */
  generateAuthParams: () => {
    const { config } = get();
    if (!config) return new URLSearchParams();

    // Generate a random salt for security
    const salt = Math.random().toString(36).substring(2);
    // Create token using MD5 hash of password + salt
    const token = md5(config.password + salt);

    // Return parameters in the format expected by Subsonic API
    return new URLSearchParams({
      u: config.username,
      t: token,
      s: salt,
      v: config.version,
      c: "subsonicapp", // Client ID
      f: "json", // Response format
    });
  },

  /**
   * Clear all app data including credentials, user settings, and cache
   * This will reset the app to its initial state
   */
  clearAllData: async () => {
    try {
      // Stop any currently playing audio first
      const { playback, stopSong } = get();
      if (playback?.player) {
        await stopSong();
      }

      // Clear credentials from secure storage
      await SecureStore.deleteItemAsync("subsonic_credentials");

      // Clear user settings from AsyncStorage
      await AsyncStorage.removeItem("user_settings");

      // Clear cache using the cache slice
      const { clearCache } = get();
      await clearCache();

      // Reset all state to initial values
      set({
        // Auth state
        config: null,
        isAuthenticated: false,
        userSettings: DEFAULT_USER_SETTINGS,

        // General state
        isLoading: false,
        error: null,
        isSearching: false,
        searchResults: null,

        // Cache state
        cachedSongs: [],

        // Playback state
        playback: {
          isPlaying: false,
          currentSong: null,
          player: null,
        },
        currentPlaylist: null,
        isRepeat: false,
        isShuffle: false,
        repeatMode: "off",
      });

      console.log("All app data cleared successfully");
    } catch (error) {
      console.error("Error clearing all data:", error);
      throw error;
    }
  },
});
