import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import md5 from "md5";
import { createAudioPlayer, setAudioModeAsync, AudioStatus } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

// Define a single cache directory for all files
const CACHE_DIRECTORY = FileSystem.cacheDirectory + "phonora_cache/";

// Track if a cache cleanup operation is in progress
let cacheCleanupInProgress = false;
// Track which files have been deleted in the current session to avoid double deletion
let recentlyDeletedFiles: Set<string> = new Set();

/**
 * Utility function to shuffle an array using Fisher-Yates algorithm
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

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
 * Represents an artist in the Subsonic API
 */
export interface Artist {
  id: string;
  name: string;
}

/**
 * Represents an album in the Subsonic API
 */
export interface Album {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  coverArt?: string;
  songCount: number;
}

/**
 * Search results object
 */
export interface SearchResults {
  artists: Artist[];
  albums: Album[];
  songs: Song[];
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
  player: ReturnType<typeof createAudioPlayer> | null;
}

/**
 * User preferences for the application
 */
interface UserSettings {
  offlineMode: boolean;
  maxCacheSize: number; // in GB
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
  searchResults: SearchResults | null;
  isSearching: boolean;
  currentPlaylist: {
    source: 'search' | 'library' | 'album' | 'artist' | 'genre' | 'playlist';
    songs: Song[];
  } | null;
  isRepeat: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'one' | 'all';

  // Authentication actions
  setConfig: (config: SubsonicConfig) => void;
  clearConfig: () => void;
  generateAuthParams: () => URLSearchParams;

  // Data fetching
  fetchSongs: () => Promise<void>;
  search: (query: string) => Promise<void>;

  // URL generation
  getCoverArtUrl: (id: string) => string;
  getStreamUrl: (id: string) => string;

  // Playback control
  playSong: (song: Song) => Promise<void>;
  playSongFromSource: (song: Song, source: 'search' | 'library' | 'album' | 'artist' | 'genre' | 'playlist', sourceSongs: Song[]) => Promise<void>;
  pauseSong: () => Promise<void>;
  resumeSong: () => Promise<void>;
  stopSong: () => Promise<void>;
  seekToPosition: (positionSeconds: number) => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekForward: () => Promise<void>;
  seekBackward: () => Promise<void>;
  setPlaybackRate: (speed: number) => Promise<void>;

  // Repeat and Shuffle controls
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: 'off' | 'one' | 'all') => void;

  // Cache management
  clearCache: () => Promise<void>;
  isFileCached: (fileId: string, extension: string) => Promise<boolean>;
  getCachedFilePath: (fileId: string, extension: string) => string;
  downloadSong: (song: Song) => Promise<string>;
  downloadImage: (imageId: string, songTitle: string) => Promise<string>;
  getCacheSize: () => Promise<number>;
  hasEnoughCacheSpace: (sizeInBytes: number) => Promise<boolean>;
  getCachedFiles: () => Promise<Array<{ path: string; id: string; extension: string; size: number; modTime: number; filename: string }>>;
  freeUpCacheSpace: (requiredSpace: number) => Promise<number>;

  // Initialization
  initializeStore: () => Promise<void>;

  // Settings management
  setUserSettings: (settings: UserSettings) => Promise<void>;
}

// Default settings when no user preferences are saved
const DEFAULT_USER_SETTINGS: UserSettings = {
  offlineMode: false,
  maxCacheSize: 10, // 10 GB
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
  isSearching: false,
  error: null,
  searchResults: null,
  currentPlaylist: null,
  isRepeat: false,
  isShuffle: false,
  repeatMode: 'off',
  playback: {
    isPlaying: false,
    currentSong: null,
    player: null,
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
   * Clear all cached files to free up storage space
   */
  clearCache: async () => {
    try {
      // Check if the cache directory exists
      const cacheInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (cacheInfo.exists) {
        try {
          // Try to delete the entire directory first
          await FileSystem.deleteAsync(CACHE_DIRECTORY);
        } catch (deleteError) {
          console.log("Could not delete the entire cache directory, trying file by file:", deleteError);
          
          // If deleting the whole directory fails, try deleting individual files
          try {
            const files = await FileSystem.readDirectoryAsync(CACHE_DIRECTORY);
            for (const file of files) {
              const filePath = CACHE_DIRECTORY + file;
              try {
                const fileInfo = await FileSystem.getInfoAsync(filePath, { size: true });
                if (fileInfo.exists) {
                  await FileSystem.deleteAsync(filePath);
                  // Display size in MB for better readability
                  const fileSize = (fileInfo as any).size || 0;
                  console.log(`Deleted cached file: ${file} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
                }
              } catch (fileDeleteError) {
                console.log(`Could not delete file ${file}:`, fileDeleteError);
                // Continue with next file
              }
            }
          } catch (readDirError) {
            console.error("Error reading cache directory:", readDirError);
          }
        }
      }

      // Make sure the cache directory exists for future use
      try {
        // Recreate the directory to ensure it exists for future caching
        await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, {
          intermediates: true,
        });
      } catch (mkdirError) {
        console.error("Error creating cache directory:", mkdirError);
      }

      return Promise.resolve();
    } catch (error) {
      console.error("Error clearing cache:", error);
      return Promise.reject(error);
    }
  },

  /**
   * Get the total size of the cache directory in bytes
   */
  getCacheSize: async () => {
    try {
      const cacheInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY, { size: true });
      if (!cacheInfo.exists) {
        return 0;
      }
      return cacheInfo.size || 0;
    } catch (error) {
      console.error("Error getting cache size:", error);
      return 0;
    }
  },

  /**
   * Check if there's enough space in the cache for a new file of the given size
   * @param sizeInBytes Estimated size of the new file in bytes
   * @returns True if there's enough space, false otherwise
   */
  hasEnoughCacheSpace: async (sizeInBytes: number) => {
    const { userSettings } = get();
    
    // If cache size limit is 0, caching is disabled
    if (userSettings.maxCacheSize <= 0) {
      return false;
    }
    
    try {
      // Get current cache size
      const currentCacheSize = await get().getCacheSize();
      
      // Convert maxCacheSize from GB to bytes (1GB = 1024^3 bytes)
      const maxCacheSizeInBytes = userSettings.maxCacheSize * 1024 * 1024 * 1024;
      
      // Check if adding the new file would exceed the limit
      const hasSpace = (currentCacheSize + sizeInBytes) <= maxCacheSizeInBytes;
      
      // Log cache usage info
      const usagePercentage = ((currentCacheSize / maxCacheSizeInBytes) * 100).toFixed(1);
      console.log(`Cache usage: ${(currentCacheSize / (1024 * 1024)).toFixed(2)}MB / ${userSettings.maxCacheSize.toFixed(2)}GB (${usagePercentage}%)`);
      
      return hasSpace;
    } catch (error) {
      console.error("Error checking cache space:", error);
      return false;
    }
  },

  /**
   * Get metadata for all cached files including creation time and size
   * @returns Array of cached file info objects sorted by creation time (oldest first)
   */
  getCachedFiles: async () => {
    try {
      // First check if the directory exists
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (!dirInfo.exists) {
        // Create the directory if it doesn't exist
        await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
        return []; // Return empty array since we just created the directory
      }
      
      const files = await FileSystem.readDirectoryAsync(CACHE_DIRECTORY);
      
      // Get info for each file including creation date and size
      const fileInfos = [];
      for (const filename of files) {
        try {
          const filePath = CACHE_DIRECTORY + filename;
          const fileInfo = await FileSystem.getInfoAsync(filePath, { size: true });
          
          if (fileInfo.exists) {
            // Extract the file ID and extension
            const match = filename.match(/(.+)\.([^.]+)$/);
            const fileId = match ? match[1] : filename;
            const extension = match ? match[2] : '';
            
            // FileSystem.getInfoAsync with size:true returns modificationTime and size
            // but the types don't include these, so we need to cast
            const fileInfoWithMeta = fileInfo as any;
            
            fileInfos.push({
              path: filePath,
              id: fileId,
              extension,
              size: fileInfoWithMeta.size || 0,
              modTime: fileInfoWithMeta.modificationTime || 0,
              filename
            });
          }
        } catch (fileError) {
          console.log(`Error getting info for file ${filename}:`, fileError);
          // Skip this file and continue with others
        }
      }
      
      // Sort files by modification time (oldest first)
      return fileInfos.sort((a, b) => a.modTime - b.modTime);
    } catch (error) {
      console.error("Error getting cached files:", error);
      return [];
    }
  },

  /**
   * Free up space in the cache by deleting oldest files
   * @param requiredSpace Space needed in bytes
   */
  freeUpCacheSpace: async (requiredSpace: number) => {
    if (cacheCleanupInProgress) {
      console.log("Cache cleanup already in progress, skipping duplicate cleanup");
      return 0; // Return 0 to indicate no additional space was freed
    }

    try {
      cacheCleanupInProgress = true;
      
      let freedSpace = 0;
      const { userSettings } = get();
      const cachedFiles = await get().getCachedFiles();
      
      // Calculate how much space we need to free
      const currentCacheSize = await get().getCacheSize();
      const maxCacheSizeInBytes = userSettings.maxCacheSize * 1024 * 1024 * 1024;
      
      // We need to free enough space for the new file AND to bring the total under the limit
      const targetFreeSpace = Math.max(
        requiredSpace,
        currentCacheSize + requiredSpace - maxCacheSizeInBytes
      );
      
      console.log(`Current cache: ${(currentCacheSize / (1024 * 1024)).toFixed(2)} MB, ` + 
                  `Max cache: ${(maxCacheSizeInBytes / (1024 * 1024)).toFixed(2)} MB, ` +
                  `Need to free: ${(targetFreeSpace / (1024 * 1024)).toFixed(2)} MB`);
      
      // Clear recently deleted files set at the start of each cleanup session
      recentlyDeletedFiles.clear();
      
      // Delete files until we have freed enough space
      for (const file of cachedFiles) {
        // Skip deleting the file if we've already freed enough space
        if (freedSpace >= targetFreeSpace) {
          break;
        }
        
        // Skip files we've already tried to delete in this session
        if (recentlyDeletedFiles.has(file.path)) {
          console.log(`Already attempted to delete ${file.filename}, skipping`);
          continue;
        }
        
        // Mark this file as processed
        recentlyDeletedFiles.add(file.path);
        
        // Check if file exists before attempting to delete it
        const fileExists = await FileSystem.getInfoAsync(file.path);
        if (fileExists.exists) {
          try {
            // Delete the file
            await FileSystem.deleteAsync(file.path);
            freedSpace += file.size;
            console.log(`Freed up ${(file.size / (1024 * 1024)).toFixed(2)} MB by deleting ${file.filename}`);
          } catch (deleteError) {
            console.log(`Could not delete file ${file.filename}:`, deleteError);
            // Continue with next file rather than aborting the whole operation
          }
        } else {
          console.log(`File ${file.filename} no longer exists, skipping`);
        }
      }
      
      return freedSpace;
    } catch (error) {
      console.error("Error freeing up cache space:", error);
      return 0;
    } finally {
      // Reset the lock when we're done, regardless of success or failure
      cacheCleanupInProgress = false;
    }
  },

  /**
   * Check if a file is already cached
   */
  isFileCached: async (fileId: string, extension: string) => {
    try {
      const filePath = get().getCachedFilePath(fileId, extension);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      // Verify that the file exists AND has content (size > 0)
      if (fileInfo.exists) {
        // Optional: Check if the file has content by getting its size
        const fileWithSize = await FileSystem.getInfoAsync(filePath, { size: true });
        const fileSize = (fileWithSize as any).size || 0;
        
        // Consider a file correctly cached only if it has content
        return fileSize > 0;
      }
      return false;
    } catch (error) {
      console.error(`Error checking if file is cached (${fileId}.${extension}):`, error);
      return false;
    }
  },

  /**
   * Get the local path for a cached file
   */
  getCachedFilePath: (fileId: string, extension: string) => {
    return CACHE_DIRECTORY + fileId + "." + extension;
  },

  /**
   * Download and cache a song for offline playback
   */
  downloadSong: async (song: Song) => {
    const { userSettings } = get();

    try {
      // If already cached, return the cached path
      if (await get().isFileCached(song.id, "mp3")) {
        return get().getCachedFilePath(song.id, "mp3");
      }
    } catch (cacheCheckError) {
      console.log(`Error checking if song is cached for ${song.title}:`, cacheCheckError);
      // Continue with downloading even if there was an error checking the cache
    }

    // Ensure directory exists
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
      }
    } catch (dirError) {
      console.error(`Error ensuring cache directory exists for song ${song.title}:`, dirError);
      // Create a new attempt to make the directory
      try {
        await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
      } catch (retryError) {
        console.error(`Failed to create cache directory on retry:`, retryError);
        // If we can't create the directory, we can't cache the file
        return get().getStreamUrl(song.id);
      }
    }

    // Get the stream URL and download the song
    const streamUrl = get().getStreamUrl(song.id);
    const filePath = get().getCachedFilePath(song.id, "mp3");

    // Check if caching is enabled
    const shouldCache = userSettings.offlineMode || userSettings.maxCacheSize > 0;
    if (shouldCache) {
      try {
        // Estimate the file size - we'll use 10MB as a conservative estimate for an audio file
        // This could be improved by getting the Content-Length header from a HEAD request
        const estimatedSizeInBytes = 10 * 1024 * 1024; // 10MB
        
        // Only proceed with caching if caching size is greater than 0
        if (userSettings.maxCacheSize > 0) {
          // Check if we have enough space in the cache
          const hasSpace = await get().hasEnoughCacheSpace(estimatedSizeInBytes);
          
          if (!hasSpace) {
            // Try to free up space by deleting older files
            const freedSpace = await get().freeUpCacheSpace(estimatedSizeInBytes);
            console.log(`Freed ${(freedSpace / (1024 * 1024)).toFixed(2)} MB of cache space`);
            
            // Verify we now have enough space
            const recheckedSpace = await get().hasEnoughCacheSpace(estimatedSizeInBytes);
            if (!recheckedSpace && !userSettings.offlineMode) {
              console.log("Still not enough cache space after cleanup, using stream URL");
              return streamUrl;
            }
          }
        }
        
        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          streamUrl,
          filePath
        );

        if (downloadResult.status === 200) {
          console.log(`Song cached successfully: ${song.title}`);
          return filePath;
        } else {
          throw new Error(`HTTP Error: ${downloadResult.status}`);
        }
        } catch (error) {
        console.error(`Failed to cache song: ${song.title}`, error);
        throw error;
      }
    }

    // If offline mode is disabled or cache size is 0, don't cache
    return streamUrl;
  },

  /**
   * Download and cache an image for offline viewing
   */
  downloadImage: async (imageId: string, songTitle: string) => {
    const { userSettings } = get();

    try {
      // If already cached, return the cached path
      if (await get().isFileCached(imageId, "jpg")) {
        console.log(`Image already cached: ${songTitle}`);
        return get().getCachedFilePath(imageId, "jpg");
      }
    } catch (cacheCheckError) {
      console.log(`Error checking if image is cached for ${songTitle}:`, cacheCheckError);
      // Continue with downloading even if there was an error checking the cache
    }

    // Log that we're starting to download
    console.log(`Starting background download: ${songTitle}`);

    // Ensure directory exists
    try {
      const dirInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
      }
    } catch (dirError) {
      console.error(`Error ensuring cache directory exists for image ${songTitle}:`, dirError);
      // Create a new attempt to make the directory
      try {
        await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
      } catch (retryError) {
        console.error(`Failed to create cache directory on retry:`, retryError);
        // If we can't create the directory, we can't cache the file
        return get().getCoverArtUrl(imageId);
      }
    }

    // Get the cover art URL and download the image
    const imageUrl = get().getCoverArtUrl(imageId);
    const filePath = get().getCachedFilePath(imageId, "jpg");

    // Check if caching is enabled
    const shouldCache = userSettings.offlineMode || userSettings.maxCacheSize > 0;
    if (shouldCache) {
      try {
        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          imageUrl,
          filePath
        );

        if (downloadResult.status === 200) {
          console.log(`Image cached successfully: ${songTitle}`);
          return filePath;
        } else {
          throw new Error(`HTTP Error: ${downloadResult.status}`);
        }
      } catch (error) {
        console.error(`Failed to cache image ${imageId}:`, error);
        throw error;
      }
    }

    // If offline mode is disabled or cache size is 0, don't cache
    return imageUrl;
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
   * Search for songs, albums, and artists
   */
  search: async (query: string) => {
    const { config } = get();
    if (!config || !query.trim()) {
      set({ searchResults: null, isSearching: false });
      return;
    }

    set({ isSearching: true, error: null });

    try {
      const params = get().generateAuthParams();
      const response = await fetch(
        `${config.serverUrl}/rest/search3.view?query=${encodeURIComponent(query)}&artistCount=20&albumCount=20&songCount=50&${params.toString()}`,
      );
      const data = await response.json();

      if (data["subsonic-response"].status === "ok") {
        const searchData = data["subsonic-response"].searchResult3;
        
        // Create empty arrays if any part of the response is missing
        const artists = searchData.artist ? searchData.artist.map((artist: any) => ({
          id: artist.id,
          name: artist.name,
        })) : [];
        
        const albums = searchData.album ? searchData.album.map((album: any) => ({
          id: album.id,
          name: album.name,
          artist: album.artist,
          artistId: album.artistId,
          coverArt: album.coverArt,
          songCount: album.songCount || 0,
        })) : [];
        
        const songs = searchData.song ? searchData.song.map((song: any) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          coverArt: song.coverArt,
        })) : [];

        set({
          searchResults: { artists, albums, songs },
          isSearching: false
        });
      } else {
        throw new Error(
          data["subsonic-response"].error?.message || "Search failed"
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      set({
        error: error instanceof Error ? error.message : "Search failed",
        isSearching: false
      });
    }
  },

  /**
   * Play a song by creating a new Audio.Sound instance
   * Unloads any currently playing audio first
   * Downloads and caches the song if not already cached
   */
  playSong: async (song: Song) => {
    try {
      // Stop and release current player to free up resources
      const { player: currentPlayer } = get().playback;
      if (currentPlayer) {
        // First pause the player to immediately stop the sound
        currentPlayer.pause();
        // Make sure to remove any existing event listeners
        currentPlayer.removeAllListeners('playbackStatusUpdate');
        // Then remove it to free up resources
        currentPlayer.remove();
      }

      // Update state to show we're loading
      set(state => ({
        playback: {
          ...state.playback,
          isPlaying: false,
          currentSong: song
        }
      }));

      // Get audio source - either cached or streamed
      let audioSource;
      const { userSettings } = get();

      // Check if the song is cached
      const isCached = await get().isFileCached(song.id, "mp3");
      
      // Handle offline mode restriction
      if (userSettings.offlineMode && !isCached) {
        throw new Error("Cannot play song in offline mode: Song not cached");
      }

      // Cache handling section
      if (userSettings.maxCacheSize > 0) {
        // Start a promise to handle the audio caching
        // For new songs, we'll first perform cache cleanup once if needed
        const audioCachePromise = isCached 
          ? Promise.resolve(get().getCachedFilePath(song.id, "mp3")) 
          : get().downloadSong(song).catch(err => {
              console.warn(`Background audio caching failed for ${song.title}:`, err);
              return get().getStreamUrl(song.id);
            });
        
        // If the song has cover art, cache it also
        let imageCachePromise = Promise.resolve();
        if (song.coverArt) {
          const isImageCached = await get().isFileCached(song.coverArt, "jpg");
          if (!isImageCached) {
            // Download image in the background, don't await
            // Image download will skip cache management and use the song's cleanup
            imageCachePromise = get().downloadImage(song.coverArt, song.title).then(() => {})
              .catch(err => console.warn(`Background image caching failed for ${song.coverArt}:`, err));
          }
        }

        // Start both downloads in parallel but don't wait for image
        if (isCached) {
          // Use cached audio immediately
          const cachedPath = get().getCachedFilePath(song.id, "mp3");
          audioSource = { uri: cachedPath };
          console.log(`Playing cached song: ${song.title}`);
          
          // Let image download in background
          imageCachePromise.catch(() => {});
        } else {
          // Use streaming URL while waiting for download
          const streamUrl = get().getStreamUrl(song.id);
          audioSource = { uri: streamUrl };
          
          // Let both downloads happen in background
          Promise.all([audioCachePromise, imageCachePromise])
            .catch(() => {}) // Ignore errors to prevent app crashes
            .finally(() => console.log(`Background caching operations completed for ${song.title}`));
        }
      } else {
        // Caching is disabled, use streaming URL
        audioSource = { uri: get().getStreamUrl(song.id) };
      }

      // Create a new audio player
      const player = createAudioPlayer(audioSource);

      // Configure audio to play in background and silent mode
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      // Set up a listener for playback status updates
      const handlePlaybackStatusUpdate = (status: AudioStatus) => {
        // When the song reaches the end (status.didJustFinish will be true)
        if (status.didJustFinish) {
          console.log(`Song finished: ${song.title}`);
          // Check currentPlaylist state before calling skipToNext
          const { currentPlaylist, repeatMode, isShuffle } = get();
          console.log("Song finished - currentPlaylist state:", { 
            hasPlaylist: !!currentPlaylist,
            playlistLength: currentPlaylist?.songs?.length || 0,
            repeatMode,
            isShuffle
          });
          // Auto-play next song (handles repeat and shuffle logic)
          get().skipToNext();
        }
      };

      // Add the event listener to the player
      player.addListener('playbackStatusUpdate', handlePlaybackStatusUpdate);

      // Play the song
      player.play();

      // Update playback state
      set({
        playback: {
          isPlaying: true,
          currentSong: song,
          player,
        },
      });
    } catch (error) {
      console.error("Error playing song:", error);
      // Reset playback state on error
      set(state => ({
        playback: {
          ...state.playback,
          isPlaying: false,
        },
        error: error instanceof Error ? error.message : "Failed to play song"
      }));
    }
  },

  /**
   * Play a song from a specific source (search results, library, album, etc.)
   * Sets the current playlist source for proper next/previous navigation
   */
  playSongFromSource: async (song: Song, source: 'search' | 'library' | 'album' | 'artist' | 'genre' | 'playlist', sourceSongs: Song[]) => {
    // Set the current playlist source
    set({
      currentPlaylist: {
        source,
        songs: sourceSongs
      }
    });
    
    // Then play the song using the regular playSong method
    await get().playSong(song);
  },

  /**
   * Pause the currently playing song
   */
  pauseSong: async () => {
    const { player } = get().playback;
    if (player) {
      player.pause();
      set((state) => ({
        playback: { ...state.playback, isPlaying: false },
      }));
    }
  },

  /**
   * Resume playback of a paused song
   */
  resumeSong: async () => {
    const { player } = get().playback;
    if (player) {
      player.play();
      set((state) => ({
        playback: { ...state.playback, isPlaying: true },
      }));
    }
  },

  /**
   * Stop playback completely and release the player resource
   */
  stopSong: async () => {
    const { player } = get().playback;
    if (player) {
      // First pause the player to immediately stop the sound
      player.pause();
      // Then remove it to free up resources
      player.remove();
      set({
        playback: {
          isPlaying: false,
          currentSong: null,
          player: null,
        },
      });
    }
  },

  /**
   * Seek to a specific position in the current song
   */
  seekToPosition: async (positionSeconds: number) => {
    const { player } = get().playback;
    if (!player) {
      console.log('No player available for seeking');
      return;
    }

    try {
      console.log('Current position before seek:', player.currentTime, 'seconds');
      console.log('Attempting to seek to:', positionSeconds, 'seconds');
      console.log('Song duration:', player.duration, 'seconds');
      
      // Ensure we don't seek beyond the song duration
      const clampedPosition = Math.min(Math.max(positionSeconds, 0), player.duration || positionSeconds);
      
      await player.seekTo(clampedPosition);
      
      // Wait a bit and check the new position
      setTimeout(() => {
        if (player) {
          console.log('Position after seek:', player.currentTime, 'seconds');
        }
      }, 200);
      
      console.log('Seek completed successfully');
    } catch (error) {
      console.error("Error seeking to position:", error);
    }
  },

  /**
   * Skip to the next song in the playlist
   */
  skipToNext: async () => {
    const { currentPlaylist, playback, songs, repeatMode, isShuffle } = get();
    console.log("skipToNext called", { 
      hasSong: !!playback.currentSong, 
      hasPlaylist: !!currentPlaylist,
      playlistLength: currentPlaylist?.songs?.length || 0,
      globalSongsLength: songs?.length || 0,
      repeatMode,
      isShuffle
    });
    
    // Check if we have a current song
    if (!playback.currentSong) {
      console.log("skipToNext returning early: No current song");
      return;
    }

    // Handle repeat one mode - just replay the same song
    if (repeatMode === 'one') {
      console.log("Repeat one mode: replaying current song");
      await get().playSong(playback.currentSong);
      return;
    }

    // Get the songs list to work with
    const songsToUse = currentPlaylist?.songs || songs;
    if (!songsToUse || songsToUse.length === 0) {
      console.log("skipToNext returning: No songs available");
      return;
    }

    // Find the index of the current song
    const currentIndex = songsToUse.findIndex(
      (song) => song.id === playback.currentSong?.id,
    );

    if (currentIndex === -1) {
      console.log("skipToNext returning: Current song not found in list");
      return;
    }

    let nextSong: Song | null = null;

    if (isShuffle) {
      // In shuffle mode, pick a random song (excluding current song)
      const availableSongs = songsToUse.filter((_, index) => index !== currentIndex);
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        nextSong = availableSongs[randomIndex];
        console.log(`Playing random song: ${nextSong.title}`);
      }
    } else {
      // Normal mode: play next song in order
      if (currentIndex < songsToUse.length - 1) {
        nextSong = songsToUse[currentIndex + 1];
        console.log(`Playing next song in order: ${nextSong.title}`);
      } else if (repeatMode === 'all') {
        // If we're at the end and repeat all is on, go back to the beginning
        nextSong = songsToUse[0];
        console.log(`Repeating playlist, playing first song: ${nextSong.title}`);
      }
    }

    // Play the next song if we found one
    if (nextSong) {
      await get().playSong(nextSong);
    } else {
      console.log("skipToNext: No next song to play");
    }
  },

  /**
   * Skip to the previous song in the playlist
   */
  skipToPrevious: async () => {
    const { currentPlaylist, playback, songs, repeatMode, isShuffle } = get();
    
    // Check if we have a current song
    if (!playback.currentSong) {
      return;
    }

    // Handle repeat one mode - just replay the same song
    if (repeatMode === 'one') {
      console.log("Repeat one mode: replaying current song");
      await get().playSong(playback.currentSong);
      return;
    }

    // Get the songs list to work with
    const songsToUse = currentPlaylist?.songs || songs;
    if (!songsToUse || songsToUse.length === 0) {
      return;
    }

    // Find the index of the current song
    const currentIndex = songsToUse.findIndex(
      (song) => song.id === playback.currentSong?.id,
    );

    if (currentIndex === -1) {
      return;
    }

    let previousSong: Song | null = null;

    if (isShuffle) {
      // In shuffle mode, pick a random song (excluding current song)
      const availableSongs = songsToUse.filter((_, index) => index !== currentIndex);
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        previousSong = availableSongs[randomIndex];
      }
    } else {
      // Normal mode: play previous song in order
      if (currentIndex > 0) {
        previousSong = songsToUse[currentIndex - 1];
      } else if (repeatMode === 'all') {
        // If we're at the beginning and repeat all is on, go to the last song
        previousSong = songsToUse[songsToUse.length - 1];
      }
    }

    // Play the previous song if we found one
    if (previousSong) {
      await get().playSong(previousSong);
    }
  },

  /**
   * Seek forward 10 seconds in the current song
   */
  seekForward: async () => {
    const { player } = get().playback;
    if (!player) return;

    // Get current time in seconds and add 10 seconds
    const currentTime = player.currentTime;
    const duration = player.duration;
    
    // Seek forward 10 seconds, but don't go beyond the end
    const newPosition = Math.min(currentTime + 10, duration || 0);
    await player.seekTo(newPosition);
  },

  /**
   * Seek backward 10 seconds in the current song
   */
  seekBackward: async () => {
    const { player } = get().playback;
    if (!player) return;

    // Get current time in seconds and subtract 10 seconds
    const currentTime = player.currentTime;
    
    // Seek backward 10 seconds, but don't go below 0
    const newPosition = Math.max(currentTime - 10, 0);
    await player.seekTo(newPosition);
  },

  /**
   * Change the playback speed of the current song
   * @param speed - Playback rate (1.0 is normal speed)
   */
  setPlaybackRate: async (speed: number) => {
    const { player } = get().playback;
    if (!player) return;

    // Use the new setPlaybackRate method with pitch correction
    player.setPlaybackRate(speed, 'medium');
  },

  /**
   * Toggle repeat mode: off -> all -> one -> off
   */
  toggleRepeat: () => {
    set((state) => {
      let newRepeatMode: 'off' | 'one' | 'all';
      let newIsRepeat: boolean;
      
      switch (state.repeatMode) {
        case 'off':
          newRepeatMode = 'all';
          newIsRepeat = true;
          break;
        case 'all':
          newRepeatMode = 'one';
          newIsRepeat = true;
          break;
        case 'one':
          newRepeatMode = 'off';
          newIsRepeat = false;
          break;
        default:
          newRepeatMode = 'off';
          newIsRepeat = false;
      }
      
      return {
        repeatMode: newRepeatMode,
        isRepeat: newIsRepeat,
        // If enabling repeat, disable shuffle
        isShuffle: newIsRepeat ? false : state.isShuffle,
      };
    });
  },

  /**
   * Set repeat mode directly
   */
  setRepeatMode: (mode: 'off' | 'one' | 'all') => {
    set((state) => ({
      repeatMode: mode,
      isRepeat: mode !== 'off',
      // If enabling repeat, disable shuffle
      isShuffle: mode !== 'off' ? false : state.isShuffle,
    }));
  },

  /**
   * Toggle shuffle mode
   */
  toggleShuffle: () => {
    set((state) => ({
      isShuffle: !state.isShuffle,
      // If enabling shuffle, disable repeat
      isRepeat: !state.isShuffle ? false : state.isRepeat,
    }));
  },
}));
