/**
 * Integration tests for Home Screen
 * Tests the integration between HomeScreen component, store, and user interactions
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import HomeScreen from "../../app/(tabs)/index";
import { ThemeProvider } from "../../context/ThemeContext";
import { useMusicPlayerStore } from "../../store";
import { Song } from "../../store/types";

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

// Mock the store
jest.mock("../../store", () => ({
  useMusicPlayerStore: jest.fn(),
}));

const mockStore = useMusicPlayerStore as jest.MockedFunction<
  typeof useMusicPlayerStore
>;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("HomeScreen Integration Tests", () => {
  const mockSongs: Song[] = [
    {
      id: "song1",
      title: "Test Song 1",
      artist: "Test Artist 1",
      album: "Test Album 1",
      duration: 180,
      coverArt: "cover1",
    },
    {
      id: "song2",
      title: "Test Song 2",
      artist: "Test Artist 2",
      album: "Test Album 2",
      duration: 240,
      coverArt: "cover2",
    },
  ];

  const defaultMockStore = {
    isLoading: false,
    error: null,
    fetchSongs: jest.fn(),
    getCoverArtUrl: jest.fn(
      (coverArt: string) => `https://example.com/${coverArt}`,
    ),
    pauseSong: jest.fn(),
    resumeSong: jest.fn(),
    playback: {
      currentSong: null,
      isPlaying: false,
      position: 0,
      duration: 0,
    },
    playSongFromSource: jest.fn(),
    isOfflineMode: false,
    networkState: { isConnected: true },
    getAvailableSongs: jest.fn(() => mockSongs),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.mockReturnValue(defaultMockStore);
  });

  describe("Offline Mode", () => {
    it("should show offline indicator when in offline mode", () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        isOfflineMode: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <HomeScreen />
        </TestWrapper>,
      );

      expect(getByText("Offline Music")).toBeTruthy();
      expect(getByText("Offline")).toBeTruthy();
    });

    it("should show network banner when not connected", () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        networkState: { isConnected: false },
      });

      const { getByText } = render(
        <TestWrapper>
          <HomeScreen />
        </TestWrapper>,
      );

      expect(
        getByText(
          "No internet connection. Offline mode enabled automatically.",
        ),
      ).toBeTruthy();
    });

    it("should show empty state message for offline mode when no cached songs", () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        isOfflineMode: true,
        getAvailableSongs: jest.fn(() => []),
      });

      const { getByText } = render(
        <TestWrapper>
          <HomeScreen />
        </TestWrapper>,
      );

      expect(
        getByText("No cached songs available for offline playback"),
      ).toBeTruthy();
      expect(
        getByText("Connect to the internet to browse and cache music"),
      ).toBeTruthy();
    });
  });

  describe("Song List", () => {
    it("should render list of songs", () => {
      const { getByText } = render(
        <TestWrapper>
          <HomeScreen />
        </TestWrapper>,
      );

      expect(getByText("Test Song 1")).toBeTruthy();
      expect(getByText("Test Artist 1")).toBeTruthy();
      expect(getByText("Test Album 1")).toBeTruthy();
      expect(getByText("Test Song 2")).toBeTruthy();
      expect(getByText("Test Artist 2")).toBeTruthy();
      expect(getByText("Test Album 2")).toBeTruthy();
    });

    it("should show duration in correct format", () => {
      const { getByText } = render(
        <TestWrapper>
          <HomeScreen />
        </TestWrapper>,
      );

      expect(getByText("3:00")).toBeTruthy(); // 180 seconds
      expect(getByText("4:00")).toBeTruthy(); // 240 seconds
    });
  });

  describe("Error Handling", () => {
    it("should show retry button and call fetchSongs when retry is pressed", async () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        error: "Network error",
      });

      const { getByText } = render(
        <TestWrapper>
          <HomeScreen />
        </TestWrapper>,
      );

      fireEvent.press(getByText("Retry"));

      await waitFor(() => {
        expect(defaultMockStore.fetchSongs).toHaveBeenCalled();
      });
    });
  });
});
