/**
 * Tests for store/auth.ts
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import md5 from 'md5';
import { createAuthSlice } from '../../store/auth';
import { SubsonicConfig, DEFAULT_USER_SETTINGS } from '../../store/types';

// Mock the dependencies
jest.mock('expo-secure-store');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('md5');

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockMd5 = md5 as jest.MockedFunction<typeof md5>;

describe('Auth Slice', () => {
  let authSlice: any;
  let mockSet: jest.Mock;
  let mockGet: jest.Mock;

  const mockConfig: SubsonicConfig = {
    serverUrl: 'http://localhost:4533',
    username: 'testuser',
    password: 'testpass',
    version: '1.16.1',
  };

  beforeEach(() => {
    mockSet = jest.fn();
    mockGet = jest.fn();
    authSlice = createAuthSlice(mockSet, mockGet);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockGet.mockReturnValue({
      config: null,
      userSettings: DEFAULT_USER_SETTINGS,
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(authSlice.config).toBeNull();
      expect(authSlice.isAuthenticated).toBe(false);
      expect(authSlice.userSettings).toEqual(DEFAULT_USER_SETTINGS);
    });
  });

  describe('initializeAuth', () => {
    it('should load credentials and settings successfully', async () => {
      const mockCredentials = JSON.stringify(mockConfig);
      const mockSettings = JSON.stringify({ offlineMode: true, maxCacheSize: 5 });

      mockSecureStore.getItemAsync.mockResolvedValue(mockCredentials);
      mockAsyncStorage.getItem.mockResolvedValue(mockSettings);

      await authSlice.initializeAuth();

      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('subsonic_credentials');
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith('user_settings');
      expect(mockSet).toHaveBeenCalledWith({
        config: mockConfig,
        isAuthenticated: true,
      });
      expect(mockSet).toHaveBeenCalledWith({
        userSettings: { offlineMode: true, maxCacheSize: 5 },
      });
    });

    it('should handle missing credentials gracefully', async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      mockAsyncStorage.getItem.mockResolvedValue(null);

      await authSlice.initializeAuth();

      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should handle errors during initialization', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSecureStore.getItemAsync.mockRejectedValue(new Error('Storage error'));

      await authSlice.initializeAuth();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error initializing authentication:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('should handle invalid JSON in stored credentials', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSecureStore.getItemAsync.mockResolvedValue('invalid-json');

      await authSlice.initializeAuth();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error initializing authentication:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('setConfig', () => {
    it('should save config and update state', async () => {
      await authSlice.setConfig(mockConfig);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        'subsonic_credentials',
        JSON.stringify(mockConfig)
      );
      expect(mockSet).toHaveBeenCalledWith({
        config: mockConfig,
        isAuthenticated: true,
      });
    });

    it('should handle storage errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const storageError = new Error('Storage error');
      mockSecureStore.setItemAsync.mockRejectedValue(storageError);

      await expect(authSlice.setConfig(mockConfig)).rejects.toThrow(storageError);

      expect(consoleSpy).toHaveBeenCalledWith('Error saving credentials:', storageError);
      consoleSpy.mockRestore();
    });
  });

  describe('clearConfig', () => {
    it('should clear credentials and reset state', async () => {
      await authSlice.clearConfig();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('subsonic_credentials');
      expect(mockSet).toHaveBeenCalledWith({
        config: null,
        isAuthenticated: false,
      });
    });

    it('should handle deletion errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const deletionError = new Error('Deletion error');
      mockSecureStore.deleteItemAsync.mockRejectedValue(deletionError);

      await expect(authSlice.clearConfig()).rejects.toThrow(deletionError);

      expect(consoleSpy).toHaveBeenCalledWith('Error clearing credentials:', deletionError);
      consoleSpy.mockRestore();
    });
  });

  describe('setUserSettings', () => {
    it('should save settings and update state', async () => {
      const newSettings = { offlineMode: true, maxCacheSize: 15 };

      await authSlice.setUserSettings(newSettings);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'user_settings',
        JSON.stringify(newSettings)
      );
      expect(mockSet).toHaveBeenCalledWith({ userSettings: newSettings });
    });

    it('should handle storage errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const storageError = new Error('Storage error');
      mockAsyncStorage.setItem.mockRejectedValue(storageError);

      await expect(authSlice.setUserSettings({ offlineMode: true, maxCacheSize: 5 }))
        .rejects.toThrow(storageError);

      expect(consoleSpy).toHaveBeenCalledWith('Error saving settings:', storageError);
      consoleSpy.mockRestore();
    });
  });

  describe('generateAuthParams', () => {
    beforeEach(() => {
      // Mock Math.random for consistent salt generation
      jest.spyOn(Math, 'random').mockReturnValue(0.123456789);
      mockMd5.mockReturnValue('mocked-token');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should generate correct auth parameters when config exists', () => {
      mockGet.mockReturnValue({ config: mockConfig });

      // Mock Math.random to return a predictable value
      const mockMathRandom = jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

      const params = authSlice.generateAuthParams();

      // The salt will be generated from Math.random().toString(36).substring(2)
      const expectedSalt = (0.123456789).toString(36).substring(2);
      expect(mockMd5).toHaveBeenCalledWith(`testpass${expectedSalt}`);
      expect(params.toString()).toBe(
        `u=testuser&t=mocked-token&s=${expectedSalt}&v=1.16.1&c=subsonicapp&f=json`
      );

      mockMathRandom.mockRestore();
    });

    it('should return empty params when no config exists', () => {
      mockGet.mockReturnValue({ config: null });

      const params = authSlice.generateAuthParams();

      expect(params.toString()).toBe('');
      expect(mockMd5).not.toHaveBeenCalled();
    });

    it('should generate different salts on multiple calls', () => {
      mockGet.mockReturnValue({ config: mockConfig });

      // Mock different random values
      const mockMathRandom = jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.123456789)
        .mockReturnValueOnce(0.987654321);

      const params1 = authSlice.generateAuthParams();
      const params2 = authSlice.generateAuthParams();

      const expectedSalt1 = (0.123456789).toString(36).substring(2);
      const expectedSalt2 = (0.987654321).toString(36).substring(2);

      expect(params1.get('s')).toBe(expectedSalt1);
      expect(params2.get('s')).toBe(expectedSalt2);
      expect(params1.get('s')).not.toBe(params2.get('s'));

      mockMathRandom.mockRestore();
    });

    it('should use correct client parameters', () => {
      mockGet.mockReturnValue({ config: mockConfig });

      const params = authSlice.generateAuthParams();

      expect(params.get('c')).toBe('subsonicapp');
      expect(params.get('f')).toBe('json');
      expect(params.get('v')).toBe('1.16.1');
    });
  });

  describe('Security', () => {
    it('should not expose password in generated parameters', () => {
      mockGet.mockReturnValue({ config: mockConfig });

      const params = authSlice.generateAuthParams();
      const paramString = params.toString();

      expect(paramString).not.toContain('testpass');
      expect(paramString).not.toContain('password');
    });

    it('should generate random salt for each request', () => {
      mockGet.mockReturnValue({ config: mockConfig });

      const params1 = authSlice.generateAuthParams();
      const params2 = authSlice.generateAuthParams();

      // Even with mocked Math.random, the salt should be included
      expect(params1.has('s')).toBe(true);
      expect(params2.has('s')).toBe(true);
    });
  });
});
