import { Stack } from "expo-router";

export default function LibraryLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="playlists" />
            <Stack.Screen name="artists" />
            <Stack.Screen name="albums" />
            <Stack.Screen name="genres" />
        </Stack>
    );
}
