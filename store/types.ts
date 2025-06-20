/**
 * Type definitions for the Music Player Store
 */

import { createAudioPlayer } from "expo-audio";

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
  albumCount?: number;
  coverArt?: string;
}

/**
 * Represents an album in the Subsonic API
 */
export interface Album {
  id: string;
  name: string;
  artist: string;
  songCount: number;
  coverArt?: string;
}

/**
 * Represents a genre in the Subsonic API
 */
export interface Genre {
  id: string;
  name: string;
  songCount: number;
}

/**
 * Represents a playlist in the Subsonic API
 */
export interface Playlist {
  id: string;
  name: string;
  songCount: number;
  coverArt?: string;
  owner?: string;
  public?: boolean;
  created?: string;
  changed?: string;
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
export interface SubsonicConfig {
  serverUrl: string;
  username: string;
  password: string;
  version: string;
}

/**
 * State related to the currently playing audio
 */
export interface PlaybackState {
  isPlaying: boolean;
  currentSong: Song | null;
  player: ReturnType<typeof createAudioPlayer> | null;
}

/**
 * User preferences for the application
 */
export interface UserSettings {
  offlineMode: boolean;
  maxCacheSize: number; // in GB
}

/**
 * Network state information
 */
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * Cached file information
 */
export interface CachedFileInfo {
  path: string;
  id: string;
  extension: string;
  size: number;
  modTime: number;
  filename: string;
}

/**
 * Playlist source types
 */
export type PlaylistSource =
  | "search"
  | "library"
  | "album"
  | "artist"
  | "genre"
  | "playlist";

/**
 * Repeat mode types
 */
export type RepeatMode = "off" | "one" | "all";

/**
 * Current song list information
 */
export interface CurrentSongList {
  source: PlaylistSource;
  songs: Song[];
}

// Default settings when no user preferences are saved
export const DEFAULT_USER_SETTINGS: UserSettings = {
  offlineMode: false,
  maxCacheSize: 10, // 10 GB
};
