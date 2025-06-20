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
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { useMusicPlayerStore } from "@/store";
import {
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  MinusCircle,
  PlusCircle,
  HardDrive,
  Trash2,
} from "lucide-react-native";
import md5 from "md5";
import { router } from "expo-router";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const {
    config,
    setConfig,
    userSettings,
    setUserSettings,
    networkState,
    clearAllData,
  } = useMusicPlayerStore();
  const [serverUrl, setServerUrl] = useState(config?.serverUrl || "");
  const [username, setUsername] = useState(config?.username || "");
  const [password, setPassword] = useState(config?.password || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [offlineMode, setOfflineMode] = useState(userSettings.offlineMode);
  const [maxCacheSize, setMaxCacheSize] = useState<number>(
    userSettings.maxCacheSize || 10,
  );
  const [maxCacheSizeInput, setMaxCacheSizeInput] = useState<string>(
    (userSettings.maxCacheSize || 10).toString(),
  );

  // Auto-save settings when values change (with debounce for maxCacheSize)
  useEffect(() => {
    const saveSettings = async () => {
      try {
        await setUserSettings({
          offlineMode,
          maxCacheSize,
        });
      } catch (error) {
        console.error("Failed to save settings:", error);
      }
    };

    // Debounce the save for maxCacheSize changes
    const timeoutId = setTimeout(() => {
      saveSettings();
    }, 1000); // Wait 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [offlineMode, maxCacheSize, setUserSettings]);

  // Sync local state when userSettings changes (e.g., when loaded from storage or auto-updated)
  useEffect(() => {
    setOfflineMode(userSettings.offlineMode);
  }, [userSettings.offlineMode]);

  // Sync local state when userSettings changes (e.g., when loaded from storage)
  useEffect(() => {
    if (userSettings.maxCacheSize !== undefined) {
      console.log(
        `Syncing userSettings.maxCacheSize: ${userSettings.maxCacheSize} (type: ${typeof userSettings.maxCacheSize})`,
      );
      setMaxCacheSize(userSettings.maxCacheSize);
      setMaxCacheSizeInput(userSettings.maxCacheSize.toString());
    }
  }, [userSettings.maxCacheSize]);

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
    // Note: If user disables offline mode while having no internet,
    // the updateNetworkState function will re-enable it automatically
  };

  const incrementCacheSize = () => {
    const newSize = Math.min(maxCacheSize + 1, 100); // Cap at 100GB
    setMaxCacheSize(newSize);
    setMaxCacheSizeInput(newSize.toString());
  };

  const decrementCacheSize = () => {
    const newSize = Math.max(maxCacheSize - 1, 0.1); // Minimum 0.1GB
    setMaxCacheSize(newSize);
    setMaxCacheSizeInput(newSize.toString());
  };

  const handleClearAllData = () => {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all your app data including:\n\n• Server credentials\n• User settings\n• All cached songs and images\n\nThis action cannot be undone. Are you sure you want to continue?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear All Data",
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await clearAllData();

              // Reset local component state to default values
              setServerUrl("");
              setUsername("");
              setPassword("");
              setError(null);
              setSuccess(false);
              setOfflineMode(false);
              setMaxCacheSize(10);
              setMaxCacheSizeInput("10");

              Alert.alert(
                "Success",
                "All app data has been cleared successfully.",
                [
                  {
                    text: "OK",
                    onPress: async () => {
                      // Small delay to allow the state to settle
                      setTimeout(async () => {
                        // Force re-initialization of the store to ensure clean state
                        const { initializeStore } =
                          useMusicPlayerStore.getState();
                        await initializeStore();

                        // Navigate to the home screen to ensure a fresh start
                        router.replace("/(tabs)");
                      }, 100);
                    },
                  },
                ],
              );
            } catch (error) {
              console.error("Failed to clear all data:", error);
              Alert.alert(
                "Error",
                "Failed to clear all data. Please try again.",
                [{ text: "OK" }],
              );
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoidingView}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 30}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
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
              <View
                style={[
                  styles.messageContainer,
                  { backgroundColor: colors.error + "20" },
                ]}
              >
                <XCircle color={colors.error} size={20} />
                <Text style={[styles.messageText, { color: colors.error }]}>
                  {error}
                </Text>
              </View>
            )}

            {success && (
              <View
                style={[
                  styles.messageContainer,
                  styles.successContainer,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
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
                placeholder="https://your-server.com"
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
              <Text
                style={[styles.helperText, { color: colors.textSecondary }]}
              >
                When enabled, the app will use only cached content when no
                internet connection is available
              </Text>
              {!networkState.isConnected && offlineMode && (
                <Text
                  style={[
                    styles.helperText,
                    styles.warningText,
                    { color: colors.primary },
                  ]}
                >
                  ⚠️ Offline mode automatically enabled due to no internet
                  connection
                </Text>
              )}
              {!networkState.isConnected && !offlineMode && (
                <Text
                  style={[
                    styles.helperText,
                    styles.errorText,
                    { color: colors.error },
                  ]}
                >
                  ⚠️ No internet connection detected. Offline mode will be
                  re-enabled automatically.
                </Text>
              )}
            </View>
          </View>

          {/* Unified Cache Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Cache Management
            </Text>

            {/* Cache Size Control */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Max Cache Size (GB)
              </Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    { backgroundColor: colors.surface },
                  ]}
                  onPress={decrementCacheSize}
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
                  value={maxCacheSizeInput}
                  onChangeText={(text) => {
                    // Store the raw input for display
                    setMaxCacheSizeInput(text);

                    // Normalize decimal separator (replace comma with dot for parsing)
                    const normalizedText = text.replace(",", ".");

                    // Only update the actual maxCacheSize if it's a valid number
                    const numValue = parseFloat(normalizedText);
                    if (!isNaN(numValue) && numValue >= 0) {
                      setMaxCacheSize(numValue);
                    }
                  }}
                  onBlur={() => {
                    // Normalize decimal separator for parsing
                    const normalizedInput = maxCacheSizeInput.replace(",", ".");
                    const numValue = parseFloat(normalizedInput);

                    if (isNaN(numValue) || numValue < 0) {
                      // Reset to previous valid value
                      setMaxCacheSizeInput(maxCacheSize.toString());
                    } else {
                      // Update to cleaned value, preserving decimals
                      setMaxCacheSize(numValue);
                      setMaxCacheSizeInput(numValue.toString());
                    }
                  }}
                  placeholder="10.0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[
                    styles.stepperButton,
                    { backgroundColor: colors.surface },
                  ]}
                  onPress={incrementCacheSize}
                >
                  <PlusCircle color={colors.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
              <Text
                style={[styles.helperText, { color: colors.textSecondary }]}
              >
                Maximum storage space for all cached files (songs and images) in
                GB
              </Text>
            </View>

            {/* View Cached Songs Button */}
            <TouchableOpacity
              style={[
                styles.viewCachedButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => router.push("/cached-songs")}
            >
              <View style={styles.buttonContent}>
                <HardDrive color={colors.textSecondary} size={18} />
                <Text
                  style={[styles.viewCachedButtonText, { color: colors.text }]}
                >
                  View Cached Songs
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Clear All Data Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Data Management
            </Text>
            <Text
              style={[
                styles.clearDataHelperText,
                { color: colors.textSecondary },
              ]}
            >
              Clear all app data including server credentials, user settings,
              and cached files. This action cannot be undone.
            </Text>
            <TouchableOpacity
              style={[
                styles.clearAllDataButton,
                {
                  backgroundColor: colors.error + "20",
                  borderColor: colors.error,
                },
                isLoading && styles.buttonDisabled,
              ]}
              onPress={handleClearAllData}
              disabled={isLoading}
            >
              <View style={styles.buttonContent}>
                <Trash2 color={colors.error} size={18} />
                <Text
                  style={[
                    styles.clearAllDataButtonText,
                    { color: colors.error },
                  ]}
                >
                  Clear All Data
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    height: 45,
    justifyContent: "center",
    marginTop: 20,
  },
  buttonContent: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: "Inter-SemiBold",
    fontSize: 16,
  },
  clearAllDataButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 45,
    justifyContent: "center",
  },
  clearAllDataButtonText: {
    fontFamily: "Inter-Medium",
    fontSize: 16,
    marginLeft: 10,
  },
  clearDataHelperText: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  errorText: {
    marginTop: 8,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  helperText: {
    fontFamily: "Inter-Regular",
    fontSize: 12,
    marginTop: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontFamily: "Inter-Regular",
    fontSize: 16,
    height: 45,
    paddingHorizontal: 12,
  },
  inputGroup: {
    marginBottom: 15,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  label: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginBottom: 8,
  },
  messageContainer: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    marginBottom: 16,
    padding: 12,
  },
  messageText: {
    fontFamily: "Inter-Regular",
    fontSize: 14,
    marginLeft: 8,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontFamily: "Inter-SemiBold",
    fontSize: 20,
    marginBottom: 20,
  },
  settingLabel: {
    fontFamily: "Inter-Regular",
    fontSize: 16,
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    height: 45,
  },
  stepperButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 45,
    justifyContent: "center",
    width: 45,
  },
  stepperInput: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    fontFamily: "Inter-Regular",
    fontSize: 16,
    height: 45,
    marginHorizontal: 8,
    paddingHorizontal: 12,
    textAlign: "center",
  },
  successContainer: {
    // Background color will be applied inline with theme colors
  },
  title: {
    fontFamily: "Inter-Bold",
    fontSize: 32,
  },
  viewCachedButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 45,
    justifyContent: "center",
    marginTop: 12,
  },
  viewCachedButtonText: {
    fontFamily: "Inter-Medium",
    fontSize: 16,
    marginLeft: 10,
  },
  warningText: {
    marginTop: 8,
  },
});
