import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";
import {
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  Trash2,
  MinusCircle,
  PlusCircle,
} from "lucide-react-native";
import md5 from "md5";
import * as FileSystem from "expo-file-system";

// Define cache directories
const AUDIO_DIRECTORY = FileSystem.cacheDirectory + "audio/";
const IMAGE_DIRECTORY = FileSystem.cacheDirectory + "image/";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { config, setConfig, userSettings, setUserSettings, clearCache } =
    useMusicPlayerStore();
  const [serverUrl, setServerUrl] = useState(config?.serverUrl || "");
  const [username, setUsername] = useState(config?.username || "");
  const [password, setPassword] = useState(config?.password || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [audioCacheSize, setAudioCacheSize] = useState<number | null>(null);
  const [imageCacheSize, setImageCacheSize] = useState<number | null>(null);
  const [isCalculatingCache, setIsCalculatingCache] = useState(false);
  const [offlineMode, setOfflineMode] = useState(userSettings.offlineMode);
  const [maxAudioCacheSize, setMaxAudioCacheSize] = useState<number>(
    userSettings.maxAudioCacheSize || 5,
  );

  const [maxImageCacheSize, setMaxImageCacheSize] = useState<number>(
    userSettings.maxImageCacheSize || 5,
  );

  // Calculate cache size on component mount
  useEffect(() => {
    calculateCacheSize();
  }, []);

  // Auto-save settings when values change
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await setUserSettings({
          offlineMode,
          maxAudioCacheSize,
          maxImageCacheSize,
        });
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    };

    saveSettings();
  }, [offlineMode, maxAudioCacheSize, maxImageCacheSize, setUserSettings]);

  const validateInputs = () => {
    if (!serverUrl.trim()) {
      setError("Server URL is required");
      return false;
    }
    if (!username.trim()) {
      setError("Username is required");
      return false;
    }
    if (!password.trim()) {
      setError("Password is required");
      return false;
    }
    return true;
  };

  const testConnection = async (params: URLSearchParams) => {
    try {
      const response = await fetch(
        `${serverUrl}/rest/ping.view?${params.toString()}`,
      );
      const data = await response.json();

      if (data["subsonic-response"].status === "ok") {
        return true;
      } else {
        throw new Error(
          data["subsonic-response"].error?.message || "Connection failed",
        );
      }
    } catch (err) {
      throw new Error(
        `Could not connect to server. Please check your settings. Details: ${err instanceof Error ? err.message : String(error)}`,
      );
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(false);

      if (!validateInputs()) {
        return;
      }

      setIsLoading(true);

      const newConfig = {
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
        version: "1.16.1",
      };

      // Create auth params with the new config
      const salt = Math.random().toString(36).substring(2);
      const token = md5(newConfig.password + salt);
      const params = new URLSearchParams({
        u: newConfig.username,
        t: token,
        s: salt,
        v: newConfig.version,
        c: "subsonicapp",
        f: "json",
      });

      // Test the connection before saving
      await testConnection(params);

      // If we get here, the connection was successful
      setConfig(newConfig);
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOfflineMode = (value: boolean) => {
    setOfflineMode(value);
  };

  const calculateCacheSize = async () => {
    setIsCalculatingCache(true);
    try {
      // Check if directories exist
      const audioDirInfo = await FileSystem.getInfoAsync(AUDIO_DIRECTORY);
      const imageDirInfo = await FileSystem.getInfoAsync(IMAGE_DIRECTORY);

      let audioSize = 0;
      let imageSize = 0;

      if (audioDirInfo.exists) {
        const audioFiles = await FileSystem.readDirectoryAsync(AUDIO_DIRECTORY);
        for (const file of audioFiles) {
          const fileInfo = await FileSystem.getInfoAsync(
            `${AUDIO_DIRECTORY}${file}`,
          );
          if (fileInfo.exists && fileInfo.size) {
            audioSize += fileInfo.size;
          }
        }
      }

      if (imageDirInfo.exists) {
        const imageFiles = await FileSystem.readDirectoryAsync(IMAGE_DIRECTORY);
        for (const file of imageFiles) {
          const fileInfo = await FileSystem.getInfoAsync(
            `${IMAGE_DIRECTORY}${file}`,
          );
          if (fileInfo.exists && fileInfo.size) {
            imageSize += fileInfo.size;
          }
        }
      }

      // Convert to MB
      const audioSizeMB = audioSize / (1024 * 1024);
      const imageSizeMB = imageSize / (1024 * 1024);

      setAudioCacheSize(audioSizeMB);
      setImageCacheSize(imageSizeMB);
    } catch (error) {
      console.error("Error calculating cache size:", error);
      setAudioCacheSize(null);
      setImageCacheSize(null);
    } finally {
      setIsCalculatingCache(false);
    }
  };

  const handleClearCache = async (type?: "audio" | "image") => {
    const typeText =
      type === "audio"
        ? "cached audio"
        : type === "image"
          ? "cached image"
          : "all cached audio and image";

    Alert.alert("Clear Cache", `Are you sure you want to clear ${typeText}?`, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          setIsCalculatingCache(true);
          try {
            await clearCache(type);
            if (!type || type === "audio") setAudioCacheSize(0);
            if (!type || type === "image") setImageCacheSize(0);
            Alert.alert(
              "Success",
              `${typeText.charAt(0).toUpperCase() + typeText.slice(1)} cleared successfully`,
            );
          } catch (error) {
            Alert.alert(
              "Error",
              `Failed to clear ${typeText}, error: ${error}`,
            );
          } finally {
            setIsCalculatingCache(false);
          }
        },
      },
    ]);
  };

  const incrementCacheSize = (type: "audio" | "image") => {
    if (type === "audio") {
      setMaxAudioCacheSize(maxAudioCacheSize + 0.5);
    } else {
      setMaxImageCacheSize(maxImageCacheSize + 0.5);
    }
  };

  const decrementCacheSize = (type: "audio" | "image") => {
    if (type === "audio") {
      setMaxAudioCacheSize(Math.max(0.5, maxAudioCacheSize - 0.5));
    } else {
      setMaxImageCacheSize(Math.max(0.5, maxImageCacheSize - 0.5));
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <View style={styles.content}>
        {/* Server Configuration Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Server Configuration
          </Text>

          {error && (
            <View style={[styles.messageContainer, styles.errorContainer]}>
              <XCircle color={colors.error} size={20} />
              <Text style={[styles.messageText, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          )}

          {success && (
            <View style={[styles.messageContainer, styles.successContainer]}>
              <CheckCircle2 color={colors.success} size={20} />
              <Text style={[styles.messageText, { color: colors.success }]}>
                Connection successful!
              </Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Server URL
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={serverUrl}
              onChangeText={(text) => {
                setServerUrl(text);
                setError(null);
                setSuccess(false);
              }}
              placeholder="https://your-server.com/subsonic"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Username
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setError(null);
                setSuccess(false);
              }}
              placeholder="Username"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Password
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
                setSuccess(false);
              }}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.text }]}>
                Save Configuration
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Offline Mode Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Offline Mode
          </Text>
          <View>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Enable Offline Mode
              </Text>
              <Switch
                value={offlineMode}
                onValueChange={toggleOfflineMode}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              When enabled, the app will use only cached content when no
              internet connection is available
            </Text>
          </View>
        </View>

        {/* Audio Cache Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Audio Cache
          </Text>

          {/* Audio Cache Info */}
          <View style={[styles.cacheInfoContainer]}>
            <Text style={[styles.cacheInfoText, { color: colors.text }]}>
              {isCalculatingCache
                ? "Calculating audio cache size..."
                : audioCacheSize !== null
                  ? `Space usage: ${audioCacheSize.toFixed(2)} MB`
                  : "Space usage unavailable"}
            </Text>
            <TouchableOpacity
              style={[
                styles.smallClearButton,
                { backgroundColor: colors.error },
              ]}
              onPress={() => handleClearCache("audio")}
              disabled={isCalculatingCache}
            >
              <Trash2 color={colors.text} size={14} />
            </TouchableOpacity>
          </View>

          {/* Audio Cache Size Control */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Max Audio Cache Size (GB)
            </Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  { backgroundColor: colors.surface },
                ]}
                onPress={() => decrementCacheSize("audio")}
              >
                <MinusCircle color={colors.textSecondary} size={20} />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.stepperInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={maxAudioCacheSize.toString()}
                onChangeText={(text) => {
                  const numValue = parseFloat(text);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setMaxAudioCacheSize(numValue);
                  }
                }}
                placeholder="5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  { backgroundColor: colors.surface },
                ]}
                onPress={() => incrementCacheSize("audio")}
              >
                <PlusCircle color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Maximum storage space for cached audio files (in GB)
            </Text>
          </View>
        </View>

        {/* Image Cache Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Image Cache
          </Text>

          {/* Image Cache Info */}
          <View style={[styles.cacheInfoContainer]}>
            <Text style={[styles.cacheInfoText, { color: colors.text }]}>
              {isCalculatingCache
                ? "Calculating image cache size..."
                : imageCacheSize !== null
                  ? `Space usage: ${imageCacheSize.toFixed(2)} MB`
                  : "Space usage unavailable"}
            </Text>
            <TouchableOpacity
              style={[
                styles.smallClearButton,
                { backgroundColor: colors.error },
              ]}
              onPress={() => handleClearCache("image")}
              disabled={isCalculatingCache}
            >
              <Trash2 color={colors.text} size={14} />
            </TouchableOpacity>
          </View>

          {/* Image Cache Size Control */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Max Image Cache Size (GB)
            </Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  { backgroundColor: colors.surface },
                ]}
                onPress={() => decrementCacheSize("image")}
              >
                <MinusCircle color={colors.textSecondary} size={20} />
              </TouchableOpacity>
              <TextInput
                style={[
                  styles.stepperInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                value={maxImageCacheSize.toString()}
                onChangeText={(text) => {
                  const numValue = parseFloat(text);
                  if (!isNaN(numValue) && numValue >= 0) {
                    setMaxImageCacheSize(numValue);
                  }
                }}
                placeholder="5"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={[
                  styles.stepperButton,
                  { backgroundColor: colors.surface },
                ]}
                onPress={() => incrementCacheSize("image")}
              >
                <PlusCircle color={colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Maximum storage space for cached images (in GB)
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: "Inter-Bold",
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: "Inter-SemiBold",
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginBottom: 8,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: "Inter-Regular",
  },
  button: {
    height: 45,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  successContainer: {
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  messageText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
  cacheInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 8,
  },
  cacheInfoText: {
    fontSize: 14,
    fontFamily: "Inter-Regular",
    flex: 1,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: "Inter-Regular",
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: "Inter-Regular",
  },
  buttonGroup: {
    marginTop: 10,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    height: 45,
  },
  stepperButton: {
    width: 45,
    height: 45,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  stepperInput: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
  smallClearButton: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    marginLeft: 8,
  },
});
