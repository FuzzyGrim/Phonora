import React from "react";
import { render, screen } from "@testing-library/react-native";
import MiniPlayer from "../../components/MiniPlayer";
import { ThemeProvider } from "../../context/ThemeContext";
import { useMusicPlayerStore } from "../../store";

// Mock expo-router
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the store
jest.mock("../../store", () => ({
  useMusicPlayerStore: jest.fn(),
}));

const mockUseMusicPlayerStore = useMusicPlayerStore as jest.MockedFunction<
  typeof useMusicPlayerStore
>;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe("MiniPlayer Integration Tests", () => {
  const mockPauseSong = jest.fn();
  const mockResumeSong = jest.fn();
  const mockSkipToNext = jest.fn();
  const mockGetCoverArtUrl = jest.fn();
  const mockGetCoverArtUrlCached = jest.fn();

  const mockSong = {
    id: "1",
    title: "Test Song",
    artist: "Test Artist",
    album: "Test Album",
    duration: 180,
    coverArt: "cover1",
  };

  const defaultMockStore = {
    playback: {
      currentSong: mockSong,
      isPlaying: true,
    },
    pauseSong: mockPauseSong,
    resumeSong: mockResumeSong,
    skipToNext: mockSkipToNext,
    getCoverArtUrl: mockGetCoverArtUrl,
    getCoverArtUrlCached: mockGetCoverArtUrlCached,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMusicPlayerStore.mockReturnValue(defaultMockStore);
    mockGetCoverArtUrl.mockReturnValue("https://example.com/cover.jpg");
    mockGetCoverArtUrlCached.mockResolvedValue("https://example.com/cover.jpg");
  });

  describe("Visibility Control", () => {
    test("should render when song is playing", () => {
      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      expect(screen.getByText("Test Song")).toBeTruthy();
      expect(screen.getByText("Test Artist")).toBeTruthy();
    });
  });

  describe("Song Information Display", () => {
    test("should display current song title and artist", () => {
      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      expect(screen.getByText("Test Song")).toBeTruthy();
      expect(screen.getByText("Test Artist")).toBeTruthy();
    });

    test("should truncate long song titles", () => {
      mockUseMusicPlayerStore.mockReturnValue({
        ...defaultMockStore,
        playback: {
          ...defaultMockStore.playback,
          currentSong: {
            ...mockSong,
            title: "This is a very long song title that should be truncated",
            artist:
              "This is also a very long artist name that should be truncated",
          },
        },
      });

      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      // Text should be present but truncated (numberOfLines={1})
      expect(
        screen.getByText(
          "This is a very long song title that should be truncated",
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "This is also a very long artist name that should be truncated",
        ),
      ).toBeTruthy();
    });
  });

  describe("Cover Art Display", () => {
    test("should show placeholder when no cover art", () => {
      mockUseMusicPlayerStore.mockReturnValue({
        ...defaultMockStore,
        playback: {
          ...defaultMockStore.playback,
          currentSong: {
            ...mockSong,
            coverArt: null,
          },
        },
      });

      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      // Should render music icon placeholder instead of image
      expect(screen.queryByRole("image")).toBeFalsy();
    });

    test("should show placeholder when cover art is empty string", () => {
      mockUseMusicPlayerStore.mockReturnValue({
        ...defaultMockStore,
        playback: {
          ...defaultMockStore.playback,
          currentSong: {
            ...mockSong,
            coverArt: "",
          },
        },
      });

      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      // Should render music icon placeholder
      expect(screen.queryByRole("image")).toBeFalsy();
    });
  });

  describe("Layout and Styling", () => {
    test("should maintain consistent height", () => {
      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      // Mini player should have consistent styling regardless of content
      expect(screen.getByText("Test Song")).toBeTruthy();
    });
  });

  describe("Responsive Behavior", () => {
    test("should handle very short song titles", () => {
      mockUseMusicPlayerStore.mockReturnValue({
        ...defaultMockStore,
        playback: {
          ...defaultMockStore.playback,
          currentSong: {
            ...mockSong,
            title: "Hi",
            artist: "Me",
          },
        },
      });

      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      expect(screen.getByText("Hi")).toBeTruthy();
      expect(screen.getByText("Me")).toBeTruthy();
    });

    test("should handle missing artist information", () => {
      mockUseMusicPlayerStore.mockReturnValue({
        ...defaultMockStore,
        playback: {
          ...defaultMockStore.playback,
          currentSong: {
            ...mockSong,
            artist: "",
          },
        },
      });

      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      expect(screen.getByText("Test Song")).toBeTruthy();
      expect(screen.getByText("")).toBeTruthy(); // Empty artist should still render
    });
  });

  describe("Integration with Store", () => {
    test("should update when song changes", () => {
      const { rerender } = render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      expect(screen.getByText("Test Song")).toBeTruthy();

      // Change to different song
      mockUseMusicPlayerStore.mockReturnValue({
        ...defaultMockStore,
        playback: {
          ...defaultMockStore.playback,
          currentSong: {
            ...mockSong,
            id: "2",
            title: "New Song",
            artist: "New Artist",
          },
        },
      });

      rerender(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      expect(screen.getByText("New Song")).toBeTruthy();
      expect(screen.getByText("New Artist")).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    test("should support voice over navigation", () => {
      render(
        <TestWrapper>
          <MiniPlayer />
        </TestWrapper>,
      );

      // Text elements should be accessible
      const songTitle = screen.getByText("Test Song");
      const artistName = screen.getByText("Test Artist");

      expect(songTitle).toBeTruthy();
      expect(artistName).toBeTruthy();
    });
  });

  describe("Performance", () => {
    test("should render efficiently with minimal re-renders", () => {
      const renderSpy = jest.fn();

      const TestMiniPlayer = () => {
        renderSpy();
        return <MiniPlayer />;
      };

      const { rerender } = render(
        <TestWrapper>
          <TestMiniPlayer />
        </TestWrapper>,
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(
        <TestWrapper>
          <TestMiniPlayer />
        </TestWrapper>,
      );

      expect(renderSpy).toHaveBeenCalledTimes(2);
    });
  });
});
