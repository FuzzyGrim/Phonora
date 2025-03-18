import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import md5 from "md5";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

// Define cache directories
const AUDIO_DIRECTORY = FileSystem.cacheDirectory + "audio/";
const IMAGE_DIRECTORY = FileSystem.cacheDirectory + "image/";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverArt?: string;
}

interface SubsonicConfig {
  serverUrl: string;
  username: string;
  password: string;
  version: string;
}

interface PlaybackState {
  isPlaying: boolean;
  currentSong: Song | null;
  sound: Audio.Sound | null;
}

interface UserSettings {
  offlineMode: boolean;
  maxAudioCacheSize: number;
  maxImageCacheSize: number;
}

interface SubsonicState {
  config: SubsonicConfig | null;
  isAuthenticated: boolean;
  songs: Song[];
  userSettings: UserSettings;
  isLoading: boolean;
  error: string | null;
  playback: PlaybackState;
  setConfig: (config: SubsonicConfig) => void;
  clearConfig: () => void;
  generateAuthParams: () => URLSearchParams;
  fetchSongs: () => Promise<void>;
  getCoverArtUrl: (id: string) => string;
  getStreamUrl: (id: string) => string;
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

  clearCache: (type?: "audio" | "image") => Promise<void>;
  initializeStore: () => Promise<void>;
  setUserSettings: (settings: UserSettings) => Promise<void>;
}

const DEFAULT_USER_SETTINGS: UserSettings = {
  offlineMode: false,
  maxAudioCacheSize: 5,
  maxImageCacheSize: 5,
};

export const useSubsonicStore = create<SubsonicState>((set, get) => ({
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

  initializeStore: async () => {
    try {
      // Load credentials
      const credentials = await SecureStore.getItemAsync(
        "subsonic_credentials",
      );
      if (credentials) {
        const config = JSON.parse(credentials);
        set({ config, isAuthenticated: true });
      }

      // Load settings
      const settings = await AsyncStorage.getItem("user_settings");
      if (settings) {
        set({ userSettings: JSON.parse(settings) });
      }

      // If authenticated, fetch songs
      if (get().isAuthenticated) {
        get().fetchSongs();
      }
    } catch (error) {
      console.error("Error initializing store:", error);
    }
  },

  // Update setConfig to save credentials
  setConfig: async (config) => {
    try {
      await SecureStore.setItemAsync(
        "subsonic_credentials",
        JSON.stringify(config),
      );
      set({ config, isAuthenticated: true });
      get().fetchSongs();
    } catch (error) {
      console.error("Error saving credentials:", error);
    }
  },

  // Update clearConfig to delete credentials
  clearConfig: async () => {
    try {
      await SecureStore.deleteItemAsync("subsonic_credentials");
      set({ config: null, isAuthenticated: false, songs: [] });
    } catch (error) {
      console.error("Error clearing credentials:", error);
    }
  },

  setUserSettings: async (settings) => {
    try {
      await AsyncStorage.setItem("user_settings", JSON.stringify(settings));
      set({ userSettings: settings });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  },

  clearCache: async (type?: "audio" | "image") => {
    try {
      // Create directories if they don't exist to avoid errors
      if (!type || type === "audio") {
        const musicDirInfo = await FileSystem.getInfoAsync(AUDIO_DIRECTORY);
        if (musicDirInfo.exists) {
          await FileSystem.deleteAsync(AUDIO_DIRECTORY);
        }
        await FileSystem.makeDirectoryAsync(AUDIO_DIRECTORY, {
          intermediates: true,
        });
      }

      if (!type || type === "image") {
        const coverDirInfo = await FileSystem.getInfoAsync(IMAGE_DIRECTORY);
        if (coverDirInfo.exists) {
          await FileSystem.deleteAsync(IMAGE_DIRECTORY);
        }
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

  generateAuthParams: () => {
    const { config } = get();
    if (!config) return new URLSearchParams();

    const salt = Math.random().toString(36).substring(2);
    const token = md5(config.password + salt);

    return new URLSearchParams({
      u: config.username,
      t: token,
      s: salt,
      v: config.version,
      c: "subsonicapp",
      f: "json",
    });
  },

  getCoverArtUrl: (id: string) => {
    const { config } = get();
    if (!config) return "";
    const params = get().generateAuthParams();
    return `${config.serverUrl}/rest/getCoverArt.view?id=${id}&${params.toString()}`;
  },

  getStreamUrl: (id: string) => {
    const { config } = get();
    if (!config) return "";
    const params = get().generateAuthParams();
    return `${config.serverUrl}/rest/stream.view?id=${id}&${params.toString()}`;
  },

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

  playSong: async (song: Song) => {
    try {
      const { sound: currentSound } = get().playback;
      if (currentSound) {
        await currentSound.unloadAsync();
      }

      const streamUrl = get().getStreamUrl(song.id);
      const { sound } = await Audio.Sound.createAsync(
        { uri: streamUrl },
        { shouldPlay: true },
      );

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

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

  pauseSong: async () => {
    const { sound } = get().playback;
    if (sound) {
      await sound.pauseAsync();
      set((state) => ({
        playback: { ...state.playback, isPlaying: false },
      }));
    }
  },

  resumeSong: async () => {
    const { sound } = get().playback;
    if (sound) {
      await sound.playAsync();
      set((state) => ({
        playback: { ...state.playback, isPlaying: true },
      }));
    }
  },

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

  seekToPosition: async (positionMillis: number) => {
    const { sound } = get().playback;
    if (!sound) return;

    try {
      await sound.setPositionAsync(positionMillis);
    } catch (error) {
      console.error("Error seeking to position:", error);
    }
  },

  skipToNext: async () => {
    const { songs, playback } = get();
    if (!playback.currentSong || songs.length === 0) return;

    const currentIndex = songs.findIndex(
      (song) => song.id === playback.currentSong?.id,
    );
    if (currentIndex === -1 || currentIndex === songs.length - 1) return;

    const nextSong = songs[currentIndex + 1];
    await get().playSong(nextSong);
  },

  skipToPrevious: async () => {
    const { songs, playback } = get();
    if (!playback.currentSong || songs.length === 0) return;

    const currentIndex = songs.findIndex(
      (song) => song.id === playback.currentSong?.id,
    );
    if (currentIndex === -1 || currentIndex === 0) return;

    const previousSong = songs[currentIndex - 1];
    await get().playSong(previousSong);
  },

  seekForward: async () => {
    const { sound } = get().playback;
    if (!sound) return;

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      const newPosition = Math.min(
        status.positionMillis + 10000,
        status.durationMillis || 0,
      );
      await sound.setPositionAsync(newPosition);
    }
  },

  seekBackward: async () => {
    const { sound } = get().playback;
    if (!sound) return;

    const status = await sound.getStatusAsync();
    if (status.isLoaded) {
      const newPosition = Math.max(status.positionMillis - 10000, 0);
      await sound.setPositionAsync(newPosition);
    }
  },

  setPlaybackRate: async (speed: number) => {
    const { sound } = get().playback;
    if (!sound) return;

    await sound.setRateAsync(speed, true);
  },
}));
