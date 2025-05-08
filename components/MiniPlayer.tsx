import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import { Play, Pause, SkipForward, Music2 } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function MiniPlayer() {
  const { colors } = useTheme();
  const { playback, pauseSong, resumeSong, skipToNext, getCoverArtUrl } =
    useMusicPlayerStore();
  const router = useRouter();

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
      <View style={styles.songInfo}>
        {playback.currentSong.coverArt ? (
          <Image
            source={{ uri: getCoverArtUrl(playback.currentSong.coverArt) }}
            style={styles.coverArt}
          />
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  songInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  coverArt: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  placeholderCover: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter-SemiBold",
  },
  artist: {
    fontSize: 12,
    fontFamily: "Inter-Regular",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    padding: 8,
  },
});
