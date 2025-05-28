import { useMusicPlayerStore } from '../../store/musicPlayerStore';
import { createAudioPlayer } from 'expo-audio';
import type { Song } from '../../store/musicPlayerStore';

// Mock dependencies
jest.mock('expo-audio');
jest.mock('expo-file-system');

const mockCreateAudioPlayer = createAudioPlayer as jest.MockedFunction<typeof createAudioPlayer>;

// Mock fetch
global.fetch = jest.fn();

describe('Music Player Store - Playback', () => {
  let store: ReturnType<typeof useMusicPlayerStore.getState>;
  let mockPlayer: any;

  const mockSong: Song = {
    id: 'song123',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 180,
    coverArt: 'cover123',
  };

  const mockConfig = {
    serverUrl: 'https://demo.subsonic.org',
    username: 'testuser',
    password: 'testpass',
    version: '1.16.1',
  };

  beforeEach(() => {
    // Reset store state
    store = useMusicPlayerStore.getState();
    useMusicPlayerStore.setState({
      config: mockConfig,
      isAuthenticated: true,
      songs: [mockSong],
      playback: {
        isPlaying: false,
        currentSong: null,
        player: null,
      },
      currentPlaylist: null,
      repeatMode: 'off',
      isRepeat: false,
      isShuffle: false,
      userSettings: { offlineMode: false, maxCacheSize: 0 }, // Disable caching for most tests
    });

    // Create mock player
    mockPlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn().mockResolvedValue(undefined),
      setPlaybackRate: jest.fn(),
      addListener: jest.fn(),
      removeAllListeners: jest.fn(),
      currentTime: 0,
      duration: 180,
    };

    mockCreateAudioPlayer.mockReturnValue(mockPlayer);

    jest.clearAllMocks();
  });

  describe('playSong', () => {
    it('should play a song and update playback state', async () => {
      await store.playSong(mockSong);

      expect(mockCreateAudioPlayer).toHaveBeenCalledWith({
        uri: expect.stringContaining('stream.view'),
      });
      expect(mockPlayer.play).toHaveBeenCalled();
      expect(mockPlayer.addListener).toHaveBeenCalledWith(
        'playbackStatusUpdate',
        expect.any(Function)
      );

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.playback.isPlaying).toBe(true);
      expect(currentState.playback.currentSong).toEqual(mockSong);
      expect(currentState.playback.player).toBe(mockPlayer);
    });

    it('should stop current player before playing new song', async () => {
      const oldPlayer = {
        pause: jest.fn(),
        remove: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      // Set up existing player
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: oldPlayer as any,
        },
      });

      await store.playSong(mockSong);

      expect(oldPlayer.pause).toHaveBeenCalled();
      expect(oldPlayer.removeAllListeners).toHaveBeenCalledWith('playbackStatusUpdate');
      expect(oldPlayer.remove).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockCreateAudioPlayer.mockImplementation(() => {
        throw new Error('Audio player error');
      });

      await store.playSong(mockSong);

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.playback.isPlaying).toBe(false);
      expect(currentState.error).toBe('Audio player error');
      expect(consoleSpy).toHaveBeenCalledWith('Error playing song:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle offline mode when song is not cached', async () => {
      useMusicPlayerStore.setState({
        userSettings: { offlineMode: true, maxCacheSize: 10 },
      });

      // Mock isFileCached to return false
      const isFileCachedSpy = jest.spyOn(store, 'isFileCached').mockResolvedValue(false);

      await store.playSong(mockSong);

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.playback.isPlaying).toBe(false);
      expect(currentState.error).toBe('Cannot play song in offline mode: Song not cached');

      isFileCachedSpy.mockRestore();
    });
  });

  describe('playSongFromSource', () => {
    it('should set current playlist and play song', async () => {
      const sourceSongs = [mockSong];

      await store.playSongFromSource(mockSong, 'library', sourceSongs);

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.currentPlaylist).toEqual({
        source: 'library',
        songs: sourceSongs,
      });
      expect(currentState.playback.currentSong).toEqual(mockSong);
    });

    it('should work with different source types', async () => {
      const sourceSongs = [mockSong];
      const sources: Array<'search' | 'library' | 'album' | 'artist' | 'genre' | 'playlist'> = [
        'search', 'library', 'album', 'artist', 'genre', 'playlist'
      ];

      for (const source of sources) {
        await store.playSongFromSource(mockSong, source, sourceSongs);

        const currentState = useMusicPlayerStore.getState();
        expect(currentState.currentPlaylist?.source).toBe(source);
      }
    });
  });

  describe('pauseSong', () => {
    it('should pause the current song', async () => {
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.pauseSong();

      expect(mockPlayer.pause).toHaveBeenCalled();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.playback.isPlaying).toBe(false);
    });

    it('should do nothing if no player exists', async () => {
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: false,
          currentSong: null,
          player: null,
        },
      });

      await store.pauseSong();

      // Should not throw an error
      const currentState = useMusicPlayerStore.getState();
      expect(currentState.playback.isPlaying).toBe(false);
    });
  });

  describe('resumeSong', () => {
    it('should resume the paused song', async () => {
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: false,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.resumeSong();

      expect(mockPlayer.play).toHaveBeenCalled();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.playback.isPlaying).toBe(true);
    });
  });

  describe('stopSong', () => {
    it('should stop and release the player', async () => {
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.stopSong();

      expect(mockPlayer.pause).toHaveBeenCalled();
      expect(mockPlayer.remove).toHaveBeenCalled();

      const currentState = useMusicPlayerStore.getState();
      expect(currentState.playback.isPlaying).toBe(false);
      expect(currentState.playback.currentSong).toBeNull();
      expect(currentState.playback.player).toBeNull();
    });
  });

  describe('seekToPosition', () => {
    it('should seek to the specified position', async () => {
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.seekToPosition(60);

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(60);
    });

    it('should clamp position to valid range', async () => {
      mockPlayer.duration = 180;
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      // Test seeking beyond duration
      await store.seekToPosition(200);
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(180);

      // Test seeking to negative position
      await store.seekToPosition(-10);
      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    });

    it('should do nothing if no player exists', async () => {
      // Set player to null to test the no-player scenario
      useMusicPlayerStore.setState({
        playback: {
          ...store.playback,
          player: null
        }
      });
      
      const updatedStore = useMusicPlayerStore.getState();
      await updatedStore.seekToPosition(60);
      
      // Should complete without error when no player exists
      expect(updatedStore.playback.player).toBeNull();
    });
  });

  describe('seekForward', () => {
    it('should seek forward 10 seconds', async () => {
      mockPlayer.currentTime = 30;
      mockPlayer.duration = 180;
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.seekForward();

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(40);
    });

    it('should not seek beyond song duration', async () => {
      mockPlayer.currentTime = 175;
      mockPlayer.duration = 180;
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.seekForward();

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(180);
    });
  });

  describe('seekBackward', () => {
    it('should seek backward 10 seconds', async () => {
      mockPlayer.currentTime = 30;
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.seekBackward();

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(20);
    });

    it('should not seek before song start', async () => {
      mockPlayer.currentTime = 5;
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.seekBackward();

      expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    });
  });

  describe('setPlaybackRate', () => {
    it('should set playback rate with pitch correction', async () => {
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
      });

      await store.setPlaybackRate(1.5);

      expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1.5, 'medium');
    });
  });

  describe('skipToNext', () => {
    it('should play next song in order', async () => {
      const song1: Song = { ...mockSong, id: 'song1', title: 'Song 1' };
      const song2: Song = { ...mockSong, id: 'song2', title: 'Song 2' };
      const songs = [song1, song2];

      useMusicPlayerStore.setState({
        songs,
        playback: {
          isPlaying: true,
          currentSong: song1,
          player: mockPlayer,
        },
        currentPlaylist: {
          source: 'library',
          songs,
        },
      });

      const playSongSpy = jest.fn().mockResolvedValue(undefined);
      const originalPlaySong = useMusicPlayerStore.getState().playSong;
      useMusicPlayerStore.setState({ playSong: playSongSpy });

      await store.skipToNext();

      expect(playSongSpy).toHaveBeenCalledWith(song2);
      useMusicPlayerStore.setState({ playSong: originalPlaySong });
    });

    it('should handle repeat one mode', async () => {
      useMusicPlayerStore.setState({
        playback: {
          isPlaying: true,
          currentSong: mockSong,
          player: mockPlayer,
        },
        repeatMode: 'one',
      });

      const playSongSpy = jest.fn().mockResolvedValue(undefined);
      const originalPlaySong = useMusicPlayerStore.getState().playSong;
      useMusicPlayerStore.setState({ playSong: playSongSpy });

      await store.skipToNext();

      expect(playSongSpy).toHaveBeenCalledWith(mockSong);
      useMusicPlayerStore.setState({ playSong: originalPlaySong });
    });

    it('should handle repeat all mode at end of playlist', async () => {
      const song1: Song = { ...mockSong, id: 'song1', title: 'Song 1' };
      const song2: Song = { ...mockSong, id: 'song2', title: 'Song 2' };
      const songs = [song1, song2];

      useMusicPlayerStore.setState({
        songs,
        playback: {
          isPlaying: true,
          currentSong: song2, // Last song
          player: mockPlayer,
        },
        currentPlaylist: {
          source: 'library',
          songs,
        },
        repeatMode: 'all',
      });

      const playSongSpy = jest.fn().mockResolvedValue(undefined);
      const originalPlaySong = useMusicPlayerStore.getState().playSong;
      useMusicPlayerStore.setState({ playSong: playSongSpy });

      await store.skipToNext();

      expect(playSongSpy).toHaveBeenCalledWith(song1); // Should loop back to first song
      useMusicPlayerStore.setState({ playSong: originalPlaySong });
    });

    it('should handle shuffle mode', async () => {
      const song1: Song = { ...mockSong, id: 'song1', title: 'Song 1' };
      const song2: Song = { ...mockSong, id: 'song2', title: 'Song 2' };
      const song3: Song = { ...mockSong, id: 'song3', title: 'Song 3' };
      const songs = [song1, song2, song3];

      useMusicPlayerStore.setState({
        songs,
        playback: {
          isPlaying: true,
          currentSong: song1,
          player: mockPlayer,
        },
        currentPlaylist: {
          source: 'library',
          songs,
        },
        isShuffle: true,
      });

      const playSongSpy = jest.fn().mockResolvedValue(undefined);
      const originalPlaySong = useMusicPlayerStore.getState().playSong;
      useMusicPlayerStore.setState({ playSong: playSongSpy });
      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await store.skipToNext();

      expect(playSongSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
      }));
      // Should not play the same song
      expect(playSongSpy).not.toHaveBeenCalledWith(song1);

      useMusicPlayerStore.setState({ playSong: originalPlaySong });
      mathRandomSpy.mockRestore();
    });
  });

  describe('skipToPrevious', () => {
    it('should play previous song in order', async () => {
      const song1: Song = { ...mockSong, id: 'song1', title: 'Song 1' };
      const song2: Song = { ...mockSong, id: 'song2', title: 'Song 2' };
      const songs = [song1, song2];

      useMusicPlayerStore.setState({
        songs,
        playback: {
          isPlaying: true,
          currentSong: song2, // Currently playing second song
          player: mockPlayer,
        },
        currentPlaylist: {
          source: 'library',
          songs,
        },
      });

      const playSongSpy = jest.fn().mockResolvedValue(undefined);
      const originalPlaySong = useMusicPlayerStore.getState().playSong;
      useMusicPlayerStore.setState({ playSong: playSongSpy });

      await store.skipToPrevious();

      expect(playSongSpy).toHaveBeenCalledWith(song1);
      useMusicPlayerStore.setState({ playSong: originalPlaySong });
    });

    it('should handle repeat all mode at beginning of playlist', async () => {
      const song1: Song = { ...mockSong, id: 'song1', title: 'Song 1' };
      const song2: Song = { ...mockSong, id: 'song2', title: 'Song 2' };
      const songs = [song1, song2];

      useMusicPlayerStore.setState({
        songs,
        playback: {
          isPlaying: true,
          currentSong: song1, // First song
          player: mockPlayer,
        },
        currentPlaylist: {
          source: 'library',
          songs,
        },
        repeatMode: 'all',
      });

      const playSongSpy = jest.fn().mockResolvedValue(undefined);
      const originalPlaySong = useMusicPlayerStore.getState().playSong;
      useMusicPlayerStore.setState({ playSong: playSongSpy });

      await store.skipToPrevious();

      expect(playSongSpy).toHaveBeenCalledWith(song2); // Should loop to last song
      useMusicPlayerStore.setState({ playSong: originalPlaySong });
    });
  });

  describe('Auto-play next song on finish', () => {
    it('should auto-play next song when current song finishes', async () => {
      const song1: Song = { ...mockSong, id: 'song1', title: 'Song 1' };
      const song2: Song = { ...mockSong, id: 'song2', title: 'Song 2' };
      const songs = [song1, song2];

      useMusicPlayerStore.setState({
        songs,
        currentPlaylist: {
          source: 'library',
          songs,
        },
      });

      const skipToNextSpy = jest.fn().mockResolvedValue(undefined);
      const originalSkipToNext = useMusicPlayerStore.getState().skipToNext;
      useMusicPlayerStore.setState({ skipToNext: skipToNextSpy });

      await store.playSong(song1);

      // Get the listener that was added to the player
      const addListenerCall = mockPlayer.addListener.mock.calls[0];
      const statusUpdateListener = addListenerCall[1];

      // Simulate song finishing
      statusUpdateListener({ didJustFinish: true });

      expect(skipToNextSpy).toHaveBeenCalled();
      useMusicPlayerStore.setState({ skipToNext: originalSkipToNext });
    });
  });
});
