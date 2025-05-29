/**
 * Cache Management Tests for Music Player Store
 *
 * This file tests all cache-related functionality including:
 * - Cache clearing
 * - File caching checks
 * - Song downloading and caching
 * - Image downloading and caching
 * - Cache size management
 * - Cache space management and cleanup
 */

import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import * as FileSystem from "expo-file-system";

// Mock FileSystem
jest.mock("expo-file-system", () => ({
  cacheDirectory: "/mock/cache/",
  getInfoAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe("Music Player Store - Cache Management", () => {
  const CACHE_DIRECTORY = "/mock/cache/phonora_cache/";

  beforeEach(() => {
    // Reset the store state
    useMusicPlayerStore.setState({
      config: {
        serverUrl: "https://test.example.com",
        username: "testuser",
        password: "testpass",
        version: "1.16.1",
      },
      isAuthenticated: true,
      userSettings: {
        offlineMode: false,
        maxCacheSize: 1, // 1GB
      },
      songs: [],
    });

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("clearCache", () => {
    it("should clear entire cache directory successfully", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.deleteAsync.mockResolvedValueOnce();
      mockFileSystem.makeDirectoryAsync.mockResolvedValueOnce();

      const store = useMusicPlayerStore.getState();
      await store.clearCache();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(CACHE_DIRECTORY);
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY,
        { intermediates: true },
      );
    });

    it("should handle cache directory not existing", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);

      const store = useMusicPlayerStore.getState();
      await store.clearCache();

      expect(mockFileSystem.deleteAsync).not.toHaveBeenCalled();
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY,
        { intermediates: true },
      );
    });

    it("should handle directory deletion failure and delete files individually", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.deleteAsync
        .mockRejectedValueOnce(new Error("Cannot delete directory"))
        .mockResolvedValue();
      mockFileSystem.readDirectoryAsync.mockResolvedValueOnce([
        "song1.mp3",
        "cover1.jpg",
      ]);
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true, size: 1024 } as any)
        .mockResolvedValueOnce({ exists: true, size: 512 } as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValueOnce();

      const store = useMusicPlayerStore.getState();
      await store.clearCache();

      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(3); // Directory + 2 files
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValueOnce(
        new Error("Filesystem error"),
      );

      const store = useMusicPlayerStore.getState();

      await expect(store.clearCache()).rejects.toThrow("Filesystem error");
    });
  });

  describe("isFileCached", () => {
    it("should return true for cached file with content", async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true } as any)
        .mockResolvedValueOnce({ exists: true, size: 1024 } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.isFileCached("song1", "mp3");

      expect(result).toBe(true);
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY + "song1.mp3",
      );
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY + "song1.mp3",
        { size: true },
      );
    });

    it("should return false for non-existent file", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.isFileCached("song1", "mp3");

      expect(result).toBe(false);
    });

    it("should return false for file with zero size", async () => {
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true } as any)
        .mockResolvedValueOnce({ exists: true, size: 0 } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.isFileCached("song1", "mp3");

      expect(result).toBe(false);
    });

    it("should handle errors and return false", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValueOnce(
        new Error("File access error"),
      );

      const store = useMusicPlayerStore.getState();
      const result = await store.isFileCached("song1", "mp3");

      expect(result).toBe(false);
    });
  });

  describe("getCachedFilePath", () => {
    it("should return correct cache file path", () => {
      const store = useMusicPlayerStore.getState();
      const path = store.getCachedFilePath("song1", "mp3");

      expect(path).toBe(CACHE_DIRECTORY + "song1.mp3");
    });

    it("should handle different file extensions", () => {
      const store = useMusicPlayerStore.getState();

      expect(store.getCachedFilePath("cover1", "jpg")).toBe(
        CACHE_DIRECTORY + "cover1.jpg",
      );
      expect(store.getCachedFilePath("song1", "flac")).toBe(
        CACHE_DIRECTORY + "song1.flac",
      );
    });
  });

  describe("getCacheSize", () => {
    it("should return cache directory size", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 1024 * 1024 * 50, // 50MB
      } as any);

      const store = useMusicPlayerStore.getState();
      const size = await store.getCacheSize();

      expect(size).toBe(1024 * 1024 * 50);
      expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY,
        { size: true },
      );
    });

    it("should return 0 if cache directory does not exist", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);

      const store = useMusicPlayerStore.getState();
      const size = await store.getCacheSize();

      expect(size).toBe(0);
    });

    it("should handle errors and return 0", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValueOnce(
        new Error("Access error"),
      );

      const store = useMusicPlayerStore.getState();
      const size = await store.getCacheSize();

      expect(size).toBe(0);
    });
  });

  describe("hasEnoughCacheSpace", () => {
    beforeEach(() => {
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 1 }, // 1GB
      });
    });

    it("should return true when there is enough space", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 500 * 1024 * 1024, // 500MB current
      } as any);

      const store = useMusicPlayerStore.getState();
      const hasSpace = await store.hasEnoughCacheSpace(100 * 1024 * 1024); // Request 100MB

      expect(hasSpace).toBe(true);
    });

    it("should return false when there is not enough space", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
        size: 900 * 1024 * 1024, // 900MB current
      } as any);

      const store = useMusicPlayerStore.getState();
      const hasSpace = await store.hasEnoughCacheSpace(200 * 1024 * 1024); // Request 200MB

      expect(hasSpace).toBe(false);
    });

    it("should return false when cache size limit is 0", async () => {
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 0 },
      });

      const store = useMusicPlayerStore.getState();
      const hasSpace = await store.hasEnoughCacheSpace(100 * 1024 * 1024);

      expect(hasSpace).toBe(false);
    });

    it("should handle errors and return false", async () => {
      const originalGetCacheSize = useMusicPlayerStore.getState().getCacheSize;
      const getCacheSizeSpy = jest
        .fn()
        .mockRejectedValue(new Error("Access error"));
      useMusicPlayerStore.setState({ getCacheSize: getCacheSizeSpy });

      const store = useMusicPlayerStore.getState();
      const hasSpace = await store.hasEnoughCacheSpace(100 * 1024 * 1024);

      expect(hasSpace).toBe(false);

      // Restore original method
      useMusicPlayerStore.setState({ getCacheSize: originalGetCacheSize });
    });
  });

  describe("getCachedFiles", () => {
    it("should return list of cached files with metadata", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.readDirectoryAsync.mockResolvedValueOnce([
        "song1.mp3",
        "cover1.jpg",
      ]);
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({
          exists: true,
          size: 1024 * 1024 * 5, // 5MB
          modificationTime: 1000000,
        } as any)
        .mockResolvedValueOnce({
          exists: true,
          size: 1024 * 100, // 100KB
          modificationTime: 2000000,
        } as any);

      const store = useMusicPlayerStore.getState();
      const files = await store.getCachedFiles();

      expect(files).toHaveLength(2);
      expect(files[0]).toEqual({
        path: CACHE_DIRECTORY + "song1.mp3",
        id: "song1",
        extension: "mp3",
        size: 1024 * 1024 * 5,
        modTime: 1000000,
        filename: "song1.mp3",
      });
      expect(files[1]).toEqual({
        path: CACHE_DIRECTORY + "cover1.jpg",
        id: "cover1",
        extension: "jpg",
        size: 1024 * 100,
        modTime: 2000000,
        filename: "cover1.jpg",
      });
    });

    it("should create cache directory if it does not exist", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValueOnce();

      const store = useMusicPlayerStore.getState();
      const files = await store.getCachedFiles();

      expect(files).toEqual([]);
      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY,
        { intermediates: true },
      );
    });

    it("should handle errors gracefully", async () => {
      mockFileSystem.getInfoAsync.mockRejectedValueOnce(
        new Error("Access error"),
      );

      const store = useMusicPlayerStore.getState();
      const files = await store.getCachedFiles();

      expect(files).toEqual([]);
    });

    it("should skip files that cannot be accessed", async () => {
      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.readDirectoryAsync.mockResolvedValueOnce([
        "song1.mp3",
        "corrupt.mp3",
      ]);
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({
          exists: true,
          size: 1024,
          modificationTime: 1000,
        } as any)
        .mockRejectedValueOnce(new Error("File corrupted"));

      const store = useMusicPlayerStore.getState();
      const files = await store.getCachedFiles();

      expect(files).toHaveLength(1);
      expect(files[0].filename).toBe("song1.mp3");
    });
  });

  describe("freeUpCacheSpace", () => {
    it("should delete oldest files to free up required space", async () => {
      const mockFiles = [
        {
          path: CACHE_DIRECTORY + "old.mp3",
          filename: "old.mp3",
          size: 1024 * 1024 * 5, // 5MB
          modTime: 1000,
        },
        {
          path: CACHE_DIRECTORY + "newer.mp3",
          filename: "newer.mp3",
          size: 1024 * 1024 * 3, // 3MB
          modTime: 2000,
        },
      ];

      // Mock getCachedFiles
      const originalGetCachedFiles =
        useMusicPlayerStore.getState().getCachedFiles;
      const getCachedFilesSpy = jest.fn().mockResolvedValue(mockFiles);
      useMusicPlayerStore.setState({ getCachedFiles: getCachedFilesSpy });

      // Mock getCacheSize to return current size
      const originalGetCacheSize = useMusicPlayerStore.getState().getCacheSize;
      const getCacheSizeSpy = jest.fn().mockResolvedValue(1024 * 1024 * 900); // 900MB
      useMusicPlayerStore.setState({ getCacheSize: getCacheSizeSpy });

      // Mock file existence and deletion
      mockFileSystem.getInfoAsync
        .mockResolvedValueOnce({ exists: true } as any)
        .mockResolvedValueOnce({ exists: true } as any);
      mockFileSystem.deleteAsync.mockResolvedValue();

      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 1 }, // 1GB
      });

      const store = useMusicPlayerStore.getState();
      const freedSpace = await store.freeUpCacheSpace(1024 * 1024 * 10); // Request 10MB

      expect(freedSpace).toBe(1024 * 1024 * 8); // Should delete both files = 8MB
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(2);
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY + "old.mp3",
      );
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY + "newer.mp3",
      );

      // Restore original methods
      useMusicPlayerStore.setState({
        getCachedFiles: originalGetCachedFiles,
        getCacheSize: originalGetCacheSize,
      });
    });

    it("should stop deleting when enough space is freed", async () => {
      const mockFiles = [
        {
          path: CACHE_DIRECTORY + "file1.mp3",
          filename: "file1.mp3",
          size: 1024 * 1024 * 10, // 10MB
          modTime: 1000,
        },
        {
          path: CACHE_DIRECTORY + "file2.mp3",
          filename: "file2.mp3",
          size: 1024 * 1024 * 5, // 5MB
          modTime: 2000,
        },
      ];

      const originalGetCachedFiles =
        useMusicPlayerStore.getState().getCachedFiles;
      const getCachedFilesSpy = jest.fn().mockResolvedValue(mockFiles);
      useMusicPlayerStore.setState({ getCachedFiles: getCachedFilesSpy });

      const originalGetCacheSize = useMusicPlayerStore.getState().getCacheSize;
      const getCacheSizeSpy = jest.fn().mockResolvedValue(1024 * 1024 * 500); // 500MB
      useMusicPlayerStore.setState({ getCacheSize: getCacheSizeSpy });

      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
      mockFileSystem.deleteAsync.mockResolvedValue();

      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 1 }, // 1GB
      });

      const store = useMusicPlayerStore.getState();
      const freedSpace = await store.freeUpCacheSpace(1024 * 1024 * 5); // Request 5MB

      expect(freedSpace).toBe(1024 * 1024 * 10); // Should delete only first file = 10MB
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(1);
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY + "file1.mp3",
      );

      // Restore original methods
      useMusicPlayerStore.setState({
        getCachedFiles: originalGetCachedFiles,
        getCacheSize: originalGetCacheSize,
      });
    });

    it("should handle file deletion errors gracefully", async () => {
      const mockFiles = [
        {
          path: CACHE_DIRECTORY + "locked.mp3",
          filename: "locked.mp3",
          size: 1024 * 1024 * 5, // 5MB
          modTime: 1000,
        },
      ];

      const originalGetCachedFiles =
        useMusicPlayerStore.getState().getCachedFiles;
      const getCachedFilesSpy = jest.fn().mockResolvedValue(mockFiles);
      useMusicPlayerStore.setState({ getCachedFiles: getCachedFilesSpy });

      const originalGetCacheSize = useMusicPlayerStore.getState().getCacheSize;
      const getCacheSizeSpy = jest.fn().mockResolvedValue(1024 * 1024 * 500); // 500MB
      useMusicPlayerStore.setState({ getCacheSize: getCacheSizeSpy });

      mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
      mockFileSystem.deleteAsync.mockRejectedValue(new Error("File locked"));

      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 1 }, // 1GB
      });

      const store = useMusicPlayerStore.getState();
      const freedSpace = await store.freeUpCacheSpace(1024 * 1024 * 5); // Request 5MB

      expect(freedSpace).toBe(0); // No space freed due to error
      expect(mockFileSystem.deleteAsync).toHaveBeenCalledTimes(1);

      // Restore original methods
      useMusicPlayerStore.setState({
        getCachedFiles: originalGetCachedFiles,
        getCacheSize: originalGetCacheSize,
      });
    });

    it("should return 0 if cleanup is already in progress", async () => {
      // First call should start cleanup
      const promise1 = useMusicPlayerStore.getState().freeUpCacheSpace(1024);

      // Second concurrent call should return 0 immediately
      const promise2 = useMusicPlayerStore.getState().freeUpCacheSpace(1024);

      const [, result2] = await Promise.all([promise1, promise2]);

      expect(result2).toBe(0); // Second call should return 0
    });
  });

  describe("downloadSong", () => {
    const mockSong = {
      id: "song1",
      title: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      duration: 180,
      coverArt: "cover1",
    };

    beforeEach(() => {
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 1 }, // 1GB
      });
    });

    it("should return cached path if song is already cached", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(true);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadSong(mockSong);

      expect(result).toBe(CACHE_DIRECTORY + "song1.mp3");
      expect(isFileCachedSpy).toHaveBeenCalledWith("song1", "mp3");

      // Restore original method
      useMusicPlayerStore.setState({ isFileCached: originalIsFileCached });
    });

    it("should download and cache song when caching is enabled", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const originalHasEnoughCacheSpace =
        useMusicPlayerStore.getState().hasEnoughCacheSpace;
      const hasEnoughCacheSpaceSpy = jest.fn().mockResolvedValue(true);
      useMusicPlayerStore.setState({
        hasEnoughCacheSpace: hasEnoughCacheSpaceSpy,
      });

      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.downloadAsync.mockResolvedValueOnce({
        status: 200,
      } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadSong(mockSong);

      expect(result).toBe(CACHE_DIRECTORY + "song1.mp3");
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        expect.stringContaining("/rest/stream"),
        CACHE_DIRECTORY + "song1.mp3",
      );

      // Restore original methods
      useMusicPlayerStore.setState({
        isFileCached: originalIsFileCached,
        hasEnoughCacheSpace: originalHasEnoughCacheSpace,
      });
    });

    it("should free up space when cache is full", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const originalHasEnoughCacheSpace =
        useMusicPlayerStore.getState().hasEnoughCacheSpace;
      const hasEnoughCacheSpaceSpy = jest
        .fn()
        .mockResolvedValueOnce(false) // First check: not enough space
        .mockResolvedValueOnce(true); // After cleanup: enough space
      useMusicPlayerStore.setState({
        hasEnoughCacheSpace: hasEnoughCacheSpaceSpy,
      });

      const originalFreeUpCacheSpace =
        useMusicPlayerStore.getState().freeUpCacheSpace;
      const freeUpCacheSpaceSpy = jest.fn().mockResolvedValue(1024 * 1024 * 10);
      useMusicPlayerStore.setState({ freeUpCacheSpace: freeUpCacheSpaceSpy });

      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.downloadAsync.mockResolvedValueOnce({
        status: 200,
      } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadSong(mockSong);

      expect(freeUpCacheSpaceSpy).toHaveBeenCalledWith(10 * 1024 * 1024);
      expect(result).toBe(CACHE_DIRECTORY + "song1.mp3");

      // Restore original methods
      useMusicPlayerStore.setState({
        isFileCached: originalIsFileCached,
        hasEnoughCacheSpace: originalHasEnoughCacheSpace,
        freeUpCacheSpace: originalFreeUpCacheSpace,
      });
    });

    it("should return stream URL when caching is disabled", async () => {
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 0 }, // Caching disabled
      });

      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadSong(mockSong);

      expect(result).toContain("/rest/stream");
      expect(mockFileSystem.downloadAsync).not.toHaveBeenCalled();

      // Restore original method
      useMusicPlayerStore.setState({ isFileCached: originalIsFileCached });
    });

    it("should handle download errors", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const originalHasEnoughCacheSpace =
        useMusicPlayerStore.getState().hasEnoughCacheSpace;
      const hasEnoughCacheSpaceSpy = jest.fn().mockResolvedValue(true);
      useMusicPlayerStore.setState({
        hasEnoughCacheSpace: hasEnoughCacheSpaceSpy,
      });

      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.downloadAsync.mockResolvedValueOnce({
        status: 404,
      } as any);

      const store = useMusicPlayerStore.getState();

      await expect(store.downloadSong(mockSong)).rejects.toThrow(
        "HTTP Error: 404",
      );

      // Restore original methods
      useMusicPlayerStore.setState({
        isFileCached: originalIsFileCached,
        hasEnoughCacheSpace: originalHasEnoughCacheSpace,
      });
    });

    it("should create cache directory if it does not exist", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const originalHasEnoughCacheSpace =
        useMusicPlayerStore.getState().hasEnoughCacheSpace;
      const hasEnoughCacheSpaceSpy = jest.fn().mockResolvedValue(true);
      useMusicPlayerStore.setState({
        hasEnoughCacheSpace: hasEnoughCacheSpaceSpy,
      });

      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValueOnce();
      mockFileSystem.downloadAsync.mockResolvedValueOnce({
        status: 200,
      } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadSong(mockSong);

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY,
        { intermediates: true },
      );
      expect(result).toBe(CACHE_DIRECTORY + "song1.mp3");

      // Restore original methods
      useMusicPlayerStore.setState({
        isFileCached: originalIsFileCached,
        hasEnoughCacheSpace: originalHasEnoughCacheSpace,
      });
    });
  });

  describe("downloadImage", () => {
    beforeEach(() => {
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 1 }, // 1GB
      });
    });

    it("should return cached path if image is already cached", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(true);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadImage("cover1", "Test Song");

      expect(result).toBe(CACHE_DIRECTORY + "cover1.jpg");
      expect(isFileCachedSpy).toHaveBeenCalledWith("cover1", "jpg");

      // Restore original method
      useMusicPlayerStore.setState({ isFileCached: originalIsFileCached });
    });

    it("should download and cache image when caching is enabled", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.downloadAsync.mockResolvedValueOnce({
        status: 200,
      } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadImage("cover1", "Test Song");

      expect(result).toBe(CACHE_DIRECTORY + "cover1.jpg");
      expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
        expect.stringContaining("/rest/getCoverArt"),
        CACHE_DIRECTORY + "cover1.jpg",
      );

      // Restore original method
      useMusicPlayerStore.setState({ isFileCached: originalIsFileCached });
    });

    it("should return cover art URL when caching is disabled", async () => {
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: false, maxCacheSize: 0 }, // Caching disabled
      });

      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadImage("cover1", "Test Song");

      expect(result).toContain("/rest/getCoverArt");
      expect(mockFileSystem.downloadAsync).not.toHaveBeenCalled();

      // Restore original method
      useMusicPlayerStore.setState({ isFileCached: originalIsFileCached });
    });

    it("should handle download errors", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: true,
      } as any);
      mockFileSystem.downloadAsync.mockResolvedValueOnce({
        status: 404,
      } as any);

      const store = useMusicPlayerStore.getState();

      await expect(store.downloadImage("cover1", "Test Song")).rejects.toThrow(
        "HTTP Error: 404",
      );

      // Restore original method
      useMusicPlayerStore.setState({ isFileCached: originalIsFileCached });
    });

    it("should create cache directory if it does not exist", async () => {
      const originalIsFileCached = useMusicPlayerStore.getState().isFileCached;
      const isFileCachedSpy = jest.fn().mockResolvedValue(false);
      useMusicPlayerStore.setState({ isFileCached: isFileCachedSpy });

      mockFileSystem.getInfoAsync.mockResolvedValueOnce({
        exists: false,
      } as any);
      mockFileSystem.makeDirectoryAsync.mockResolvedValueOnce();
      mockFileSystem.downloadAsync.mockResolvedValueOnce({
        status: 200,
      } as any);

      const store = useMusicPlayerStore.getState();
      const result = await store.downloadImage("cover1", "Test Song");

      expect(mockFileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
        CACHE_DIRECTORY,
        { intermediates: true },
      );
      expect(result).toBe(CACHE_DIRECTORY + "cover1.jpg");

      // Restore original method
      useMusicPlayerStore.setState({ isFileCached: originalIsFileCached });
    });
  });
});
