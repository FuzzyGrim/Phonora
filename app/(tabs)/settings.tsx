import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useSubsonicStore } from '@/store/subsonicStore';
import { CircleCheck as CheckCircle2, Circle as XCircle } from 'lucide-react-native';
import md5 from 'md5';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { config, setConfig } = useSubsonicStore();
  const [serverUrl, setServerUrl] = useState(config?.serverUrl || '');
  const [username, setUsername] = useState(config?.username || '');
  const [password, setPassword] = useState(config?.password || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const validateInputs = () => {
    if (!serverUrl.trim()) {
      setError('Server URL is required');
      return false;
    }
    if (!username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!password.trim()) {
      setError('Password is required');
      return false;
    }
    return true;
  };

  const testConnection = async (params: URLSearchParams) => {
    try {
      const response = await fetch(`${serverUrl}/rest/ping.view?${params.toString()}`);
      const data = await response.json();
      
      if (data['subsonic-response'].status === 'ok') {
        return true;
      } else {
        throw new Error(data['subsonic-response'].error?.message || 'Connection failed');
      }
    } catch (err) {
      throw new Error('Could not connect to server. Please check your settings.');
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
        version: '1.16.1',
      };

      // Create auth params with the new config
      const salt = Math.random().toString(36).substring(2);
      const token = md5(newConfig.password + salt);
      const params = new URLSearchParams({
        u: newConfig.username,
        t: token,
        s: salt,
        v: newConfig.version,
        c: 'subsonicapp',
        f: 'json',
      });

      // Test the connection before saving
      await testConnection(params);
      
      // If we get here, the connection was successful
      setConfig(newConfig);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Server Configuration
          </Text>
          
          {error && (
            <View style={[styles.messageContainer, styles.errorContainer]}>
              <XCircle color={colors.error} size={20} />
              <Text style={[styles.messageText, { color: colors.error }]}>{error}</Text>
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
              style={[styles.input, { 
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }]}
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
              style={[styles.input, { 
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }]}
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
              style={[styles.input, { 
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border
              }]}
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
              isLoading && styles.buttonDisabled
            ]}
            onPress={handleSave}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.text }]}>
                Save Configuration
              </Text>
            )}
          </TouchableOpacity>
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
    fontFamily: 'Inter-Bold',
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    marginBottom: 8,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  button: {
    height: 45,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  successContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  messageText: {
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
});