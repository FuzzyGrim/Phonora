import NetInfo from "@react-native-community/netinfo";
import { NetworkState, Song } from "./types";

/**
 * Network slice interface for type safety
 */
export interface NetworkSlice {
  // State
  networkState: NetworkState;
  isOfflineMode: boolean;
  cachedSongs: Song[];

  // Actions
  initializeNetworkMonitoring: () => void;
  updateNetworkState: (networkState: NetworkState) => void;
  loadCachedSongs: () => Promise<void>;
  getAvailableSongs: () => Song[];
}

/**
 * Network state creator function for Zustand store composition
 */
export const createNetworkSlice = (set: any, get: any): NetworkSlice => ({
  // Initial state
  networkState: {
    isConnected: true,
    isInternetReachable: null,
    type: null,
  },
  isOfflineMode: false,
  cachedSongs: [],

  /**
   * Initialize network monitoring
   */
  initializeNetworkMonitoring: () => {
    try {
      // Get initial network state and set up listener
      NetInfo.fetch()
        .then((networkState) => {
          const initialNetworkState: NetworkState = {
            isConnected: networkState.isConnected ?? false,
            isInternetReachable: networkState.isInternetReachable,
            type: networkState.type,
          };

          // Update store with initial state
          get().updateNetworkState(initialNetworkState);
        })
        .catch((error) => {
          console.error("Error fetching initial network state:", error);
        });

      // Set up listener for network changes
      NetInfo.addEventListener((state) => {
        const newNetworkState: NetworkState = {
          isConnected: state.isConnected ?? false,
          isInternetReachable: state.isInternetReachable,
          type: state.type,
        };
        get().updateNetworkState(newNetworkState);
      });
    } catch (error) {
      console.error("Error initializing network monitoring:", error);
    }
  },

  /**
   * Update network state and handle offline mode automatically
   */
  updateNetworkState: (networkState: NetworkState) => {
    const {
      userSettings,
      setUserSettings,
      loadCachedSongs,
      networkState: currentNetworkState,
      isOfflineMode: currentOfflineMode,
    } = get();

    // Check if we have no internet connection
    const hasNoInternet =
      !networkState.isConnected || networkState.isInternetReachable === false;

    // Auto-enable offline mode when no internet connection
    const shouldBeOffline = userSettings.offlineMode || hasNoInternet;

    // Check if there's actually a change in network state or offline mode
    // Handle case where currentNetworkState might be undefined (e.g., in tests)
    const hasNetworkStateChanged =
      !currentNetworkState ||
      currentNetworkState.isConnected !== networkState.isConnected ||
      currentNetworkState.isInternetReachable !==
        networkState.isInternetReachable ||
      currentNetworkState.type !== networkState.type ||
      currentOfflineMode !== shouldBeOffline;

    // If we're going offline due to network issues and offline mode isn't already enabled in settings,
    // automatically enable it in the user settings
    if (hasNoInternet && !userSettings.offlineMode) {
      const updatedSettings = {
        ...userSettings,
        offlineMode: true,
      };

      // Update settings both in state and storage
      setUserSettings(updatedSettings);
      console.log(
        "Automatically enabled offline mode due to no internet connection",
      );
    }

    set({
      networkState,
      isOfflineMode: shouldBeOffline,
    });

    // If we just went offline, load cached songs
    if (shouldBeOffline && !currentOfflineMode) {
      loadCachedSongs();
    }

    // Only log when there's an actual change
    if (hasNetworkStateChanged) {
      console.log("Network state updated:", {
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
        isOfflineMode: shouldBeOffline,
        offlineModeInSettings: userSettings.offlineMode,
      });
    }
  },

  /**
   * Load songs that are available in cache for offline use
   */
  loadCachedSongs: async () => {
    try {
      const { loadSongMetadata, isFileCached } = get();
      const cachedSongs: Song[] = [];

      // Load song metadata from cache
      const songMetadata = await loadSongMetadata();

      // Check which songs have both metadata and cached audio files
      for (const [songId, metadata] of Object.entries(songMetadata)) {
        const isSongCached = await isFileCached(songId, "mp3");
        if (isSongCached && metadata) {
          // Create a song object from the cached metadata
          const song: Song = {
            id: songId,
            title: (metadata as any).title || "Unknown Title",
            artist: (metadata as any).artist || "Unknown Artist",
            album: (metadata as any).album || "Unknown Album",
            duration: (metadata as any).duration || 0,
            coverArt: (metadata as any).coverArt,
          };
          cachedSongs.push(song);
        }
      }

      set({ cachedSongs });
      console.log(`Loaded ${cachedSongs.length} cached songs for offline use`);
    } catch (error) {
      console.error("Error loading cached songs:", error);
    }
  },

  /**
   * Get songs available based on current mode (online/offline)
   */
  getAvailableSongs: () => {
    const { isOfflineMode, songs, cachedSongs } = get();
    return isOfflineMode ? cachedSongs : songs;
  },
});
