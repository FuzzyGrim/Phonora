/**
 * Cache management functions and state
 */

import * as FileSystem from "expo-file-system";
import { Song, CachedFileInfo } from "./types";
import { dbManager } from "./database";

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
  saveSongMetadata: (song: Song, fileSize?: number) => Promise<void>;
  initializeDatabase: () => Promise<void>;
}

/**
 * Create cache management slice
 */
export const createCacheSlice = (set: any, get: any): CacheSlice => {
  // Initialize database when the slice is created
  const initDb = async () => {
    try {
      await dbManager.init();
      console.log("Cache database initialized");
    } catch (error) {
      console.error("Failed to initialize cache database:", error);
    }
  };

  // Initialize database asynchronously
  // Initialize database when the slice is created
  initDb();

  return {
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

        // Clear database metadata
        await dbManager.clearAllCacheMetadata();

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
    isFileCached: async (
      fileId: string,
      extension: string,
    ): Promise<boolean> => {
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

        // Get songs sorted by last accessed (oldest first) from database
        const songsForCleanup = await dbManager.getSongsForCleanup();

        let freedSpace = 0;
        const deletedFiles: string[] = [];
        const deletedSongIds: string[] = [];

        for (const songRecord of songsForCleanup) {
          const filePath = get().getCachedFilePath(songRecord.id, "mp3");

          // Skip files that were already deleted in this session
          if (recentlyDeletedFiles.has(filePath)) {
            continue;
          }

          // Delete the file
          try {
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            if (fileInfo.exists) {
              await FileSystem.deleteAsync(filePath);
              const fileSize = songRecord.fileSize || fileInfo.size || 0;
              freedSpace += fileSize;
              deletedFiles.push(`${songRecord.id}.mp3`);
              deletedSongIds.push(songRecord.id);
              recentlyDeletedFiles.add(filePath);

              // Update database to mark as not cached
              await dbManager.removeSongMetadata(songRecord.id);

              console.log(
                `Deleted ${songRecord.title} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`,
              );

              // Stop if we've freed enough space
              if (freedSpace >= targetFreeSpace) {
                break;
              }
            }
          } catch (error) {
            console.error(`Error deleting file ${songRecord.id}.mp3:`, error);
          }
        }

        // Also clean up any cover art files for deleted songs
        for (const songId of deletedSongIds) {
          try {
            const coverArtPath = get().getCachedFilePath(songId, "jpg");
            const coverArtInfo = await FileSystem.getInfoAsync(coverArtPath);
            if (coverArtInfo.exists) {
              await FileSystem.deleteAsync(coverArtPath);
              console.log(`Deleted cover art for ${songId}`);
            }
          } catch (error) {
            console.warn(`Error deleting cover art for ${songId}:`, error);
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
      const { userSettings, getDownloadUrl } = get();

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

      // Get the download URL and download the song
      const downloadUrl = getDownloadUrl(song.id);
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
                return downloadUrl;
              }
            }
          }

          console.log(`Caching song: ${song.title}`);

          // Download the file
          const downloadResult = await FileSystem.downloadAsync(
            downloadUrl,
            filePath,
          );

          if (downloadResult.status === 200) {
            console.log(`Successfully cached song: ${song.title}`);

            // Get the actual file size
            const fileInfo = await FileSystem.getInfoAsync(filePath);
            const actualFileSize =
              fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;

            // Save song metadata to database
            await get().saveSongMetadata(song, actualFileSize);

            return filePath;
          } else {
            console.error("Failed to download song:", downloadResult.status);
            return downloadUrl; // Fallback to streaming
          }
        } catch (error) {
          console.error("Error caching song:", error);
          return downloadUrl; // Fallback to streaming
        }
      } else {
        return downloadUrl; // Caching disabled, return download URL
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
     * Save song metadata to database with enhanced metadata collection and normalization
     */
    saveSongMetadata: async (song: Song, fileSize: number = 0) => {
      try {
        // Generate consistent IDs
        const artistId = `artist_${song.artist.replace(/\s+/g, "_").toLowerCase()}`;
        const albumId = `album_${song.album.replace(/\s+/g, "_").toLowerCase()}_${song.artist.replace(/\s+/g, "_").toLowerCase()}`;

        // Try to save artist metadata if not already saved, or update album count
        try {
          const existingArtist = await dbManager.getCachedArtistByName(
            song.artist,
          );
          if (!existingArtist) {
            // Create a basic artist record from song data
            await dbManager.saveArtistMetadata({
              id: artistId,
              name: song.artist,
              albumCount: 1, // We'll update this as we cache more songs
              coverArt: song.coverArt,
            });
          } else {
            // Check if this is a new album for the artist
            const existingAlbumForArtist = await dbManager.getCachedAlbumByName(
              song.album,
              song.artist,
            );
            if (!existingAlbumForArtist) {
              // Increment album count for the artist
              await dbManager.saveArtistMetadata({
                ...existingArtist,
                coverArt: existingArtist.coverArt || undefined,
                albumCount: existingArtist.albumCount + 1,
              });
            }
          }
        } catch (error) {
          console.warn("Could not save artist metadata:", error);
        }

        // Try to save album metadata if not already saved, or update song count
        try {
          const existingAlbum = await dbManager.getCachedAlbumByName(
            song.album,
            song.artist,
          );
          if (!existingAlbum) {
            // Create a basic album record from song data
            await dbManager.saveAlbumMetadata({
              id: albumId,
              name: song.album,
              artist: song.artist,
              artistId: artistId,
              songCount: 1, // We'll update this as we cache more songs
              coverArt: song.coverArt,
            });
          } else {
            // Increment song count for the album
            await dbManager.saveAlbumMetadata({
              ...existingAlbum,
              coverArt: existingAlbum.coverArt || undefined,
              songCount: existingAlbum.songCount + 1,
            });
          }
        } catch (error) {
          console.warn("Could not save album metadata:", error);
        }

        // Try to save genre metadata if not already saved and genre is provided, or update song count
        let genreToSave: string | undefined = undefined;
        if (song.genre) {
          try {
            // Check if genre already exists in database
            const existingGenres = await dbManager.getAllCachedGenres();
            const existingGenre = existingGenres.find(
              (g) => g.name === song.genre,
            );

            if (!existingGenre) {
              // Create a basic genre record
              await dbManager.saveGenreMetadata({
                id: song.genre,
                name: song.genre,
                songCount: 1, // We'll update this as we cache more songs
              });
            } else {
              // Increment song count for the genre
              await dbManager.saveGenreMetadata({
                ...existingGenre,
                songCount: existingGenre.songCount + 1,
              });
            }
            genreToSave = song.genre;
          } catch (error) {
            console.warn("Could not save genre metadata:", error);
            // If we can't save the genre, don't set it for the song to avoid foreign key constraint violation
            genreToSave = undefined;
          }
        }

        // Save song metadata with foreign keys
        await dbManager.saveSongMetadata(song, fileSize, {
          artistId: artistId,
          albumId: albumId,
          genre: genreToSave,
        });

        console.log(`Saved song metadata for: ${song.title} by ${song.artist}`);
      } catch (error) {
        console.error("Error saving song metadata:", error);
        throw error;
      }
    },

    /**
     * Initialize the database
     */
    initializeDatabase: async () => {
      try {
        await dbManager.init();
        console.log("Database initialized successfully");
      } catch (error) {
        console.error("Error initializing database:", error);
      }
    },
  };
};
