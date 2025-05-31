/**
 * Cache management functions and state
 */

import * as FileSystem from "expo-file-system";
import { Song, CachedFileInfo } from "./types";

// Define a single cache directory for all files
export const CACHE_DIRECTORY = FileSystem.cacheDirectory + "phonora_cache/";

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

        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          streamUrl,
          filePath,
        );

        if (downloadResult.status === 200) {
          console.log(`Successfully cached song: ${song.title}`);

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
    const imageUrl = getCoverArtUrl(imageId);
    const filePath = get().getCachedFilePath(imageId, "jpg");

    // Check if caching is enabled
    const shouldCache =
      userSettings.offlineMode || userSettings.maxCacheSize > 0;
    if (shouldCache) {
      try {
        // Download the file
        const downloadResult = await FileSystem.downloadAsync(
          imageUrl,
          filePath,
        );

        if (downloadResult.status === 200) {
          console.log(`Successfully cached image for: ${songTitle}`);
          return filePath;
        } else {
          console.error("Failed to download image:", downloadResult.status);
          return imageUrl; // Fallback to remote URL
        }
      } catch (error) {
        console.error("Error caching image:", error);
        return imageUrl; // Fallback to remote URL
      }
    } else {
      return imageUrl; // Caching disabled, return remote URL
    }
  },

  /**
   * Load cached songs from the file system
   */
  loadCachedSongs: async () => {
    try {
      const { songs } = get();
      const cachedFiles = await get().getCachedFiles();

      // Filter for audio files (.mp3)
      const audioFiles = cachedFiles.filter((file: CachedFileInfo) =>
        file.filename.endsWith(".mp3"),
      );

      // Map cached files to songs
      const cachedSongs: Song[] = [];
      for (const file of audioFiles) {
        // Extract song ID from filename (remove .mp3 extension)
        const songId = file.filename.replace(".mp3", "");

        // Find the corresponding song in the songs list
        const song = songs.find((s: Song) => s.id === songId);
        if (song) {
          cachedSongs.push(song);
        }
      }

      set({ cachedSongs });
      console.log(`Loaded ${cachedSongs.length} cached songs`);
    } catch (error) {
      console.error("Error loading cached songs:", error);
    }
  },
});
