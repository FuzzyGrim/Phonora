import { create } from 'zustand';
import md5 from 'md5';
import { Audio } from 'expo-av';

interface Song {
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

interface SubsonicState {
  config: SubsonicConfig | null;
  isAuthenticated: boolean;
  songs: Song[];
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
}

export const useSubsonicStore = create<SubsonicState>((set, get) => ({
  config: null,
  isAuthenticated: false,
  songs: [],
  isLoading: false,
  error: null,
  playback: {
    isPlaying: false,
    currentSong: null,
    sound: null,
  },
  setConfig: (config) => {
    set({ config, isAuthenticated: true });
    get().fetchSongs();
  },
  clearConfig: () => set({ config: null, isAuthenticated: false, songs: [] }),
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
      c: 'subsonicapp',
      f: 'json',
    });
  },
  getCoverArtUrl: (id: string) => {
    const { config } = get();
    if (!config) return '';
    const params = get().generateAuthParams();
    return `${config.serverUrl}/rest/getCoverArt.view?id=${id}&${params.toString()}`;
  },
  getStreamUrl: (id: string) => {
    const { config } = get();
    if (!config) return '';
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
        `${config.serverUrl}/rest/getRandomSongs.view?size=50&${params.toString()}`
      );
      const data = await response.json();

      if (data['subsonic-response'].status === 'ok') {
        const songs = data['subsonic-response'].randomSongs.song.map((song: any) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          coverArt: song.coverArt,
        }));
        set({ songs, isLoading: false });
      } else {
        throw new Error(data['subsonic-response'].error?.message || 'Failed to fetch songs');
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch songs', isLoading: false });
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
        { shouldPlay: true }
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
      console.error('Error playing song:', error);
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
}));