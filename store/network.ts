import NetInfo from "@react-native-community/netinfo";
import { NetworkState } from "./types";

/**
 * Network slice interface for type safety
 */
export interface NetworkSlice {
  // State
  networkState: NetworkState;
  isOfflineMode: boolean;

  // Actions
  initializeNetworkMonitoring: () => void;
  updateNetworkState: (networkState: NetworkState) => void;
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
    const { userSettings, setUserSettings } = get();

    // Check if we have no internet connection
    const hasNoInternet =
      !networkState.isConnected || networkState.isInternetReachable === false;

    // Auto-enable offline mode when no internet connection
    const shouldBeOffline = userSettings.offlineMode || hasNoInternet;

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
  },
});
