/**
 * Cache management functions and state
 */

import * as FileSystem from "expo-file-system";
import { Song, CachedFileInfo } from "./types";

// Define a single cache directory for all files
export const CACHE_DIRECTORY = FileSystem.cacheDirectory + "phonora_cache/";
export const METADATA_FILE = CACHE_DIRECTORY + "metadata.json";

// Track if a cache cleanup operation is in progress
let cacheCleanupInProgress = false;
// Track which files have been deleted in the current session to avoid double deletion
let recentlyDeletedFiles: Set<string> = new Set();

/**
 * Cache slice interface
 */
export interface CacheSlice {
  // State
  cachedSongs: Song[];

  // Actions
  clearCache: () => Promise<void>;
  isFileCached: (fileId: string, extension: string) => Promise<boolean>;
  getCachedFilePath: (fileId: string, extension: string) => string;
  downloadSong: (song: Song) => Promise<string>;
  downloadImage: (imageId: string, songTitle: string) => Promise<string>;
  getCacheSize: () => Promise<number>;
  hasEnoughCacheSpace: (sizeInBytes: number) => Promise<boolean>;
  getCachedFiles: () => Promise<CachedFileInfo[]>;
  freeUpCacheSpace: (requiredSpace: number) => Promise<number>;
  loadCachedSongs: () => Promise<void>;
  saveSongMetadata: (song: Song) => Promise<void>;
  loadSongMetadata: () => Promise<{ [key: string]: Partial<Song> }>;
}

/**
 * Create cache management slice
 */
export const createCacheSlice = (set: any, get: any): CacheSlice => ({
  // Initial state
  cachedSongs: [],

  /**
   * Clear all cached files and data
   */
  clearCache: async () => {
    try {
      // Delete the entire cache directory
      const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (directoryInfo.exists) {
        await FileSystem.deleteAsync(CACHE_DIRECTORY);
        console.log("Cache cleared successfully");
      }

      // Clear cached songs list
      set({ cachedSongs: [] });

      // Reset tracking variables
      recentlyDeletedFiles.clear();
      cacheCleanupInProgress = false;
    } catch (error) {
      console.error("Error clearing cache:", error);
    }
  },

  /**
   * Check if a file with given ID and extension is cached
   */
  isFileCached: async (fileId: string, extension: string): Promise<boolean> => {
    try {
      const filePath = get().getCachedFilePath(fileId, extension);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      return fileInfo.exists;
    } catch (error) {
      console.warn("Error checking cached file:", error);
      return false;
    }
  },

  /**
   * Get the file path for a cached file
   */
  getCachedFilePath: (fileId: string, extension: string): string => {
    return CACHE_DIRECTORY + `${fileId}.${extension}`;
  },

  /**
   * Get the current cache size in bytes
   */
  getCacheSize: async (): Promise<number> => {
    try {
      const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (!directoryInfo.exists) {
        return 0;
      }

      const files = await FileSystem.readDirectoryAsync(CACHE_DIRECTORY);
      let totalSize = 0;

      for (const file of files) {
        try {
          const filePath = CACHE_DIRECTORY + file;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && fileInfo.size !== undefined) {
            totalSize += fileInfo.size;
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn("Could not read file size:", error);
          continue;
        }
      }

      return totalSize;
    } catch (error) {
      console.error("Error getting cache size:", error);
      return 0;
    }
  },

  /**
   * Check if there's enough cache space for a file of given size
   */
  hasEnoughCacheSpace: async (sizeInBytes: number): Promise<boolean> => {
    const { userSettings } = get();

    try {
      // Get current cache size
      const currentCacheSize = await get().getCacheSize();

      // Convert maxCacheSize from GB to bytes (1GB = 1024^3 bytes)
      const maxCacheSizeInBytes =
        userSettings.maxCacheSize * 1024 * 1024 * 1024;

      // Check if adding the new file would exceed the limit
      const hasSpace = currentCacheSize + sizeInBytes <= maxCacheSizeInBytes;

      return hasSpace;
    } catch (error) {
      console.error("Error checking cache space:", error);
      return false;
    }
  },

  /**
   * Get a list of all cached files with their metadata
   */
  getCachedFiles: async (): Promise<CachedFileInfo[]> => {
    try {
      const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (!directoryInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(CACHE_DIRECTORY);
      const cachedFiles: CachedFileInfo[] = [];

      for (const file of files) {
        try {
          const filePath = CACHE_DIRECTORY + file;
          const fileInfo = await FileSystem.getInfoAsync(filePath);
          if (fileInfo.exists && fileInfo.size !== undefined) {
            cachedFiles.push({
              filename: file,
              path: filePath,
              id: file.split(".")[0], // Extract ID from filename
              extension: file.split(".")[1] || "", // Extract extension
              size: fileInfo.size,
              modTime: fileInfo.modificationTime || 0,
            });
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn("Could not read cached file:", error);
          continue;
        }
      }

      return cachedFiles;
    } catch (error) {
      console.error("Error getting cached files:", error);
      return [];
    }
  },

  /**
   * Free up cache space by deleting old files
   */
  freeUpCacheSpace: async (requiredSpace: number): Promise<number> => {
    const { userSettings } = get();

    // Prevent concurrent cache cleanup operations
    if (cacheCleanupInProgress) {
      console.log("Cache cleanup already in progress, skipping");
      return 0;
    }

    cacheCleanupInProgress = true;

    try {
      console.log(
        `Starting cache cleanup to free ${(requiredSpace / (1024 * 1024)).toFixed(2)} MB`,
      );

      // Get all cached files sorted by modification time (oldest first)
      const cachedFiles = await get().getCachedFiles();

      // Calculate how much space we need to free
      const currentCacheSize = await get().getCacheSize();
      const maxCacheSizeInBytes =
        userSettings.maxCacheSize * 1024 * 1024 * 1024;

      // We need to free enough space for the new file AND to bring the total under the limit
      const targetFreeSpace = Math.max(
        requiredSpace,
        currentCacheSize + requiredSpace - maxCacheSizeInBytes,
      );

      console.log(
        `Current cache: ${(currentCacheSize / (1024 * 1024)).toFixed(2)} MB, ` +
          `Max cache: ${(maxCacheSizeInBytes / (1024 * 1024)).toFixed(2)} MB, ` +
          `Target to free: ${(targetFreeSpace / (1024 * 1024)).toFixed(2)} MB`,
      );

      // Sort files by modification time (oldest first)
      const sortedFiles = cachedFiles.sort(
        (a: CachedFileInfo, b: CachedFileInfo) => a.modTime - b.modTime,
      );

      let freedSpace = 0;
      const deletedFiles: string[] = [];
      const deletedSongIds: string[] = [];

      for (const file of sortedFiles) {
        // Skip files that were already deleted in this session
        if (recentlyDeletedFiles.has(file.path)) {
          continue;
        }

        // Delete the file
        try {
          await FileSystem.deleteAsync(file.path);
          freedSpace += file.size;
          deletedFiles.push(file.filename);
          recentlyDeletedFiles.add(file.path);

          // Track song IDs for metadata cleanup
          if (file.extension === "mp3") {
            deletedSongIds.push(file.id);
          }

          console.log(
            `Deleted ${file.filename} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`,
          );

          // Stop if we've freed enough space
          if (freedSpace >= targetFreeSpace) {
            break;
          }
        } catch (error) {
          console.error(`Error deleting file ${file.filename}:`, error);
        }
      }

      // Clean up metadata for deleted songs
      if (deletedSongIds.length > 0) {
        try {
          const existingMetadata = await get().loadSongMetadata();
          let metadataChanged = false;

          for (const songId of deletedSongIds) {
            if (existingMetadata[songId]) {
              delete existingMetadata[songId];
              metadataChanged = true;
            }
          }

          if (metadataChanged) {
            await FileSystem.writeAsStringAsync(
              METADATA_FILE,
              JSON.stringify(existingMetadata, null, 2),
            );
            console.log(
              `Cleaned up metadata for ${deletedSongIds.length} deleted songs`,
            );
          }
        } catch (error) {
          console.warn("Error cleaning up metadata:", error);
        }
      }

      console.log(
        `Cache cleanup completed: freed ${(freedSpace / (1024 * 1024)).toFixed(2)} MB by deleting ${deletedFiles.length} files`,
      );

      return freedSpace;
    } catch (error) {
      console.error("Error during cache cleanup:", error);
      return 0;
    } finally {
      cacheCleanupInProgress = false;
    }
  },

  /**
   * Download and cache a song
   */
  downloadSong: async (song: Song): Promise<string> => {
    const { userSettings, getStreamUrl } = get();

    // Ensure cache directory exists
    const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
    if (!directoryInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, {
        intermediates: true,
      });
    }

    // Check if already cached
    const isCached = await get().isFileCached(song.id, "mp3");
    if (isCached) {
      return get().getCachedFilePath(song.id, "mp3");
    }

    // Get the stream URL and download the song
    const streamUrl = getStreamUrl(song.id);
    const filePath = get().getCachedFilePath(song.id, "mp3");

    // Check if caching is enabled
    const shouldCache =
      userSettings.offlineMode || userSettings.maxCacheSize > 0;
    if (shouldCache) {
      try {
        // Estimate the file size - we'll use 10MB as a conservative estimate for an audio file
        // This could be improved by getting the Content-Length header from a HEAD request
        const estimatedSizeInBytes = 10 * 1024 * 1024; // 10MB

        // Only proceed with caching if caching size is greater than 0
        if (userSettings.maxCacheSize > 0) {
          // Check if there's enough space
          const hasSpace =
            await get().hasEnoughCacheSpace(estimatedSizeInBytes);
          if (!hasSpace) {
            // Try to free up space
            const freedSpace =
              await get().freeUpCacheSpace(estimatedSizeInBytes);
            console.log(
              `Freed ${(freedSpace / (1024 * 1024)).toFixed(2)} MB for ${song.title}`,
            );

            // Check again if we have enough space
            const recheckedSpace =
              await get().hasEnoughCacheSpace(estimatedSizeInBytes);
            if (!recheckedSpace && !userSettings.offlineMode) {
              console.log(
                `Still not enough space after cleanup for ${song.title}, using streaming`,
              );
              return streamUrl;
            }
          }
        }

        console.log(`Caching song: ${song.title}`);

        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          streamUrl,
          filePath,
        );

        if (downloadResult.status === 200) {
          console.log(`Successfully cached song: ${song.title}`);

          // Save song metadata
          await get().saveSongMetadata(song);

          // Add to cached songs list if not already there
          const { cachedSongs } = get();
          const isAlreadyInList = cachedSongs.some(
            (s: Song) => s.id === song.id,
          );
          if (!isAlreadyInList) {
            set((state: any) => ({
              cachedSongs: [...state.cachedSongs, song],
            }));
          }

          return filePath;
        } else {
          console.error("Failed to download song:", downloadResult.status);
          return streamUrl; // Fallback to streaming
        }
      } catch (error) {
        console.error("Error caching song:", error);
        return streamUrl; // Fallback to streaming
      }
    } else {
      return streamUrl; // Caching disabled, return stream URL
    }
  },

  /**
   * Download and cache an image (cover art)
   */
  downloadImage: async (
    imageId: string,
    songTitle: string,
  ): Promise<string> => {
    const { userSettings, getCoverArtUrl } = get();

    // Ensure cache directory exists
    const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
    if (!directoryInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, {
        intermediates: true,
      });
    }

    // Check if already cached
    const isCached = await get().isFileCached(imageId, "jpg");
    if (isCached) {
      return get().getCachedFilePath(imageId, "jpg");
    }

    // Get the image URL and download the image
    const coverArt = getCoverArtUrl(imageId);
    const filePath = get().getCachedFilePath(imageId, "jpg");

    // Check if caching is enabled
    const shouldCache =
      userSettings.offlineMode || userSettings.maxCacheSize > 0;
    if (shouldCache) {
      try {
        console.log(`Caching image for: ${songTitle}`);

        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          coverArt,
          filePath,
        );

        if (downloadResult.status === 200) {
          console.log(`Successfully cached image for: ${songTitle}`);
          return filePath;
        } else {
          console.error("Failed to download image:", downloadResult.status);
          return coverArt; // Fallback to remote URL
        }
      } catch (error) {
        console.error("Error caching image:", error);
        return coverArt; // Fallback to remote URL
      }
    } else {
      return coverArt; // Caching disabled, return remote URL
    }
  },

  /**
   * Load cached songs from the file system
   */
  loadCachedSongs: async () => {
    try {
      const cachedFiles = await get().getCachedFiles();
      const savedMetadata = await get().loadSongMetadata();

      // Filter for audio files (.mp3)
      const audioFiles = cachedFiles.filter((file: CachedFileInfo) =>
        file.filename.endsWith(".mp3"),
      );

      // Map cached files to songs using saved metadata
      const cachedSongs: Song[] = [];
      for (const file of audioFiles) {
        // Extract song ID from filename (remove .mp3 extension)
        const songId = file.filename.replace(".mp3", "");

        // Get metadata from saved metadata
        const metadata = savedMetadata[songId];
        if (metadata) {
          // Create a full song object with the cached metadata
          const song: Song = {
            id: songId,
            title: metadata.title || "Unknown Title",
            artist: metadata.artist || "Unknown Artist",
            album: metadata.album || "Unknown Album",
            coverArt: metadata.coverArt,
            duration: metadata.duration || 0,
          };
          cachedSongs.push(song);
        }
      }

      set({ cachedSongs });
      console.log(`Loaded ${cachedSongs.length} cached songs`);
    } catch (error) {
      console.error("Error loading cached songs:", error);
    }
  },

  /**
   * Save song metadata to persistent storage
   */
  saveSongMetadata: async (song: Song) => {
    try {
      // Ensure cache directory exists
      const directoryInfo = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
      if (!directoryInfo.exists) {
        await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, {
          intermediates: true,
        });
      }

      // Load existing metadata
      const existingMetadata = await get().loadSongMetadata();

      // Add or update song metadata
      existingMetadata[song.id] = {
        title: song.title,
        artist: song.artist,
        album: song.album,
        coverArt: song.coverArt,
        duration: song.duration,
      };

      // Save updated metadata
      await FileSystem.writeAsStringAsync(
        METADATA_FILE,
        JSON.stringify(existingMetadata, null, 2),
      );
    } catch (error) {
      console.error("Error saving song metadata:", error);
    }
  },

  /**
   * Load song metadata from persistent storage
   */
  loadSongMetadata: async (): Promise<{ [key: string]: Partial<Song> }> => {
    try {
      const metadataInfo = await FileSystem.getInfoAsync(METADATA_FILE);
      if (metadataInfo.exists) {
        const metadataContent =
          await FileSystem.readAsStringAsync(METADATA_FILE);
        return JSON.parse(metadataContent);
      }
    } catch (error) {
      console.warn("Error loading song metadata:", error);
    }
    return {};
  },
});
