/**
 * Playback control functions and state management
 */

import { createAudioPlayer, setAudioModeAsync, AudioStatus } from "expo-audio";
import {
  Song,
  PlaybackState,
  RepeatMode,
} from "./types";

/**
 * Playback slice for the store
 */
export interface PlaybackSlice {
  // State
  playback: PlaybackState;
  currentSongsList: Song[] | null;
  isRepeat: boolean;
  isShuffle: boolean;
  repeatMode: RepeatMode;
  hasRepeatedOnce: boolean;

  // Actions
  playSong: (song: Song) => Promise<void>;
  playSongFromSource: (
    song: Song,
    sourceSongs: Song[],
  ) => Promise<void>;
  pauseSong: () => Promise<void>;
  resumeSong: () => Promise<void>;
  stopSong: () => Promise<void>;
  seekToPosition: (positionSeconds: number) => Promise<void>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  seekForward: () => Promise<void>;
  seekBackward: () => Promise<void>;
  setPlaybackRate: (speed: number) => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
}

/**
 * Create playback slice
 */
export const createPlaybackSlice = (set: any, get: any): PlaybackSlice => ({
  // Initial state
  playback: {
    isPlaying: false,
    currentSong: null,
    player: null,
    position: 0,
    duration: 0,
  },
  currentSongsList: null,
  isRepeat: false,
  isShuffle: false,
  repeatMode: "off",
  hasRepeatedOnce: false,

  /**
   * Play a song by creating a new Audio.Sound instance
   * Unloads any currently playing audio first
   * Downloads and caches the song if not already cached
   */
  playSong: async (song: Song) => {
    try {
      // Stop and release current player to free up resources
      const { player: currentPlayer } = get().playback;
      if (currentPlayer) {
        // First pause the player to immediately stop the sound
        currentPlayer.pause();
        // Make sure to remove any existing event listeners
        currentPlayer.removeAllListeners("playbackStatusUpdate");
        // Then remove it to free up resources
        currentPlayer.remove();
      }

      // Update state to show we're loading
      set((state: any) => ({
        playback: {
          ...state.playback,
          isPlaying: false,
          currentSong: song,
        },
      }));

      // Get audio source - either cached or streamed
      let audioSource;
      const {
        userSettings,
        isFileCached,
        getCachedFilePath,
        downloadSong,
        getStreamUrl,
        downloadImage,
      } = get();

      // Check if the song is cached
      const isCached = await isFileCached(song.id, "mp3");

      // Handle offline mode restriction
      if (userSettings.offlineMode && !isCached) {
        throw new Error("Cannot play song in offline mode: Song not cached");
      }

      // Cache handling section
      if (userSettings.maxCacheSize > 0) {
        // Start a promise to handle the audio caching
        // For new songs, we'll first perform cache cleanup once if needed
        const audioCachePromise = isCached
          ? Promise.resolve(getCachedFilePath(song.id, "mp3"))
          : downloadSong(song).catch((err: any) => {
            console.warn(
              `Background audio caching failed for ${song.title}:`,
              err,
            );
            return getStreamUrl(song.id);
          });

        // If the song has cover art, cache it also
        let imageCachePromise = Promise.resolve();
        if (song.coverArt) {
          const isImageCached = await isFileCached(song.coverArt, "jpg");
          if (!isImageCached) {
            // Download image in the background, don't await
            // Image download will skip cache management and use the song's cleanup
            imageCachePromise = downloadImage(song.coverArt, song.title)
              .then(() => { })
              .catch((err: any) =>
                console.warn(
                  `Background image caching failed for ${song.coverArt}:`,
                  err,
                ),
              );
          }
        }

        // Start both downloads in parallel but don't wait for image
        if (isCached) {
          // Use cached audio immediately
          const cachedPath = getCachedFilePath(song.id, "mp3");
          audioSource = { uri: cachedPath };
          console.log(`Playing cached song: ${song.title}`);

          // Let image download in background
          imageCachePromise.catch(() => { });
        } else {
          // Use streaming URL while waiting for download
          const streamUrl = getStreamUrl(song.id);
          audioSource = { uri: streamUrl };

          // Let both downloads happen in background
          Promise.all([audioCachePromise, imageCachePromise])
            .catch(() => { }) // Ignore errors to prevent app crashes
            .finally(() =>
              console.log(
                `Background caching operations completed for ${song.title}`,
              ),
            );
        }
      } else {
        // Caching is disabled, use streaming URL
        audioSource = { uri: getStreamUrl(song.id) };
      }

      // Create a new audio player
      const player = createAudioPlayer(audioSource);

      // Configure audio to play in background and silent mode
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      // Set up a listener for playback status updates
      const handlePlaybackStatusUpdate = (status: AudioStatus) => {
        // Only update state if there are meaningful changes to prevent unnecessary re-renders
        const currentState = get().playback;
        const newPosition = status.currentTime || 0;
        const newDuration = status.duration || song.duration || 0;

        // Only update if position changed by more than 0.5 seconds or if duration changed
        if (
          Math.abs(currentState.position - newPosition) > 0.5 ||
          currentState.duration !== newDuration
        ) {
          set((state: any) => ({
            playback: {
              ...state.playback,
              position: newPosition,
              duration: newDuration,
            },
          }));
        }

        // When the song reaches the end (status.didJustFinish will be true)
        if (status.didJustFinish) {
          console.log(`Song finished: ${song.title}`);
          // Check currentSongsList state before calling skipToNext
          const { currentSongsList, repeatMode, isShuffle } = get();
          console.log("Song finished - currentSongsList state:", {
            hasCurrentSong: !!get().playback.currentSong,
            hasPlaylist: !!currentSongsList,
            playlistLength: currentSongsList?.length || 0,
            repeatMode,
            isShuffle,
          });
          // Auto-play next song (handles repeat and shuffle logic)
          get().skipToNext();
        }
      };

      // Add the event listener to the player
      player.addListener("playbackStatusUpdate", handlePlaybackStatusUpdate);

      // Play the song
      player.play();

      // Update playback state
      set({
        playback: {
          isPlaying: true,
          currentSong: song,
          player,
          position: 0,
          duration: song.duration || 0,
        },
      });
    } catch (error) {
      console.error("Error playing song:", error);
      // Reset playback state on error
      set((state: any) => ({
        playback: {
          ...state.playback,
          isPlaying: false,
        },
        error: error instanceof Error ? error.message : "Failed to play song",
      }));
    }
  },

  /**
   * Play a song from a specific source (search results, library, album, etc.)
   * Sets the current playlist source for proper next/previous navigation
   */
  playSongFromSource: async (
    song: Song,
    sourceSongs: Song[],
  ) => {
    // Set the current playlist source
    set({
      currentSongsList: sourceSongs,
      hasRepeatedOnce: false, // Reset repeat tracking when starting from a new source
    });

    // Then play the song using the regular playSong method
    await get().playSong(song);
  },

  /**
   * Pause the currently playing song
   */
  pauseSong: async () => {
    const { player } = get().playback;
    if (player) {
      player.pause();
      set((state: any) => ({
        playback: { ...state.playback, isPlaying: false },
      }));
    }
  },

  /**
   * Resume playback of a paused song
   */
  resumeSong: async () => {
    const { player } = get().playback;
    if (player) {
      player.play();
      set((state: any) => ({
        playback: { ...state.playback, isPlaying: true },
      }));
    }
  },

  /**
   * Stop playback completely and release the player resource
   */
  stopSong: async () => {
    const { player } = get().playback;
    if (player) {
      // First pause the player to immediately stop the sound
      player.pause();
      // Then remove it to free up resources
      player.remove();
      set({
        playback: {
          isPlaying: false,
          currentSong: null,
          player: null,
          position: 0,
          duration: 0,
        },
        hasRepeatedOnce: false, // Reset repeat tracking when stopping
      });
    }
  },

  /**
   * Seek to a specific position in the current song
   */
  seekToPosition: async (positionSeconds: number) => {
    const { player, duration } = get().playback;
    if (!player) {
      return;
    }

    try {
      // Use the stored duration from state instead of accessing player properties directly
      const songDuration = duration || player.duration || positionSeconds;

      // Ensure we don't seek beyond the song duration
      const clampedPosition = Math.min(
        Math.max(positionSeconds, 0),
        songDuration,
      );

      // Perform the seek operation
      await player.seekTo(clampedPosition);

      // Immediately update the position in state for responsive UI
      set((state: any) => ({
        playback: {
          ...state.playback,
          position: clampedPosition,
        },
      }));
    } catch (error) {
      console.error("Error seeking to position:", error);
    }
  },

  /**
   * Skip to the next song in the playlist
   */
  skipToNext: async () => {
    const { currentSongsList, playback, songs, repeatMode, isShuffle, hasRepeatedOnce } = get();
    console.log("skipToNext called", {
      hasSong: !!playback.currentSong,
      hasPlaylist: !!currentSongsList,
      playlistLength: currentSongsList?.length || 0,
      globalSongsLength: songs?.length || 0,
      repeatMode,
      isShuffle,
      hasRepeatedOnce,
    });

    // Check if we have a current song
    if (!playback.currentSong) {
      console.log("skipToNext returning early: No current song");
      return;
    }

    // Handle repeat one mode - replay the same song only once, then continue
    if (repeatMode === "one") {
      if (!hasRepeatedOnce) {
        console.log("Repeat one mode: replaying current song (first repeat)");
        set({ hasRepeatedOnce: true });
        await get().playSong(playback.currentSong);
        return;
      } else {
        console.log("Repeat one mode: already repeated once, proceeding to next song");
        // Continue to normal next song logic below
      }
    }

    // Get the songs list to work with
    const songsToUse = currentSongsList || songs;
    if (!songsToUse || songsToUse.length === 0) {
      console.log("skipToNext returning: No songs available");
      return;
    }

    // Find the index of the current song
    const currentIndex = songsToUse.findIndex(
      (song: Song) => song.id === playback.currentSong?.id,
    );

    if (currentIndex === -1) {
      console.log("skipToNext returning: Current song not found in list");
      return;
    }

    let nextSong: Song | null = null;

    if (isShuffle) {
      // In shuffle mode, pick a random song (excluding current song)
      const availableSongs = songsToUse.filter(
        (_: Song, index: number) => index !== currentIndex,
      );
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        nextSong = availableSongs[randomIndex];
        console.log(`Playing random song: ${nextSong?.title}`);
      }
    } else {
      // Normal mode: play next song in order
      if (currentIndex < songsToUse.length - 1) {
        nextSong = songsToUse[currentIndex + 1];
        console.log(`Playing next song in order: ${nextSong?.title}`);
      } else if (repeatMode === "all") {
        // If we're at the end and repeat all is on, go back to the beginning
        nextSong = songsToUse[0];
        console.log(
          `Repeating playlist, playing first song: ${nextSong?.title}`,
        );
      }
    }

    // Play the next song if we found one
    if (nextSong) {
      // Reset repeat tracking when moving to a different song
      set({ hasRepeatedOnce: false });
      await get().playSong(nextSong);
    } else {
      console.log("skipToNext: No next song to play");
    }
  },

  /**
   * Skip to the previous song in the playlist
   */
  skipToPrevious: async () => {
    const { currentSongsList, playback, songs, repeatMode, isShuffle } = get();

    // Check if we have a current song
    if (!playback.currentSong) {
      return;
    }

    // Handle repeat one mode - just replay the same song
    if (repeatMode === "one") {
      console.log("Repeat one mode: replaying current song");
      await get().playSong(playback.currentSong);
      return;
    }

    // Get the songs list to work with
    const songsToUse = currentSongsList || songs;
    if (!songsToUse || songsToUse.length === 0) {
      return;
    }

    // Find the index of the current song
    const currentIndex = songsToUse.findIndex(
      (song: Song) => song.id === playback.currentSong?.id,
    );

    if (currentIndex === -1) {
      return;
    }

    let previousSong: Song | null = null;

    if (isShuffle) {
      // In shuffle mode, pick a random song (excluding current song)
      const availableSongs = songsToUse.filter(
        (_: Song, index: number) => index !== currentIndex,
      );
      if (availableSongs.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableSongs.length);
        previousSong = availableSongs[randomIndex];
      }
    } else {
      // Normal mode: play previous song in order
      if (currentIndex > 0) {
        previousSong = songsToUse[currentIndex - 1];
      } else if (repeatMode === "all") {
        // If we're at the beginning and repeat all is on, go to the last song
        previousSong = songsToUse[songsToUse.length - 1];
      }
    }

    // Play the previous song if we found one
    if (previousSong) {
      // Reset repeat tracking when moving to a different song
      set({ hasRepeatedOnce: false });
      await get().playSong(previousSong);
    }
  },

  /**
   * Seek forward 10 seconds in the current song
   */
  seekForward: async () => {
    const { player, position, duration } = get().playback;
    if (!player) return;

    try {
      // Use the stored position from state instead of accessing player properties directly
      const currentTime = position || 0;
      const songDuration = duration || 0;

      // Seek forward 10 seconds, but don't go beyond the end
      const newPosition = Math.min(currentTime + 10, songDuration);

      // Don't await the seekTo to prevent UI freezing
      player.seekTo(newPosition).catch((error: any) => {
        console.warn("Seek forward failed:", error);
      });
    } catch (error) {
      console.error("Error seeking forward:", error);
    }
  },

  /**
   * Seek backward 10 seconds in the current song
   */
  seekBackward: async () => {
    const { player, position } = get().playback;
    if (!player) return;

    try {
      // Use the stored position from state instead of accessing player properties directly
      const currentTime = position || 0;

      // Seek backward 10 seconds, but don't go below 0
      const newPosition = Math.max(currentTime - 10, 0);

      // Don't await the seekTo to prevent UI freezing
      player.seekTo(newPosition).catch((error: any) => {
        console.warn("Seek backward failed:", error);
      });
    } catch (error) {
      console.error("Error seeking backward:", error);
    }
  },

  /**
   * Change the playback speed of the current song
   * @param speed - Playback rate (1.0 is normal speed)
   */
  setPlaybackRate: async (speed: number) => {
    const { player } = get().playback;
    if (!player) return;

    // Use the new setPlaybackRate method with pitch correction
    player.setPlaybackRate(speed, "medium");
  },

  /**
   * Toggle repeat mode: off -> all -> one -> off
   */
  toggleRepeat: () => {
    set((state: any) => {
      let newRepeatMode: RepeatMode;
      let newIsRepeat: boolean;

      switch (state.repeatMode) {
        case "off":
          newRepeatMode = "all";
          newIsRepeat = true;
          break;
        case "all":
          newRepeatMode = "one";
          newIsRepeat = true;
          break;
        case "one":
          newRepeatMode = "off";
          newIsRepeat = false;
          break;
        default:
          newRepeatMode = "off";
          newIsRepeat = false;
      }

      return {
        repeatMode: newRepeatMode,
        isRepeat: newIsRepeat,
        hasRepeatedOnce: false, // Reset repeat tracking when toggling modes
        // If enabling repeat, disable shuffle
        isShuffle: newIsRepeat ? false : state.isShuffle,
      };
    });
  },

  /**
   * Set repeat mode directly
   */
  setRepeatMode: (mode: RepeatMode) => {
    set((state: any) => ({
      repeatMode: mode,
      isRepeat: mode !== "off",
      hasRepeatedOnce: false, // Reset repeat tracking when changing modes
      // If enabling repeat, disable shuffle
      isShuffle: mode !== "off" ? false : state.isShuffle,
    }));
  },

  /**
   * Toggle shuffle mode
   */
  toggleShuffle: () => {
    set((state: any) => ({
      isShuffle: !state.isShuffle,
      // If enabling shuffle, disable repeat
      isRepeat: !state.isShuffle ? false : state.isRepeat,
    }));
  },
});
