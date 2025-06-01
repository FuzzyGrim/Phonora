/**
 * Integration tests for Library Screens
 * Tests the integration between LibraryScreen and its child screens
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LibraryScreen from '../../app/(tabs)/library';
import AlbumsScreen from '../../app/(library)/albums';
import ArtistsScreen from '../../app/(library)/artists';
import PlaylistsScreen from '../../app/(library)/playlists';
import GenresScreen from '../../app/(library)/genres';
import { ThemeProvider } from '../../context/ThemeContext';
import { useMusicPlayerStore } from '../../store';
import { Album, Artist, Playlist, Genre } from '../../store/types';

// Mock expo-router
jest.mock('expo-router', () => ({
    router: {
        push: jest.fn(),
        back: jest.fn(),
    },
}));

// Mock the store
jest.mock('../../store', () => ({
    useMusicPlayerStore: jest.fn(),
}));

const mockStore = useMusicPlayerStore as jest.MockedFunction<typeof useMusicPlayerStore>;

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ThemeProvider>{children}</ThemeProvider>
);

describe('Library Screens Integration Tests', () => {
    const mockRouter = require('expo-router').router;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('LibraryScreen', () => {
        it('should render all library navigation items', () => {
            mockStore.mockReturnValue({});

            const { getByText } = render(
                <TestWrapper>
                    <LibraryScreen />
                </TestWrapper>
            );

            expect(getByText('Library')).toBeTruthy();
            expect(getByText('Playlists')).toBeTruthy();
            expect(getByText('Artists')).toBeTruthy();
            expect(getByText('Albums')).toBeTruthy();
            expect(getByText('Genres')).toBeTruthy();
        });

        it('should navigate to playlists when playlists item is tapped', () => {
            mockStore.mockReturnValue({});

            const { getByText } = render(
                <TestWrapper>
                    <LibraryScreen />
                </TestWrapper>
            );

            fireEvent.press(getByText('Playlists'));
            expect(mockRouter.push).toHaveBeenCalledWith('/(library)/playlists');
        });

        it('should navigate to artists when artists item is tapped', () => {
            mockStore.mockReturnValue({});

            const { getByText } = render(
                <TestWrapper>
                    <LibraryScreen />
                </TestWrapper>
            );

            fireEvent.press(getByText('Artists'));
            expect(mockRouter.push).toHaveBeenCalledWith('/(library)/artists');
        });

        it('should navigate to albums when albums item is tapped', () => {
            mockStore.mockReturnValue({});

            const { getByText } = render(
                <TestWrapper>
                    <LibraryScreen />
                </TestWrapper>
            );

            fireEvent.press(getByText('Albums'));
            expect(mockRouter.push).toHaveBeenCalledWith('/(library)/albums');
        });

        it('should navigate to genres when genres item is tapped', () => {
            mockStore.mockReturnValue({});

            const { getByText } = render(
                <TestWrapper>
                    <LibraryScreen />
                </TestWrapper>
            );

            fireEvent.press(getByText('Genres'));
            expect(mockRouter.push).toHaveBeenCalledWith('/(library)/genres');
        });
    });

    describe('AlbumsScreen', () => {
        const mockAlbums: Album[] = [
            {
                id: 'album1',
                name: 'Test Album 1',
                artist: 'Test Artist 1',
                songCount: 10,
            },
            {
                id: 'album2',
                name: 'Test Album 2',
                artist: 'Test Artist 2',
                songCount: 8,
                coverArt: 'https://example.com/album2.jpg',
            },
        ];

        const defaultMockStore = {
            fetchAlbums: jest.fn().mockResolvedValue(mockAlbums),
        };

        beforeEach(() => {
            mockStore.mockReturnValue(defaultMockStore);
        });

        it('should fetch and display albums on mount', async () => {
            const { getByText } = render(
                <TestWrapper>
                    <AlbumsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(defaultMockStore.fetchAlbums).toHaveBeenCalled();
                expect(getByText('Test Album 1')).toBeTruthy();
                expect(getByText('Test Artist 1')).toBeTruthy();
                expect(getByText('Test Album 2')).toBeTruthy();
                expect(getByText('Test Artist 2')).toBeTruthy();
            });
        });

        it('should show loading state initially', () => {
            const { getByText } = render(
                <TestWrapper>
                    <AlbumsScreen />
                </TestWrapper>
            );

            expect(getByText('Loading albums...')).toBeTruthy();
        });

        it('should navigate to album details when album is tapped', async () => {
            const { getByText } = render(
                <TestWrapper>
                    <AlbumsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                fireEvent.press(getByText('Test Album 1'));
                expect(mockRouter.push).toHaveBeenCalledWith({
                    pathname: '/(tabs)/album-details',
                    params: { id: 'album1' },
                });
            });
        });

        it('should show empty state when no albums found', async () => {
            mockStore.mockReturnValue({
                fetchAlbums: jest.fn().mockResolvedValue([]),
            });

            const { getByText } = render(
                <TestWrapper>
                    <AlbumsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(getByText('No albums found')).toBeTruthy();
            });
        });
    });

    describe('ArtistsScreen', () => {
        const mockArtists: Artist[] = [
            {
                id: 'artist1',
                name: 'Test Artist 1',
                albumCount: 5,
                coverArt: 'https://example.com/artist1.jpg',
            },
            {
                id: 'artist2',
                name: 'Test Artist 2',
                albumCount: 3,
            },
        ];

        const defaultMockStore = {
            fetchArtists: jest.fn().mockResolvedValue(mockArtists),
        };

        beforeEach(() => {
            mockStore.mockReturnValue(defaultMockStore);
        });

        it('should fetch and display artists on mount', async () => {
            const { getByText } = render(
                <TestWrapper>
                    <ArtistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(defaultMockStore.fetchArtists).toHaveBeenCalled();
                expect(getByText('Test Artist 1')).toBeTruthy();
                expect(getByText('5 albums')).toBeTruthy();
                expect(getByText('Test Artist 2')).toBeTruthy();
                expect(getByText('3 albums')).toBeTruthy();
            });
        });

        it('should show loading state initially', () => {
            const { getByText } = render(
                <TestWrapper>
                    <ArtistsScreen />
                </TestWrapper>
            );

            expect(getByText('Loading artists...')).toBeTruthy();
        });

        it('should navigate to artist details when artist is tapped', async () => {
            const { getByText } = render(
                <TestWrapper>
                    <ArtistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                fireEvent.press(getByText('Test Artist 1'));
                expect(mockRouter.push).toHaveBeenCalledWith(
                    '/artist-details?id=artist1&name=Test%20Artist%201'
                );
            });
        });

        it('should handle singular album count correctly', async () => {
            const singleAlbumArtist: Artist[] = [
                {
                    id: 'artist3',
                    name: 'Single Album Artist',
                    albumCount: 1,
                },
            ];

            mockStore.mockReturnValue({
                fetchArtists: jest.fn().mockResolvedValue(singleAlbumArtist),
            });

            const { getByText } = render(
                <TestWrapper>
                    <ArtistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(getByText('1 album')).toBeTruthy();
            });
        });

        it('should show empty state when no artists found', async () => {
            mockStore.mockReturnValue({
                fetchArtists: jest.fn().mockResolvedValue([]),
            });

            const { getByText } = render(
                <TestWrapper>
                    <ArtistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(getByText('No artists found')).toBeTruthy();
            });
        });
    });

    describe('PlaylistsScreen', () => {
        const mockPlaylists: Playlist[] = [
            {
                id: 'playlist1',
                name: 'Test Playlist 1',
                songCount: 15,
                coverArt: 'cover1',
                owner: 'User1',
            },
            {
                id: 'playlist2',
                name: 'Test Playlist 2',
                songCount: 8,
            },
        ];

        const defaultMockStore = {
            fetchPlaylists: jest.fn().mockResolvedValue(mockPlaylists),
            getCoverArtUrl: jest.fn((coverArt: string) => `https://example.com/${coverArt}`),
        };

        beforeEach(() => {
            mockStore.mockReturnValue(defaultMockStore);
        });

        it('should fetch and display playlists on mount', async () => {
            const { getByText } = render(
                <TestWrapper>
                    <PlaylistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(defaultMockStore.fetchPlaylists).toHaveBeenCalled();
                expect(getByText('Test Playlist 1')).toBeTruthy();
                expect(getByText('15 songs')).toBeTruthy();
                expect(getByText('by User1')).toBeTruthy();
                expect(getByText('Test Playlist 2')).toBeTruthy();
                expect(getByText('8 songs')).toBeTruthy();
            });
        });

        it('should show loading state initially', () => {
            const { getByText } = render(
                <TestWrapper>
                    <PlaylistsScreen />
                </TestWrapper>
            );

            expect(getByText('Loading playlists...')).toBeTruthy();
        });

        it('should navigate to playlist details when playlist is tapped', async () => {
            const { getByText } = render(
                <TestWrapper>
                    <PlaylistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                fireEvent.press(getByText('Test Playlist 1'));
                expect(mockRouter.push).toHaveBeenCalledWith({
                    pathname: '/(tabs)/playlist-details',
                    params: { id: 'playlist1', name: 'Test Playlist 1' },
                });
            });
        });

        it('should show empty state when no playlists found', async () => {
            mockStore.mockReturnValue({
                ...defaultMockStore,
                fetchPlaylists: jest.fn().mockResolvedValue([]),
            });

            const { getByText } = render(
                <TestWrapper>
                    <PlaylistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(getByText('No playlists found')).toBeTruthy();
            });
        });

        it('should handle fetch error gracefully', async () => {
            mockStore.mockReturnValue({
                ...defaultMockStore,
                fetchPlaylists: jest.fn().mockRejectedValue(new Error('Fetch failed')),
            });

            const { getByText } = render(
                <TestWrapper>
                    <PlaylistsScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(getByText('Fetch failed')).toBeTruthy();
            });
        });
    });

    describe('GenresScreen', () => {
        const mockGenres: Genre[] = [
            {
                id: 'genre1',
                name: 'Rock',
                songCount: 50,
            },
            {
                id: 'genre2',
                name: 'Jazz',
                songCount: 25,
            },
        ];

        const defaultMockStore = {
            fetchGenres: jest.fn().mockResolvedValue(mockGenres),
        };

        beforeEach(() => {
            mockStore.mockReturnValue(defaultMockStore);
        });

        it('should show loading state initially', () => {
            const { getByText } = render(
                <TestWrapper>
                    <GenresScreen />
                </TestWrapper>
            );

            expect(getByText('Loading genres...')).toBeTruthy();
        });

        it('should navigate to genre songs when genre is tapped', async () => {
            const { getByText } = render(
                <TestWrapper>
                    <GenresScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                fireEvent.press(getByText('Rock'));
                expect(mockRouter.push).toHaveBeenCalledWith({
                    pathname: '/(tabs)/genre-songs',
                    params: { id: 'genre1', name: 'Rock' },
                });
            });
        });

        it('should show empty state when no genres found', async () => {
            mockStore.mockReturnValue({
                fetchGenres: jest.fn().mockResolvedValue([]),
            });

            const { getByText } = render(
                <TestWrapper>
                    <GenresScreen />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(getByText('No genres found')).toBeTruthy();
            });
        });
    });
});
