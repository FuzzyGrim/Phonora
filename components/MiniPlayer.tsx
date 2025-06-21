import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import { Play, Pause, SkipForward, Music2 } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function MiniPlayer() {
  const { colors } = useTheme();
  const { playback, pauseSong, resumeSong, skipToNext, getCoverArtUrlCached } =
    useMusicPlayerStore();
  const router = useRouter();
  const [coverArtUrl, setCoverArtUrl] = useState<string>("");

  // Calculate progress percentage
  const progressPercentage =
    playback.duration > 0 ? (playback.position / playback.duration) * 100 : 0;

  // Load cover art URL when current song changes
  useEffect(() => {
    if (playback.currentSong?.coverArt) {
      getCoverArtUrlCached(playback.currentSong.coverArt).then(setCoverArtUrl);
    } else {
      setCoverArtUrl("");
    }
  }, [playback.currentSong?.coverArt, getCoverArtUrlCached]);

  if (!playback.currentSong) return null;

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

  const openFullPlayer = () => {
    router.push("/player");
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface }]}
      onPress={openFullPlayer}
    >
      {/* Progress bar at the top */}
      <View style={styles.progressBarContainer}>
        <View
          style={[
            styles.progressBarBackground,
            { backgroundColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.progressBarFill,
              {
                backgroundColor: colors.primary,
                width: `${progressPercentage}%`,
              },
            ]}
          />
        </View>
      </View>

      {/* Main content */}
      <View style={styles.mainContent}>
        <View style={styles.songInfo}>
          {coverArtUrl ? (
            <Image source={{ uri: coverArtUrl }} style={styles.coverArt} />
          ) : (
            <View
              style={[
                styles.placeholderCover,
                { backgroundColor: colors.border },
              ]}
            >
              <Music2 size={16} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.textContainer}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
            >
              {playback.currentSong.title}
            </Text>
            <Text
              style={[styles.artist, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {playback.currentSong.artist}
            </Text>
          </View>
        </View>
        <View style={styles.controls}>
          <TouchableOpacity onPress={handlePlayPause} style={styles.button}>
            {playback.isPlaying ? (
              <Pause size={24} color={colors.primary} />
            ) : (
              <Play size={24} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSkipNext} style={styles.button}>
            <SkipForward size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  artist: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
  },
  button: {
    padding: 8,
  },
  container: {
    borderTopWidth: 1,
    flexDirection: "column",
  },
  controls: {
    alignItems: "center",
    flexDirection: "row",
  },
  coverArt: {
    borderRadius: 4,
    height: 40,
    marginRight: 12,
    width: 40,
  },
  mainContent: {
    alignItems: "center",
    flexDirection: "row",
    height: 60,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  placeholderCover: {
    alignItems: "center",
    borderRadius: 4,
    height: 40,
    justifyContent: "center",
    marginRight: 12,
    width: 40,
  },
  progressBarBackground: {
    height: "100%",
    width: "100%",
  },
  progressBarContainer: {
    height: 2,
    width: "100%",
  },
  progressBarFill: {
    borderRadius: 1,
    height: "100%",
  },
  songInfo: {
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: "Inter-SemiBold",
    fontSize: 14,
  },
});
