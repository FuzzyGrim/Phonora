/**
 * Tests for store/cache.ts
 */

import * as FileSystem from 'expo-file-system';
import { createCacheSlice, CACHE_DIRECTORY } from '../../store/cache';
import { Song, CachedFileInfo } from '../../store/types';

// Mock FileSystem
jest.mock('expo-file-system');

const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('Cache Slice', () => {
    let cacheSlice: any;
    let mockSet: jest.Mock;
    let mockGet: jest.Mock;

    const mockSong: Song = {
        id: 'song123',
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        duration: 180,
        coverArt: 'cover123',
    };

    const mockUserSettings = {
        offlineMode: false,
        maxCacheSize: 1, // 1 GB
    };

    beforeEach(() => {
        mockSet = jest.fn();
        mockGet = jest.fn();
        cacheSlice = createCacheSlice(mockSet, mockGet);

        // Reset all mocks
        jest.clearAllMocks();

        // Setup default mock returns
        mockGet.mockReturnValue({
            userSettings: mockUserSettings,
            getStreamUrl: jest.fn(() => 'http://example.com/stream/song123'),
            getCoverArtUrl: jest.fn(() => 'http://example.com/cover/cover123'),
            getCachedFilePath: jest.fn((fileId: string, extension: string) =>
                CACHE_DIRECTORY + `${fileId}.${extension}`
            ),
            songs: [mockSong],
            cachedSongs: [],
        });
    });

    describe('Initial State', () => {
        it('should have correct initial state', () => {
            expect(cacheSlice.cachedSongs).toEqual([]);
        });
    });

    describe('Constants', () => {
        it('should define correct cache directory', () => {
            expect(CACHE_DIRECTORY).toBe(FileSystem.cacheDirectory + 'phonora_cache/');
        });
    });

    describe('clearCache', () => {
        it('should clear cache directory and reset state', async () => {
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);
            mockFileSystem.deleteAsync.mockResolvedValue();

            await cacheSlice.clearCache();

            expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(CACHE_DIRECTORY);
            expect(mockFileSystem.deleteAsync).toHaveBeenCalledWith(CACHE_DIRECTORY);
            expect(mockSet).toHaveBeenCalledWith({ cachedSongs: [] });
        });

        it('should handle non-existent cache directory', async () => {
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);

            await cacheSlice.clearCache();

            expect(mockFileSystem.deleteAsync).not.toHaveBeenCalled();
            expect(mockSet).toHaveBeenCalledWith({ cachedSongs: [] });
        });

        it('should handle errors gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockFileSystem.getInfoAsync.mockRejectedValue(new Error('File system error'));

            await cacheSlice.clearCache();

            expect(consoleSpy).toHaveBeenCalledWith('Error clearing cache:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('isFileCached', () => {
        it('should return true for cached files', async () => {
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);

            const result = await cacheSlice.isFileCached('song123', 'mp3');

            expect(result).toBe(true);
            expect(mockFileSystem.getInfoAsync).toHaveBeenCalledWith(
                CACHE_DIRECTORY + 'song123.mp3'
            );
        });

        it('should return false for non-cached files', async () => {
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);

            const result = await cacheSlice.isFileCached('song123', 'mp3');

            expect(result).toBe(false);
        });

        it('should handle errors and return false', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            mockFileSystem.getInfoAsync.mockRejectedValue(new Error('File system error'));

            const result = await cacheSlice.isFileCached('song123', 'mp3');

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking cached file:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('getCachedFilePath', () => {
        it('should return correct file path', () => {
            const filePath = cacheSlice.getCachedFilePath('song123', 'mp3');
            expect(filePath).toBe(CACHE_DIRECTORY + 'song123.mp3');
        });

        it('should handle different file extensions', () => {
            const mp3Path = cacheSlice.getCachedFilePath('song123', 'mp3');
            const jpgPath = cacheSlice.getCachedFilePath('cover123', 'jpg');

            expect(mp3Path).toBe(CACHE_DIRECTORY + 'song123.mp3');
            expect(jpgPath).toBe(CACHE_DIRECTORY + 'cover123.jpg');
        });
    });

    describe('getCacheSize', () => {
        it('should calculate total cache size', async () => {
            mockFileSystem.getInfoAsync
                .mockResolvedValueOnce({ exists: true } as any) // Directory exists
                .mockResolvedValueOnce({ exists: true, size: 1024 } as any) // File 1
                .mockResolvedValueOnce({ exists: true, size: 2048 } as any); // File 2

            mockFileSystem.readDirectoryAsync.mockResolvedValue(['file1.mp3', 'file2.mp3']);

            const size = await cacheSlice.getCacheSize();

            expect(size).toBe(3072); // 1024 + 2048
        });

        it('should return 0 for non-existent directory', async () => {
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);

            const size = await cacheSlice.getCacheSize();

            expect(size).toBe(0);
        });

        it('should handle errors and return 0', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockFileSystem.getInfoAsync.mockRejectedValue(new Error('File system error'));

            const size = await cacheSlice.getCacheSize();

            expect(size).toBe(0);
            expect(consoleSpy).toHaveBeenCalledWith('Error getting cache size:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        it('should skip files that cannot be read', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            mockFileSystem.getInfoAsync
                .mockResolvedValueOnce({ exists: true } as any) // Directory exists
                .mockResolvedValueOnce({ exists: true, size: 1024 } as any) // File 1 readable
                .mockRejectedValueOnce(new Error('Cannot read file')); // File 2 error

            mockFileSystem.readDirectoryAsync.mockResolvedValue(['file1.mp3', 'file2.mp3']);

            const size = await cacheSlice.getCacheSize();

            expect(size).toBe(1024); // Only file1 counted
            expect(consoleSpy).toHaveBeenCalledWith('Could not read file size:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('hasEnoughCacheSpace', () => {
        beforeEach(() => {
            // Mock getCacheSize method
            mockGet.mockReturnValue({
                ...mockGet(),
                getCacheSize: jest.fn(),
            });
        });

        it('should return true when there is enough space', async () => {
            const mockGetCacheSize = mockGet().getCacheSize;
            mockGetCacheSize.mockResolvedValue(500 * 1024 * 1024); // 500 MB current

            const hasSpace = await cacheSlice.hasEnoughCacheSpace(100 * 1024 * 1024); // Want 100 MB

            expect(hasSpace).toBe(true); // 500 + 100 = 600 MB < 1 GB limit
        });

        it('should return false when there is not enough space', async () => {
            const mockGetCacheSize = mockGet().getCacheSize;
            mockGetCacheSize.mockResolvedValue(900 * 1024 * 1024); // 900 MB current

            const hasSpace = await cacheSlice.hasEnoughCacheSpace(200 * 1024 * 1024); // Want 200 MB

            expect(hasSpace).toBe(false); // 900 + 200 = 1100 MB > 1 GB limit
        });

        it('should handle errors and return false', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockGetCacheSize = mockGet().getCacheSize;
            mockGetCacheSize.mockRejectedValue(new Error('Cache size error'));

            const hasSpace = await cacheSlice.hasEnoughCacheSpace(100 * 1024 * 1024);

            expect(hasSpace).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Error checking cache space:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('getCachedFiles', () => {
        it('should return list of cached files', async () => {
            mockFileSystem.getInfoAsync
                .mockResolvedValueOnce({ exists: true } as any) // Directory exists
                .mockResolvedValueOnce({
                    exists: true,
                    size: 1024,
                    modificationTime: 1609459200000
                } as any)
                .mockResolvedValueOnce({
                    exists: true,
                    size: 2048,
                    modificationTime: 1609459300000
                } as any);

            mockFileSystem.readDirectoryAsync.mockResolvedValue(['song1.mp3', 'cover1.jpg']);

            const files = await cacheSlice.getCachedFiles();

            expect(files).toHaveLength(2);
            expect(files[0]).toEqual({
                filename: 'song1.mp3',
                path: CACHE_DIRECTORY + 'song1.mp3',
                id: 'song1',
                extension: 'mp3',
                size: 1024,
                modTime: 1609459200000,
            });
        });

        it('should return empty array for non-existent directory', async () => {
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);

            const files = await cacheSlice.getCachedFiles();

            expect(files).toEqual([]);
        });

        it('should handle files without extensions', async () => {
            mockFileSystem.getInfoAsync
                .mockResolvedValueOnce({ exists: true } as any)
                .mockResolvedValueOnce({ exists: true, size: 1024, modificationTime: 0 } as any);

            mockFileSystem.readDirectoryAsync.mockResolvedValue(['filewithoutext']);

            const files = await cacheSlice.getCachedFiles();

            expect(files[0].extension).toBe('');
        });
    });

    describe('downloadSong', () => {
        beforeEach(() => {
            mockGet.mockReturnValue({
                ...mockGet(),
                isFileCached: jest.fn(),
                getCachedFilePath: jest.fn(() => CACHE_DIRECTORY + 'song123.mp3'),
                hasEnoughCacheSpace: jest.fn(),
                freeUpCacheSpace: jest.fn(),
                getStreamUrl: jest.fn(() => 'http://example.com/stream/song123'),
            });
        });

        it('should return cached path if song is already cached', async () => {
            const mockIsFileCached = mockGet().isFileCached;
            const mockGetCachedFilePath = mockGet().getCachedFilePath;

            mockIsFileCached.mockResolvedValue(true);
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: true } as any);

            const result = await cacheSlice.downloadSong(mockSong);

            expect(result).toBe(CACHE_DIRECTORY + 'song123.mp3');
            expect(mockGetCachedFilePath).toHaveBeenCalledWith('song123', 'mp3');
        });

        it('should download and cache song when not cached', async () => {
            const mockIsFileCached = mockGet().isFileCached;
            const mockHasEnoughCacheSpace = mockGet().hasEnoughCacheSpace;

            mockIsFileCached.mockResolvedValue(false);
            mockHasEnoughCacheSpace.mockResolvedValue(true);
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);
            mockFileSystem.makeDirectoryAsync.mockResolvedValue();
            mockFileSystem.downloadAsync.mockResolvedValue({ status: 200 } as any);

            const result = await cacheSlice.downloadSong(mockSong);

            expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
                'http://example.com/stream/song123',
                CACHE_DIRECTORY + 'song123.mp3'
            );
            expect(result).toBe(CACHE_DIRECTORY + 'song123.mp3');
        });

        it('should return stream URL when caching is disabled', async () => {
            mockGet.mockReturnValue({
                ...mockGet(),
                userSettings: { offlineMode: false, maxCacheSize: 0 },
            });

            const result = await cacheSlice.downloadSong(mockSong);

            expect(result).toBe('http://example.com/stream/song123');
        });

        it('should free up space if needed', async () => {
            const mockIsFileCached = mockGet().isFileCached;
            const mockHasEnoughCacheSpace = mockGet().hasEnoughCacheSpace;
            const mockFreeUpCacheSpace = mockGet().freeUpCacheSpace;

            mockIsFileCached.mockResolvedValue(false);
            mockHasEnoughCacheSpace
                .mockResolvedValueOnce(false) // First check fails
                .mockResolvedValueOnce(true);  // Second check passes
            mockFreeUpCacheSpace.mockResolvedValue(15 * 1024 * 1024); // Freed 15MB

            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);
            mockFileSystem.makeDirectoryAsync.mockResolvedValue();
            mockFileSystem.downloadAsync.mockResolvedValue({ status: 200 } as any);

            await cacheSlice.downloadSong(mockSong);

            expect(mockFreeUpCacheSpace).toHaveBeenCalled();
            expect(mockFileSystem.downloadAsync).toHaveBeenCalled();
        });

        it('should handle download failures gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockIsFileCached = mockGet().isFileCached;
            const mockHasEnoughCacheSpace = mockGet().hasEnoughCacheSpace;

            mockIsFileCached.mockResolvedValue(false);
            mockHasEnoughCacheSpace.mockResolvedValue(true);
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);
            mockFileSystem.makeDirectoryAsync.mockResolvedValue();
            mockFileSystem.downloadAsync.mockResolvedValue({ status: 404 } as any);

            const result = await cacheSlice.downloadSong(mockSong);

            expect(result).toBe('http://example.com/stream/song123'); // Fallback to streaming
            expect(consoleSpy).toHaveBeenCalledWith('Failed to download song:', 404);
            consoleSpy.mockRestore();
        });
    });

    describe('downloadImage', () => {
        beforeEach(() => {
            mockGet.mockReturnValue({
                ...mockGet(),
                isFileCached: jest.fn(),
                getCachedFilePath: jest.fn(() => CACHE_DIRECTORY + 'cover123.jpg'),
                getCoverArtUrl: jest.fn(() => 'http://example.com/cover/cover123'),
            });
        });

        it('should return cached path if image is already cached', async () => {
            const mockIsFileCached = mockGet().isFileCached;

            mockIsFileCached.mockResolvedValue(true);

            const result = await cacheSlice.downloadImage('cover123', 'Test Song');

            expect(result).toBe(CACHE_DIRECTORY + 'cover123.jpg');
        });

        it('should download and cache image when not cached', async () => {
            const mockIsFileCached = mockGet().isFileCached;

            mockIsFileCached.mockResolvedValue(false);
            mockFileSystem.getInfoAsync.mockResolvedValue({ exists: false } as any);
            mockFileSystem.makeDirectoryAsync.mockResolvedValue();
            mockFileSystem.downloadAsync.mockResolvedValue({ status: 200 } as any);

            const result = await cacheSlice.downloadImage('cover123', 'Test Song');

            expect(mockFileSystem.downloadAsync).toHaveBeenCalledWith(
                'http://example.com/cover/cover123',
                CACHE_DIRECTORY + 'cover123.jpg'
            );
            expect(result).toBe(CACHE_DIRECTORY + 'cover123.jpg');
        });

        it('should return remote URL when caching is disabled', async () => {
            mockGet.mockReturnValue({
                ...mockGet(),
                userSettings: { offlineMode: false, maxCacheSize: 0 },
                getCoverArtUrl: jest.fn(() => 'http://example.com/cover/cover123'),
            });

            const result = await cacheSlice.downloadImage('cover123', 'Test Song');

            expect(result).toBe('http://example.com/cover/cover123');
        });
    });

    describe('loadCachedSongs', () => {
        beforeEach(() => {
            mockGet.mockReturnValue({
                ...mockGet(),
                getCachedFiles: jest.fn(),
            });
        });

        it('should load cached songs from file system', async () => {
            const mockCachedFiles: CachedFileInfo[] = [
                {
                    filename: 'song123.mp3',
                    path: '/cache/song123.mp3',
                    id: 'song123',
                    extension: 'mp3',
                    size: 1024,
                    modTime: 0,
                },
                {
                    filename: 'cover123.jpg',
                    path: '/cache/cover123.jpg',
                    id: 'cover123',
                    extension: 'jpg',
                    size: 512,
                    modTime: 0,
                },
            ];

            const mockGetCachedFiles = mockGet().getCachedFiles;
            mockGetCachedFiles.mockResolvedValue(mockCachedFiles);

            await cacheSlice.loadCachedSongs();

            expect(mockSet).toHaveBeenCalledWith({
                cachedSongs: [mockSong], // Only the song that matches should be included
            });
        });

        it('should handle empty cached files', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const mockGetCachedFiles = mockGet().getCachedFiles;
            mockGetCachedFiles.mockResolvedValue([]);

            await cacheSlice.loadCachedSongs();

            expect(mockSet).toHaveBeenCalledWith({ cachedSongs: [] });
            expect(consoleSpy).toHaveBeenCalledWith('Loaded 0 cached songs');
            consoleSpy.mockRestore();
        });

        it('should handle errors gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const mockGetCachedFiles = mockGet().getCachedFiles;
            mockGetCachedFiles.mockRejectedValue(new Error('File system error'));

            await cacheSlice.loadCachedSongs();

            expect(consoleSpy).toHaveBeenCalledWith('Error loading cached songs:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });
});
