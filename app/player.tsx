import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  Animated,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import { Song } from "@/store/types";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  ChevronDown,
  Repeat,
  Repeat1,
  Shuffle,
  Rewind,
  FastForward,
  Music2,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import Slider from "@react-native-community/slider";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function PlayerScreen() {
  const { colors } = useTheme();
  const {
    playback,
    pauseSong,
    resumeSong,
    getCoverArtUrl,
    songs,
    skipToNext,
    skipToPrevious,
    seekForward,
    seekBackward,
    setPlaybackRate,
    playSongFromSource,
    seekToPosition,
    currentSongList,
    repeatMode,
    isShuffle,
    toggleRepeat,
    toggleShuffle,
  } = useMusicPlayerStore();
  const router = useRouter();
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [position, setPosition] = useState(0);
  const [isSliderBeingDragged, setIsSliderBeingDragged] = useState(false);
  const [localIsShuffle, setLocalIsShuffle] = useState(isShuffle);
  const [localRepeatMode, setLocalRepeatMode] = useState(repeatMode);
  const seekingRef = useRef(false);

  // Sync local state with store state
  useEffect(() => {
    setLocalIsShuffle(isShuffle);
  }, [isShuffle]);

  useEffect(() => {
    setLocalRepeatMode(repeatMode);
  }, [repeatMode]);

  // Get the appropriate list of songs to display
  const songsToDisplay = currentSongList?.songs || songs;

  // Define currentSong at component level
  const currentSong = playback.currentSong || {
    id: "",
    title: "No song playing",
    artist: "",
    album: "",
    duration: 0,
    coverArt: "",
  };

  // Animated values for the playing indicator
  const bar1Height = useRef(new Animated.Value(3)).current;
  const bar2Height = useRef(new Animated.Value(8)).current;
  const bar3Height = useRef(new Animated.Value(5)).current;

  // Animation sequence for the playing indicator
  useEffect(() => {
    // Create reusable animation sequence
    const createBarAnimation = (
      value: Animated.Value,
      toValue: number,
      delay: number,
    ) => {
      return Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue,
          duration: 300,
          useNativeDriver: false,
        }),
      ]);
    };

    // Create the complete animation sequence
    const createFullAnimation = () => {
      return Animated.loop(
        Animated.parallel([
          Animated.sequence([
            createBarAnimation(bar1Height, 12, 0),
            createBarAnimation(bar1Height, 3, 0),
          ]),
          Animated.sequence([
            createBarAnimation(bar2Height, 4, 200),
            createBarAnimation(bar2Height, 10, 0),
          ]),
          Animated.sequence([
            createBarAnimation(bar3Height, 13, 400),
            createBarAnimation(bar3Height, 5, 0),
          ]),
        ]),
      );
    };

    // Initialize animation
    const animation = createFullAnimation();

    // Start or pause the animation based on playback state
    if (playback.isPlaying) {
      animation.start();
    } else {
      // For paused state, don't reset the values, just stop the animation
      animation.stop();
    }

    // Cleanup function to stop animation when unmounting
    return () => {
      animation.stop();
    };
  }, [playback.isPlaying, currentSong.id, bar1Height, bar2Height, bar3Height]);

  // Update position for progress bar
  useEffect(() => {
    // Immediately get current position when component mounts
    const getInitialPosition = () => {
      if (playback.player && !isSliderBeingDragged && !seekingRef.current) {
        // Access the currentTime property directly
        setPosition(playback.player.currentTime);
      }
    };

    // Call it right away
    getInitialPosition();

    let interval: ReturnType<typeof setInterval> | null = null;

    if (playback.isPlaying && playback.player) {
      interval = setInterval(() => {
        if (playback.player && !isSliderBeingDragged && !seekingRef.current) {
          // Access the currentTime property directly
          setPosition(playback.player.currentTime);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [playback.isPlaying, playback.player, isSliderBeingDragged]);

  const handleToggleShuffle = () => {
    const newIsShuffle = !localIsShuffle;
    // Immediately update local state for instant UI feedback
    setLocalIsShuffle(newIsShuffle);
    // If enabling shuffle, disable repeat
    if (newIsShuffle) {
      setLocalRepeatMode("off");
    }
    // Update store state
    toggleShuffle();
  };

  const handleToggleRepeat = () => {
    // Immediately update local state for instant UI feedback
    let newRepeatMode: "off" | "one" | "all";
    switch (localRepeatMode) {
      case "off":
        newRepeatMode = "all";
        break;
      case "all":
        newRepeatMode = "one";
        break;
      case "one":
        newRepeatMode = "off";
        break;
      default:
        newRepeatMode = "off";
    }
    setLocalRepeatMode(newRepeatMode);
    // If enabling repeat, disable shuffle
    if (newRepeatMode !== "off") {
      setLocalIsShuffle(false);
    }
    // Update store state
    toggleRepeat();
  };

  const handlePlayPause = async () => {
    if (playback.isPlaying) {
      await pauseSong();
    } else {
      await resumeSong();
    }
  };

  const handleSkipNext = () => {
    skipToNext();
  };

  const handleSkipPrevious = () => {
    skipToPrevious();
  };

  const handleSeekBackward = () => {
    seekBackward();
  };

  const handleSeekForward = () => {
    seekForward();
  };

  const changePlaybackSpeed = () => {
    // Cycle through speeds: 1.0 -> 1.25 -> 1.5 -> 0.75 -> 1.0
    const speeds = [1.0, 1.25, 1.5, 0.75, 1.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    setPlaybackRate(newSpeed);
  };

  const handleSongPress = (song: Song) => {
    // Use the songsToDisplay as the playlist source
    playSongFromSource(song, "library", songsToDisplay);
  };

  const handleSliderChange = (value: number) => {
    setPosition(value);
  };

  const handleSliderSlidingStart = () => {
    setIsSliderBeingDragged(true);
  };

  const handleSliderSlidingComplete = async (value: number) => {
    console.log("Seeking to position:", value, "seconds");
    seekingRef.current = true;

    try {
      await seekToPosition(value); // Pass seconds directly

      // Wait for the seek to complete and then update position from player
      setTimeout(() => {
        if (playback.player) {
          setPosition(playback.player.currentTime);
        }
        seekingRef.current = false;
        setIsSliderBeingDragged(false);
      }, 300);
    } catch (error) {
      console.error("Error during slider seek:", error);
      seekingRef.current = false;
      setIsSliderBeingDragged(false);
    }
  };

  type RenderItemProps = {
    item: Song;
  };

  const renderSongItem = ({ item }: RenderItemProps) => {
    const isCurrentSong = item.id === currentSong.id;

    return (
      <TouchableOpacity
        style={[
          styles.songItem,
          isCurrentSong && styles.currentSongItem,
          isCurrentSong && { backgroundColor: colors.surface },
        ]}
        onPress={() => handleSongPress(item)}
      >
        <View style={styles.songItemContent}>
          {item.coverArt ? (
            <Image
              source={{ uri: getCoverArtUrl(item.coverArt) }}
              style={[
                styles.songCoverArt,
                isCurrentSong && styles.currentSongCoverArt,
              ]}
            />
          ) : (
            <View
              style={[
                styles.placeholderCover,
                isCurrentSong && styles.currentSongCoverArt,
                { backgroundColor: colors.border },
              ]}
            >
              <Music2
                size={isCurrentSong ? 24 : 16}
                color={colors.textSecondary}
              />
            </View>
          )}

          <View style={styles.songItemDetails}>
            <Text
              style={[
                styles.songItemTitle,
                isCurrentSong && styles.currentSongText,
                { color: isCurrentSong ? colors.primary : colors.text },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={[styles.songItemArtist, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.artist}
            </Text>
          </View>

          {isCurrentSong && (
            <View style={styles.nowPlayingIndicator}>
              <Animated.View
                style={[
                  styles.playingBar,
                  {
                    backgroundColor: colors.primary,
                    height: bar1Height,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.playingBar,
                  {
                    backgroundColor: colors.primary,
                    height: bar2Height,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.playingBar,
                  {
                    backgroundColor: colors.primary,
                    height: bar3Height,
                  },
                ]}
              />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <ChevronDown size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Now Playing
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.songListContainer}>
        <FlatList
          data={songsToDisplay}
          renderItem={renderSongItem}
          keyExtractor={(item: Song) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.songListContent}
        />
      </View>

      <View style={[styles.playerControls, { borderTopColor: colors.border }]}>
        <View style={styles.songDetails}>
          <Text style={[styles.songTitle, { color: colors.text }]}>
            {currentSong.title}
          </Text>
          <Text style={[styles.songArtist, { color: colors.textSecondary }]}>
            {currentSong.artist}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Slider
            style={styles.progressBar}
            minimumValue={0}
            maximumValue={currentSong.duration}
            value={position}
            onValueChange={handleSliderChange}
            onSlidingStart={handleSliderSlidingStart}
            onSlidingComplete={handleSliderSlidingComplete}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.primary}
          />
          <View style={styles.timeInfo}>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatDuration(Math.floor(position))}
            </Text>
            <Text style={[styles.timeText, { color: colors.textSecondary }]}>
              {formatDuration(currentSong.duration)}
            </Text>
          </View>
        </View>

        <View style={styles.mainControls}>
          <TouchableOpacity
            onPress={handleToggleShuffle}
            style={styles.controlButton}
          >
            <Shuffle
              size={24}
              color={localIsShuffle ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkipPrevious}
            style={styles.controlButton}
          >
            <SkipBack size={28} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSeekBackward}
            style={styles.controlButton}
          >
            <Rewind size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePlayPause}
            style={[
              styles.playPauseButton,
              { backgroundColor: colors.primary },
            ]}
          >
            {playback.isPlaying ? (
              <Pause size={32} color={colors.text} />
            ) : (
              <Play size={32} color={colors.text} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSeekForward}
            style={styles.controlButton}
          >
            <FastForward size={24} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSkipNext}
            style={styles.controlButton}
          >
            <SkipForward size={28} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleRepeat}
            style={styles.controlButton}
          >
            {localRepeatMode === "one" ? (
              <Repeat1 size={24} color={colors.primary} />
            ) : (
              <Repeat
                size={24}
                color={
                  localRepeatMode === "all"
                    ? colors.primary
                    : colors.textSecondary
                }
              />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={changePlaybackSpeed}
          style={[styles.speedButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.speedText, { color: colors.text }]}>
            {playbackSpeed}x
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    padding: 8,
  },
  container: {
    flex: 1,
  },
  controlButton: {
    padding: 8,
  },
  currentSongCoverArt: {
    height: 60,
    width: 60,
  },
  currentSongItem: {
    paddingVertical: 12,
  },
  currentSongText: {
    fontSize: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  headerTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
  },
  mainControls: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    width: "100%",
  },
  nowPlayingIndicator: {
    alignItems: "flex-end",
    flexDirection: "row",
    height: 16,
    marginLeft: 8,
    width: 20,
  },
  placeholder: {
    width: 40,
  },
  placeholderCover: {
    alignItems: "center",
    borderRadius: 4,
    height: 50,
    justifyContent: "center",
    marginRight: 12,
    width: 50,
  },
  playPauseButton: {
    alignItems: "center",
    borderRadius: 32,
    height: 64,
    justifyContent: "center",
    width: 64,
  },
  playerControls: {
    borderTopWidth: 1,
    paddingBottom: 36,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  playingBar: {
    borderRadius: 2,
    marginHorizontal: 1,
    width: 4,
  },
  progressBar: {
    height: 40,
    width: "100%",
  },
  progressContainer: {
    marginBottom: 16,
    width: "100%",
  },
  songArtist: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    textAlign: "center",
  },
  songCoverArt: {
    borderRadius: 4,
    height: 50,
    marginRight: 12,
    width: 50,
  },
  songDetails: {
    alignItems: "center",
    marginBottom: 16,
  },
  songItem: {
    borderRadius: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  songItemArtist: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  songItemContent: {
    alignItems: "center",
    flexDirection: "row",
  },
  songItemDetails: {
    flex: 1,
  },
  songItemTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
    marginBottom: 4,
  },
  songListContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  songListContent: {
    paddingBottom: 16,
  },
  songTitle: {
    fontFamily: "Inter-Bold",
    fontSize: 18,
    marginBottom: 4,
    textAlign: "center",
  },
  speedButton: {
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  speedText: {
    fontFamily: "Inter-Medium",
    fontSize: 14,
  },
  timeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  timeText: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
});
