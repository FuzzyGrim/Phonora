import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { ThemeProvider } from "@/context/ThemeContext";
import { useEffect } from "react";
import { useMusicPlayerStore } from "@/store/musicPlayerStore";

export default function RootLayout() {
  const { initializeStore } = useMusicPlayerStore();

  useEffect(() => {
    initializeStore();
  }, [initializeStore]);

  const [fontsLoaded] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ title: "Not Found" }} />
      </Stack>
    </ThemeProvider>
  );
}
