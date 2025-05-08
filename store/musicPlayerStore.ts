import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import md5 from "md5";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

// Define cache directories for storing audio files and images
const AUDIO_DIRECTORY = FileSystem.cacheDirectory + "audio/";
const IMAGE_DIRECTORY = FileSystem.cacheDirectory + "image/";

/**
 * Represents a song in the Subsonic API
 */
export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverArt?: string;
}

/**
 * Configuration for connecting to a Subsonic server
 */
interface SubsonicConfig {
  serverUrl: string;
  username: string;
  password: string;
  version: string; // API version to use when communicating with the server
}

/**
 * State related to the currently playing audio
 */
interface PlaybackState {
  isPlaying: boolean;
  currentSong: Song | null;
  sound: Audio.Sound | null;
}

/**
 * User preferences for the application
 */
interface UserSettings {
  offlineMode: boolean;
  maxAudioCacheSize: number; // in GB
  maxImageCacheSize: number; // in GB
}

/**
 * Complete state and actions for the Subsonic store
 */
interface MusicPlayerState {
  // State
  config: SubsonicConfig | null;
  isAuthenticated: boolean;
  songs: Song[];
  userSettings: UserSettings;
  isLoading: boolean;
  error: string | null;
  playback: PlaybackState;

  // Authentication actions
  setConfig: (config: SubsonicConfig) => void;
  clearConfig: () => void;
  generateAuthParams: () => URLSearchParams;

  // Data fetching
  fetchSongs: () => Promise<void>;

  // URL generation
  getCoverArtUrl: (id: string) => string;
  getStreamUrl: (id: string) => string;

  // Playback control
  playSong: (song: Song) => Promise<void>;
  pauseSong: () => Promise<void>;
  resumeSong: () => Promise<void>;
  stopSong: () => Promise<void>;
  seekToPosition: (positionMillis: number) => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekForward: () => Promise<void>;
  seekBackward: () => Promise<void>;
  setPlaybackRate: (speed: number) => Promise<void>;

  // Cache management
  clearCache: (type?: "audio" | "image") => Promise<void>;

  // Initialization
  initializeStore: () => Promise<void>;

  // Settings management
  setUserSettings: (settings: UserSettings) => Promise<void>;
}

// Default settings when no user preferences are saved
const DEFAULT_USER_SETTINGS: UserSettings = {
  offlineMode: false,
  maxAudioCacheSize: 5, // 5 GB
  maxImageCacheSize: 5, // 5 GB
};

/**
 * Main Zustand store for Subsonic functionality
 * Handles authentication, playback, caching, and settings
 */
export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  // Initial state
  config: null,
  isAuthenticated: false,
  songs: [],
  userSettings: DEFAULT_USER_SETTINGS,
  isLoading: false,
  error: null,
  playback: {
    isPlaying: false,
    currentSong: null,
    sound: null,
  },

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

      // If we have credentials, fetch songs automatically
      if (get().isAuthenticated) {
        get().fetchSongs();
      }
    } catch (error) {
      console.error("Error initializing store:", error);
    }
  },

  /**
   * Save server configuration and credentials
   * Uses SecureStore to protect sensitive information
   */
  setConfig: async (config) => {
    try {
      await SecureStore.setItemAsync(
        "subsonic_credentials",
        JSON.stringify(config),
      );
      set({ config, isAuthenticated: true });
      // Fetch songs immediately after successful authentication
      get().fetchSongs();
    } catch (error) {
      console.error("Error saving credentials:", error);
    }
  },

  /**
   * Remove saved credentials and reset authentication state
   */
  clearConfig: async () => {
    try {
      await SecureStore.deleteItemAsync("subsonic_credentials");
      set({ config: null, isAuthenticated: false, songs: [] });
    } catch (error) {
      console.error("Error clearing credentials:", error);
    }
  },

  /**
   * Save user settings to persistent storage
   */
  setUserSettings: async (settings) => {
    try {
      await AsyncStorage.setItem("user_settings", JSON.stringify(settings));
      set({ userSettings: settings });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  },

  /**
   * Clear cached files to free up storage space
   * Can clear audio files, images, or both
   */
  clearCache: async (type?: "audio" | "image") => {
    try {
      // Clear audio cache if requested or if no specific type
      if (!type || type === "audio") {
        const musicDirInfo = await FileSystem.getInfoAsync(AUDIO_DIRECTORY);
        if (musicDirInfo.exists) {
          await FileSystem.deleteAsync(AUDIO_DIRECTORY);
        }
        // Recreate the directory to ensure it exists for future caching
        await FileSystem.makeDirectoryAsync(AUDIO_DIRECTORY, {
          intermediates: true,
        });
      }

      // Clear image cache if requested or if no specific type
      if (!type || type === "image") {
        const coverDirInfo = await FileSystem.getInfoAsync(IMAGE_DIRECTORY);
        if (coverDirInfo.exists) {
          await FileSystem.deleteAsync(IMAGE_DIRECTORY);
        }
        // Recreate the directory to ensure it exists for future caching
        await FileSystem.makeDirectoryAsync(IMAGE_DIRECTORY, {
          intermediates: true,
        });
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Error clearing cache:", error);
      return Promise.reject(error);
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
   * Generate URL for fetching cover art images
   */
  getCoverArtUrl: (id: string) => {
    const { config } = get();
    if (!config) return "";
    const params = get().generateAuthParams();
    return `${config.serverUrl}/rest/getCoverArt.view?id=${id}&${params.toString()}`;
  },

  /**
   * Generate URL for streaming audio files
   */
  getStreamUrl: (id: string) => {
    const { config } = get();
    if (!config) return "";
    const params = get().generateAuthParams();
    return `${config.serverUrl}/rest/stream.view?id=${id}&${params.toString()}`;
  },

  /**
   * Fetch a random selection of songs from the server
   * Used to populate the home screen
   */
  fetchSongs: async () => {
    const { config } = get();
    if (!config) return;

    set({ isLoading: true, error: null });

    try {
      const params = get().generateAuthParams();
      const response = await fetch(
        `${config.serverUrl}/rest/getRandomSongs.view?size=100&${params.toString()}`,
      );
      const data = await response.json();

      if (data["subsonic-response"].status === "ok") {
        // Map the server response to our Song interface
        const songs = data["subsonic-response"].randomSongs.song.map(
          (song: any) => ({
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration: song.duration,
            coverArt: song.coverArt,
          }),
        );
        set({ songs, isLoading: false });
      } else {
        throw new Error(
          data["subsonic-response"].error?.message || "Failed to fetch songs",
        );
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch songs",
        isLoading: false,
      });
    }
  },

  /**
   * Play a song by creating a new Audio.Sound instance
   * Unloads any currently playing audio first
   */
  playSong: async (song: Song) => {
    try {
      // Unload current sound to free up resources
      const { sound: currentSound } = get().playback;
      if (currentSound) {
        await currentSound.unloadAsync();
      }

      // Create a new sound object with the stream URL
      const streamUrl = get().getStreamUrl(song.id);
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true },
      );

      // Configure audio to play in background and silent mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // Update playback state
      set({
        playback: {
          isPlaying: true,
          currentSong: song,
          sound,
        },
      });
    } catch (error) {
      console.error("Error playing song:", error);
    }
  },

  /**
   * Pause the currently playing song
   */
  pauseSong: async () => {
    const { sound } = get().playback;
    if (sound) {
      await sound.pauseAsync();
      set((state) => ({
        playback: { ...state.playback, isPlaying: false },
      }));
    }
  },

  /**
   * Resume playback of a paused song
   */
  resumeSong: async () => {
    const { sound } = get().playback;
    if (sound) {
      await sound.playAsync();
      set((state) => ({
        playback: { ...state.playback, isPlaying: true },
      }));
    }
  },

  /**
   * Stop playback completely and unload the sound resource
   */
  stopSong: async () => {
    const { sound } = get().playback;
    if (sound) {
      await sound.unloadAsync();
      set({
        playback: {
          isPlaying: false,
          currentSong: null,
          sound: null,
        },
      });
    }
  },

  /**
   * Seek to a specific position in the current song
   */
  seekToPosition: async (positionMillis: number) => {
    const { sound } = get().playback;
    if (!sound) return;

    try {
      await sound.setPositionAsync(positionMillis);
    } catch (error) {
      console.error("Error seeking to position:", error);
    }
  },

  /**
   * Skip to the next song in the playlist
   */
  skipToNext: async () => {
    const { songs, playback } = get();
    if (!playback.currentSong || songs.length === 0) return;

    // Find the index of the current song
    const currentIndex = songs.findIndex(
      (song) => song.id === playback.currentSong?.id,
    );

    // Return if we're at the end of the playlist or song not found
    if (currentIndex === -1 || currentIndex === songs.length - 1) return;

    // Play the next song
    const nextSong = songs[currentIndex + 1];
    await get().playSong(nextSong);
  },

  /**
   * Skip to the previous song in the playlist
   */
  skipToPrevious: async () => {
    const { songs, playback } = get();
    if (!playback.currentSong || songs.length === 0) return;

    // Find the index of the current song
    const currentIndex = songs.findIndex(
      (song) => song.id === playback.currentSong?.id,
    );

    // Return if we're at the beginning of the playlist or song not found
    if (currentIndex === -1 || currentIndex === 0) return;

    // Play the previous song
    const previousSong = songs[currentIndex - 1];
    await get().playSong(previousSong);
  },

  /**
   * Seek forward 10 seconds in the current song
   */
  seekForward: async () => {
    const { sound } = get().playback;
    if (!sound) return;

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      // Seek forward 10 seconds, but don't go beyond the end
      const newPosition = Math.min(
        status.positionMillis + 10000,
        status.durationMillis || 0,
      );
      await sound.setPositionAsync(newPosition);
    }
  },

  /**
   * Seek backward 10 seconds in the current song
   */
  seekBackward: async () => {
    const { sound } = get().playback;
    if (!sound) return;

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      // Seek backward 10 seconds, but don't go below 0
      const newPosition = Math.max(status.positionMillis - 10000, 0);
      await sound.setPositionAsync(newPosition);
    }
  },

  /**
   * Change the playback speed of the current song
   * @param speed - Playback rate (1.0 is normal speed)
   */
  setPlaybackRate: async (speed: number) => {
    const { sound } = get().playback;
    if (!sound) return;

    // The second parameter (true) maintains the pitch even when speed changes
    await sound.setRateAsync(speed, true);
  },
}));
