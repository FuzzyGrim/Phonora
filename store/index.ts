import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

// Import functions from modular files
import { createAuthSlice } from "./auth";
import { createApiSlice } from "./api";
import { createPlaybackSlice } from "./playback";
import { createNetworkSlice } from "./network";
import { createCacheSlice } from "./cache";

// Import types
import { UserSettings } from "./types";

/**
 * Combined store interface - simplified to avoid conflicts
 */
export interface MusicPlayerState {
  // Import all functions and state from each slice
  [key: string]: any;
}

/**
 * Main Zustand store for music player functionality
 * Combines all feature slices into a single store
 */
export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  // Combine all slices
  ...createAuthSlice(set, get),
  ...createCacheSlice(set, get),
  ...createApiSlice(set, get),
  ...createPlaybackSlice(set, get),
  ...createNetworkSlice(set, get),

  // Additional shared state
  isLoading: false,
  error: null,
  isSearching: false,
  searchResults: null,

  /**
   * Initialize the store by loading saved credentials and settings
   * Called when the app starts
   */
  initializeStore: async () => {
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

      // Initialize network monitoring
      get().initializeNetworkMonitoring();

      // If we have credentials, fetch songs automatically (only if online)
      if (get().isAuthenticated && !get().isOfflineMode) {
        get().fetchSongs();
      }
    } catch (error) {
      console.error("Error initializing store:", error);
    }
  },

  /**
   * Update user settings and save to storage
   */
  setUserSettings: async (settings: UserSettings) => {
    try {
      const currentSettings = get().userSettings;
      await AsyncStorage.setItem("user_settings", JSON.stringify(settings));
      set({ userSettings: settings });

      // If offline mode setting changed, trigger network state update
      if (currentSettings.offlineMode !== settings.offlineMode) {
        const { networkState, updateNetworkState } = get();
        updateNetworkState(networkState);
      }
    } catch (error) {
      console.error("Error saving user settings:", error);
    }
  },

  /**
   * Toggle repeat mode (off -> one -> all -> off)
   */
  toggleRepeat: () => {
    set((state: any) => {
      let newMode: "off" | "one" | "all";
      switch (state.repeatMode) {
        case "off":
          newMode = "one";
          break;
        case "one":
          newMode = "all";
          break;
        case "all":
        default:
          newMode = "off";
          break;
      }

      return {
        repeatMode: newMode,
        isRepeat: newMode !== "off",
        // If enabling repeat, disable shuffle
        isShuffle: newMode !== "off" ? false : state.isShuffle,
      };
    });
  },

  /**
   * Set specific repeat mode
   */
  setRepeatMode: (mode: "off" | "one" | "all") => {
    set((state: any) => ({
      repeatMode: mode,
      isRepeat: mode !== "off",
      // If enabling repeat, disable shuffle
      isShuffle: mode !== "off" ? false : state.isShuffle,
    }));
  },

  /**
   * Toggle shuffle mode
   */
  toggleShuffle: () => {
    set((state: any) => ({
      isShuffle: !state.isShuffle,
      // If enabling shuffle, disable repeat
      isRepeat: !state.isShuffle ? false : state.isRepeat,
      repeatMode: !state.isShuffle ? "off" : state.repeatMode,
    }));
  },
}));
