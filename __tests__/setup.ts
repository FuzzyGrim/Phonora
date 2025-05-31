/**
 * Test setup configuration
 */

// Mock Expo modules that are not available in test environment
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
    cacheDirectory: '/mock/cache/',
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    deleteAsync: jest.fn(),
    readDirectoryAsync: jest.fn(),
    downloadAsync: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn(),
    addEventListener: jest.fn(),
}));

jest.mock('expo-audio', () => ({
    createAudioPlayer: jest.fn(),
    setAudioModeAsync: jest.fn(),
    AudioStatus: {},
}));

jest.mock('md5', () => jest.fn());

// Global test helpers
global.console = {
    ...console,
    // Suppress console.log during tests unless needed
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
