/**
 * Integration tests for Search Screen
 * Tests the integration between SearchScreen component, store, and user interactions
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import SearchScreen from "../../app/(tabs)/search";
import { ThemeProvider } from "../../context/ThemeContext";
import { useMusicPlayerStore } from "../../store";
import { Song, Artist, Album } from "../../store/types";
import { router } from "expo-router";

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
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

describe("SearchScreen Integration Tests", () => {
  const mockSongs: Song[] = [
    {
      id: "song1",
      title: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      duration: 180,
      coverArt: "cover1",
    },
  ];

  const mockArtists: Artist[] = [
    {
      id: "artist1",
      name: "Test Artist",
      albumCount: 2,
    },
  ];

  const mockAlbums: Album[] = [
    {
      id: "album1",
      name: "Test Album",
      artist: "Test Artist",
      songCount: 5,
    },
  ];

  const mockSearchResults = {
    songs: mockSongs,
    artists: mockArtists,
    albums: mockAlbums,
  };

  const defaultMockStore = {
    search: jest.fn(),
    getCoverArtUrl: jest.fn(
      (coverArt: string) => `https://example.com/${coverArt}`,
    ),
    playSongFromSource: jest.fn(),
    pauseSong: jest.fn(),
    resumeSong: jest.fn(),
    playback: {
      currentSong: null,
      isPlaying: false,
      position: 0,
      duration: 0,
    },
    searchResults: null,
    isSearching: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.mockReturnValue(defaultMockStore);
  });

  describe("Search Input", () => {
    it("should render search input with placeholder", () => {
      const { getByPlaceholderText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      expect(
        getByPlaceholderText("Search songs, albums, or artists"),
      ).toBeTruthy();
    });

    it("should show initial message when no search query", () => {
      const { getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      expect(getByText("Start typing to search")).toBeTruthy();
    });

    it("should update search query when text is entered", () => {
      const { getByPlaceholderText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test query");

      expect(searchInput.props.value).toBe("test query");
    });
  });

  describe("Search Functionality", () => {
    it("should call searchSongs when search query changes with debounce", async () => {
      jest.useFakeTimers();

      const { getByPlaceholderText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      // Fast-forward time to trigger debounced search
      jest.advanceTimersByTime(500);

      await waitFor(() => {
        expect(defaultMockStore.search).toHaveBeenCalledWith("test");
      });

      jest.useRealTimers();
    });

    it("should show loading indicator while searching", () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        isSearching: true,
      });

      const { getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      expect(getByText("Searching...")).toBeTruthy();
    });

    it("should call search function when query changes", async () => {
      jest.useFakeTimers();

      const { getByPlaceholderText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );

      // Test empty query
      fireEvent.changeText(searchInput, "");
      expect(defaultMockStore.search).toHaveBeenCalledWith("");

      // Clear mock calls to test the next call
      defaultMockStore.search.mockClear();

      // Test short query
      fireEvent.changeText(searchInput, "a");
      jest.advanceTimersByTime(500);

      await waitFor(() => {
        expect(defaultMockStore.search).toHaveBeenCalledWith("a");
      });

      jest.useRealTimers();
    });
  });

  describe("Search Results Display", () => {
    beforeEach(() => {
      // Mock successful search
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: mockSearchResults,
      });
    });

    it("should display artist results", async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        expect(getByText("Artists")).toBeTruthy();
        expect(getByText("Test Artist")).toBeTruthy();
        expect(getByText("Artist")).toBeTruthy();
      });
    });

    it("should display album results", async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        expect(getByText("Albums")).toBeTruthy();
        expect(getByText("Test Album")).toBeTruthy();
        expect(getByText("Test Artist • 5 songs")).toBeTruthy();
      });
    });

    it("should display song results", async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        expect(getByText("Songs")).toBeTruthy();
        expect(getByText("Test Song")).toBeTruthy();
        expect(getByText("Test Artist • Test Album")).toBeTruthy();
      });
    });

    it("should show no results message when search returns empty", async () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: { songs: [], artists: [], albums: [] },
      });

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "nonexistent");

      await waitFor(() => {
        expect(getByText("No results found")).toBeTruthy();
      });
    });
  });

  describe("Result Navigation", () => {
    const mockRouter = router;

    beforeEach(() => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: mockSearchResults,
      });
    });

    it("should navigate to artist details when artist is tapped", async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        const artistName = getByText("Test Artist");
        // Find the parent touchable element by traversing up from the text
        const artistItem = artistName.parent?.parent;
        expect(artistItem).toBeTruthy();

        fireEvent.press(artistItem!);

        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: "/(tabs)/artist-details",
          params: { id: "artist1", source: "search" },
        });
      });
    });

    it("should navigate to album details when album is tapped", async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        const albumName = getByText("Test Album");
        // Find the parent touchable element by traversing up from the text
        const albumItem = albumName.parent?.parent;
        expect(albumItem).toBeTruthy();

        fireEvent.press(albumItem!);

        expect(mockRouter.push).toHaveBeenCalledWith({
          pathname: "/(tabs)/album-details",
          params: { id: "album1", source: "search" },
        });
      });
    });
  });

  describe("Song Playback", () => {
    beforeEach(() => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: mockSearchResults,
      });
    });

    it("should play song when song item is tapped", async () => {
      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        const songTitle = getByText("Test Song");
        // Find the parent touchable element by traversing up from the text
        const songItem = songTitle.parent?.parent;
        expect(songItem).toBeTruthy();

        fireEvent.press(songItem!);

        expect(defaultMockStore.playSongFromSource).toHaveBeenCalledWith(
          mockSongs[0],
          mockSongs,
        );
      });
    });

    it("should show currently playing song in search results", async () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: mockSearchResults,
        playback: {
          ...defaultMockStore.playback,
          currentSong: mockSongs[0],
          isPlaying: true,
        },
      });

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        // Verify the currently playing song is displayed
        expect(getByText("Test Song")).toBeTruthy();
      });
    });

    it("should pause currently playing song when tapped again", async () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: mockSearchResults,
        playback: {
          ...defaultMockStore.playback,
          currentSong: mockSongs[0],
          isPlaying: true,
        },
      });

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        const songTitle = getByText("Test Song");
        // The song item itself can be pressed to pause when it's playing
        const songItem = songTitle.parent?.parent;
        expect(songItem).toBeTruthy();

        fireEvent.press(songItem!);

        expect(defaultMockStore.pauseSong).toHaveBeenCalled();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle search errors gracefully", async () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: null,
        error: "Search failed",
      });

      const { getByPlaceholderText, getByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );
      fireEvent.changeText(searchInput, "test");

      await waitFor(() => {
        expect(getByText("No results found")).toBeTruthy();
      });
    });
  });

  describe("Search History and UX", () => {
    it("should clear results when search query is cleared", async () => {
      mockStore.mockReturnValue({
        ...defaultMockStore,
        searchResults: mockSearchResults,
      });

      const { getByPlaceholderText, getByText, queryByText } = render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = getByPlaceholderText(
        "Search songs, albums, or artists",
      );

      // First search
      fireEvent.changeText(searchInput, "test");
      await waitFor(() => {
        expect(getByText("Test Song")).toBeTruthy();
      });

      // Clear search
      fireEvent.changeText(searchInput, "");
      await waitFor(() => {
        expect(queryByText("Test Song")).toBeNull();
        expect(getByText("Start typing to search")).toBeTruthy();
      });
    });
  });
});
