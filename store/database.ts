/**
 * SQLite database utilities for cache metadata
 */

import * as SQLite from "expo-sqlite";
import { Song, Artist, Album, Genre } from "./types";

export interface CachedSongRecord {
  id: string;
  title: string;
  coverArt: string | null;
  duration: number;
  fileSize: number;
  cachedAt: number;
  // Foreign keys for normalized data
  artistId: string;
  albumId: string;
  genre?: string;
}

export interface CachedArtistRecord {
  id: string;
  name: string;
  albumCount: number;
  coverArt: string | null;
  cachedAt: number;
}

export interface CachedAlbumRecord {
  id: string;
  name: string;
  artist: string;
  artistId: string;
  songCount: number;
  coverArt: string | null;
  year?: number;
  genre?: string;
  cachedAt: number;
}

export interface CachedGenreRecord {
  name: string;
  songCount: number;
  cachedAt: number;
}

class DatabaseManager {
  private db: SQLite.SQLiteDatabase | null = null;

  /**
   * Initialize the database and create tables
   */
  async init(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync("database.db");

      // Create artists table first (referenced by songs table)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS artists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          albumCount INTEGER DEFAULT 0,
          coverArt TEXT,
          cachedAt INTEGER NOT NULL
        );
      `);

      // Create albums table (referenced by songs table)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS albums (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          artist TEXT NOT NULL,
          artistId TEXT,
          songCount INTEGER DEFAULT 0,
          coverArt TEXT,
          year INTEGER,
          genre TEXT,
          cachedAt INTEGER NOT NULL
        );
      `);

      // Create genres table (referenced by songs table)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS genres (
          name TEXT PRIMARY KEY,
          songCount INTEGER DEFAULT 0,
          cachedAt INTEGER NOT NULL
        );
      `);

      // Create songs table with normalized structure
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS songs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          coverArt TEXT,
          duration INTEGER DEFAULT 0,
          fileSize INTEGER DEFAULT 0,
          cachedAt INTEGER NOT NULL,
          artistId TEXT NOT NULL,
          albumId TEXT NOT NULL,
          genre TEXT,
          FOREIGN KEY (artistId) REFERENCES artists(id),
          FOREIGN KEY (albumId) REFERENCES albums(id),
          FOREIGN KEY (genre) REFERENCES genres(name)
        );
      `);

      // Create indexes for better search performance
      await this.db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
        CREATE INDEX IF NOT EXISTS idx_songs_artistId ON songs(artistId);
        CREATE INDEX IF NOT EXISTS idx_songs_albumId ON songs(albumId);
        CREATE INDEX IF NOT EXISTS idx_songs_genre ON songs(genre);
        CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
        CREATE INDEX IF NOT EXISTS idx_albums_name ON albums(name);
        CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
      `);

      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Error initializing database:", error);
      throw error;
    }
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  /**
   * Save song metadata to database with normalized structure
   */
  async saveSongMetadata(
    song: Song,
    fileSize: number = 0,
    additionalInfo: {
      artistId: string;
      albumId: string;
      genre?: string;
    },
  ): Promise<void> {
    try {
      const db = await this.ensureDb();
      const now = Date.now();

      await db.runAsync(
        `INSERT OR REPLACE INTO songs 
         (id, title, coverArt, duration, fileSize, cachedAt, artistId, albumId, genre) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          song.id,
          song.title,
          song.coverArt || null,
          song.duration || 0,
          fileSize,
          now,
          additionalInfo.artistId,
          additionalInfo.albumId,
          additionalInfo.genre || null,
        ],
      );
    } catch (error) {
      console.error("Error saving song metadata:", error);
      throw error;
    }
  }

  /**
   * Save artist metadata for offline browsing
   */
  async saveArtistMetadata(artist: Artist): Promise<void> {
    try {
      const db = await this.ensureDb();
      const now = Date.now();

      await db.runAsync(
        `INSERT OR REPLACE INTO artists (id, name, albumCount, coverArt, cachedAt) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          artist.id,
          artist.name,
          artist.albumCount || 0,
          artist.coverArt || null,
          now,
        ],
      );
    } catch (error) {
      console.error("Error saving artist metadata:", error);
      throw error;
    }
  }

  /**
   * Save album metadata for offline browsing
   */
  async saveAlbumMetadata(
    album: Album & { artistId?: string; year?: number; genre?: string },
  ): Promise<void> {
    try {
      const db = await this.ensureDb();
      const now = Date.now();

      await db.runAsync(
        `INSERT OR REPLACE INTO albums (id, name, artist, artistId, songCount, coverArt, year, genre, cachedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          album.id,
          album.name,
          album.artist,
          album.artistId || null,
          album.songCount || 0,
          album.coverArt || null,
          album.year || null,
          album.genre || null,
          now,
        ],
      );
    } catch (error) {
      console.error("Error saving album metadata:", error);
      throw error;
    }
  }

  /**
   * Save genre metadata for offline browsing
   */
  async saveGenreMetadata(genre: Genre): Promise<void> {
    try {
      const db = await this.ensureDb();
      const now = Date.now();

      await db.runAsync(
        `INSERT OR REPLACE INTO genres (name, songCount, cachedAt) 
         VALUES (?, ?, ?)`,
        [genre.name, genre.songCount || 0, now],
      );
    } catch (error) {
      console.error("Error saving genre metadata:", error);
      throw error;
    }
  }

  /**
   * Get song metadata by ID
   */
  async getSongMetadata(songId: string): Promise<CachedSongRecord | null> {
    try {
      const db = await this.ensureDb();
      const result = await db.getFirstAsync<CachedSongRecord>(
        "SELECT * FROM songs WHERE id = ?",
        [songId],
      );
      return result || null;
    } catch (error) {
      console.error("Error getting song metadata:", error);
      return null;
    }
  }

  /**
   * Get all cached songs with artist and album names
   */
  async getAllCachedSongs(): Promise<Song[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<
        CachedSongRecord & { artistName: string; albumName: string }
      >(
        `SELECT s.*, a.name as artistName, al.name as albumName 
                 FROM songs s 
                 JOIN artists a ON s.artistId = a.id 
                 JOIN albums al ON s.albumId = al.id 
                 ORDER BY s.cachedAt DESC`,
      );

      return results.map((record) => ({
        id: record.id,
        title: record.title,
        artist: record.artistName,
        album: record.albumName,
        coverArt: record.coverArt || undefined,
        duration: record.duration,
      }));
    } catch (error) {
      console.error("Error getting cached songs:", error);
      return [];
    }
  }

  /**
   * Remove song metadata
   */
  async removeSongMetadata(songId: string): Promise<void> {
    try {
      const db = await this.ensureDb();
      await db.runAsync("DELETE FROM songs WHERE id = ?", [songId]);
    } catch (error) {
      console.error("Error removing song metadata:", error);
      throw error;
    }
  }

  /**
   * Remove multiple songs metadata
   */
  async removeSongsMetadata(songIds: string[]): Promise<void> {
    try {
      const db = await this.ensureDb();
      const placeholders = songIds.map(() => "?").join(", ");
      await db.runAsync(
        `DELETE FROM songs WHERE id IN (${placeholders})`,
        songIds,
      );
    } catch (error) {
      console.error("Error removing songs metadata:", error);
      throw error;
    }
  }

  /**
   * Get songs sorted by cached time (oldest first) for cache cleanup
   */
  async getSongsForCleanup(): Promise<CachedSongRecord[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<CachedSongRecord>(
        "SELECT * FROM songs ORDER BY cachedAt ASC",
      );
      return results;
    } catch (error) {
      console.error("Error getting songs for cleanup:", error);
      return [];
    }
  }

  /**
   * Get total cached file size
   */
  async getTotalCachedSize(): Promise<number> {
    try {
      const db = await this.ensureDb();
      const result = await db.getFirstAsync<{ total: number }>(
        "SELECT SUM(fileSize) as total FROM songs",
      );
      return result?.total || 0;
    } catch (error) {
      console.error("Error getting total cached size:", error);
      return 0;
    }
  }

  /**
   * Clear all cache metadata
   */
  async clearAllCacheMetadata(): Promise<void> {
    try {
      const db = await this.ensureDb();
      await db.runAsync("DELETE FROM songs");
      await db.runAsync("DELETE FROM artists");
      await db.runAsync("DELETE FROM albums");
      await db.runAsync("DELETE FROM genres");
    } catch (error) {
      console.error("Error clearing cache metadata:", error);
      throw error;
    }
  }

  /**
   * Search cached songs, artists, albums by query
   */
  async searchCached(query: string): Promise<{
    songs: Song[];
    artists: Artist[];
    albums: Album[];
  }> {
    try {
      const db = await this.ensureDb();
      const searchPattern = `%${query.toLowerCase()}%`;

      const songResults = await db.getAllAsync<
        CachedSongRecord & { artistName: string; albumName: string }
      >(
        `SELECT s.*, a.name as artistName, al.name as albumName 
                 FROM songs s 
                 JOIN artists a ON s.artistId = a.id 
                 JOIN albums al ON s.albumId = al.id 
                 WHERE LOWER(s.title) LIKE ?
                 ORDER BY s.title`,
        [searchPattern],
      );

      const artistResults = await db.getAllAsync<CachedArtistRecord>(
        `SELECT * FROM artists 
                 WHERE LOWER(name) LIKE ?
                 ORDER BY name`,
        [searchPattern],
      );

      const albumResults = await db.getAllAsync<CachedAlbumRecord>(
        `SELECT * FROM albums 
                 WHERE LOWER(name) LIKE ? OR LOWER(artist) LIKE ?
                 ORDER BY name`,
        [searchPattern, searchPattern],
      );

      return {
        songs: songResults.map((record) => ({
          id: record.id,
          title: record.title,
          artist: record.artistName,
          album: record.albumName,
          coverArt: record.coverArt || undefined,
          duration: record.duration,
        })),
        artists: artistResults.map((record) => ({
          id: record.id,
          name: record.name,
          albumCount: record.albumCount,
          coverArt: record.coverArt || undefined,
        })),
        albums: albumResults.map((record) => ({
          id: record.id,
          name: record.name,
          artist: record.artist,
          songCount: record.songCount,
          coverArt: record.coverArt || undefined,
        })),
      };
    } catch (error) {
      console.error("Error searching cached data:", error);
      return { songs: [], artists: [], albums: [] };
    }
  }

  /**
   * Get all cached artists
   */
  async getAllCachedArtists(): Promise<Artist[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<CachedArtistRecord>(
        "SELECT * FROM artists ORDER BY name",
      );

      return results.map((record) => ({
        id: record.id,
        name: record.name,
        albumCount: record.albumCount,
        coverArt: record.coverArt || undefined,
      }));
    } catch (error) {
      console.error("Error getting cached artists:", error);
      return [];
    }
  }

  /**
   * Get all cached albums
   */
  async getAllCachedAlbums(): Promise<Album[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<CachedAlbumRecord>(
        "SELECT * FROM albums ORDER BY name",
      );

      return results.map((record) => ({
        id: record.id,
        name: record.name,
        artist: record.artist,
        songCount: record.songCount,
        coverArt: record.coverArt || undefined,
      }));
    } catch (error) {
      console.error("Error getting cached albums:", error);
      return [];
    }
  }

  /**
   * Get all cached genres
   */
  async getAllCachedGenres(): Promise<Genre[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<CachedGenreRecord>(
        "SELECT * FROM genres ORDER BY name",
      );

      return results.map((record) => ({
        id: record.name,
        name: record.name,
        songCount: record.songCount,
      }));
    } catch (error) {
      console.error("Error getting cached genres:", error);
      return [];
    }
  }

  /**
   * Get cached songs by artist
   */
  async getCachedSongsByArtist(artistName: string): Promise<Song[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<
        CachedSongRecord & { artistName: string; albumName: string }
      >(
        `SELECT s.*, a.name as artistName, al.name as albumName 
                 FROM songs s 
                 JOIN artists a ON s.artistId = a.id 
                 JOIN albums al ON s.albumId = al.id 
                 WHERE a.name = ? 
                 ORDER BY al.name, s.title`,
        [artistName],
      );

      return results.map((record) => ({
        id: record.id,
        title: record.title,
        artist: record.artistName,
        album: record.albumName,
        coverArt: record.coverArt || undefined,
        duration: record.duration,
      }));
    } catch (error) {
      console.error("Error getting cached songs by artist:", error);
      return [];
    }
  }

  /**
   * Get cached albums by artist
   */
  async getCachedAlbumsByArtist(artistName: string): Promise<Album[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<CachedAlbumRecord>(
        "SELECT * FROM albums WHERE artist = ? ORDER BY year DESC, name",
        [artistName],
      );

      return results.map((record) => ({
        id: record.id,
        name: record.name,
        artist: record.artist,
        songCount: record.songCount,
        coverArt: record.coverArt || undefined,
      }));
    } catch (error) {
      console.error("Error getting cached albums by artist:", error);
      return [];
    }
  }

  /**
   * Get cached songs by album
   */
  async getCachedSongsByAlbum(albumId: string): Promise<Song[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<
        CachedSongRecord & { artistName: string; albumName: string }
      >(
        `SELECT s.*, a.name as artistName, al.name as albumName 
                 FROM songs s 
                 JOIN artists a ON s.artistId = a.id 
                 JOIN albums al ON s.albumId = al.id 
                 WHERE s.albumId = ? 
                 ORDER BY s.title`,
        [albumId],
      );

      return results.map((record) => ({
        id: record.id,
        title: record.title,
        artist: record.artistName,
        album: record.albumName,
        coverArt: record.coverArt || undefined,
        duration: record.duration,
      }));
    } catch (error) {
      console.error("Error getting cached songs by album:", error);
      return [];
    }
  }

  /**
   * Get cached songs by genre
   */
  async getCachedSongsByGenre(genre: string): Promise<Song[]> {
    try {
      const db = await this.ensureDb();
      const results = await db.getAllAsync<
        CachedSongRecord & { artistName: string; albumName: string }
      >(
        `SELECT s.*, a.name as artistName, al.name as albumName 
                 FROM songs s 
                 JOIN artists a ON s.artistId = a.id 
                 JOIN albums al ON s.albumId = al.id 
                 WHERE s.genre = ? 
                 ORDER BY s.title, a.name, al.name`,
        [genre],
      );

      return results.map((record) => ({
        id: record.id,
        title: record.title,
        artist: record.artistName,
        album: record.albumName,
        coverArt: record.coverArt || undefined,
        duration: record.duration,
      }));
    } catch (error) {
      console.error("Error getting cached songs by genre:", error);
      return [];
    }
  }

  /**
   * Get cached album details with songs
   */
  async getCachedAlbumDetails(
    albumId: string,
  ): Promise<(Album & { songs: Song[] }) | null> {
    try {
      const db = await this.ensureDb();

      // Get album info and songs in one query
      const results = await db.getAllAsync<
        CachedAlbumRecord &
          CachedSongRecord & {
            artistName: string;
            albumName: string;
            albumId: string;
            albumArtist: string;
            albumCoverArt: string | null;
          }
      >(
        `SELECT 
                    al.id as albumId, al.name as albumName, al.artist as albumArtist, 
                    al.songCount, al.coverArt as albumCoverArt, al.year, al.genre as albumGenre,
                    s.id, s.title, s.coverArt, s.duration, s.fileSize, s.cachedAt, s.artistId, s.albumId, s.genre,
                    a.name as artistName
                 FROM albums al
                 LEFT JOIN songs s ON s.albumId = al.id 
                 LEFT JOIN artists a ON s.artistId = a.id
                 WHERE al.id = ? 
                 ORDER BY s.title`,
        [albumId],
      );

      if (results.length === 0) {
        return null;
      }

      // Extract album info from first row
      const albumInfo = {
        id: results[0].albumId,
        name: results[0].albumName,
        artist: results[0].albumArtist,
        songCount: results[0].songCount,
        coverArt: results[0].albumCoverArt || undefined,
      };

      // Extract songs (filter out rows where song id is null in case album has no songs)
      const songs = results
        .filter((row) => row.id) // Only rows with actual songs
        .map((record) => ({
          id: record.id,
          title: record.title,
          artist: record.artistName,
          album: record.albumName,
          coverArt: record.coverArt || undefined,
          duration: record.duration,
        }));

      return {
        ...albumInfo,
        songs,
      };
    } catch (error) {
      console.error("Error getting cached album details:", error);
      return null;
    }
  }

  /**
   * Get cached artist details with albums and songs
   */
  async getCachedArtistDetails(
    artistId: string,
  ): Promise<(Artist & { albums: Album[]; songs: Song[] }) | null> {
    try {
      const db = await this.ensureDb();

      // Get all data in one query using LEFT JOINs
      const results = await db.getAllAsync<{
        // Artist fields
        artistId: string;
        artistName: string;
        artistAlbumCount: number;
        artistCoverArt: string | null;
        // Album fields
        albumId: string | null;
        albumName: string | null;
        albumArtist: string | null;
        albumSongCount: number | null;
        albumCoverArt: string | null;
        // Song fields
        songId: string | null;
        songTitle: string | null;
        songCoverArt: string | null;
        songDuration: number | null;
      }>(
        `SELECT 
                    a.id           as artistId,
                    a.name         as artistName,
                    a.albumCount   as artistAlbumCount,
                    a.coverArt     as artistCoverArt,

                    al.id          as albumId,
                    al.name        as albumName,
                    al.artist      as albumArtist,
                    al.songCount   as albumSongCount,
                    al.coverArt    as albumCoverArt,

                    s.id           as songId,
                    s.title        as songTitle,
                    s.coverArt     as songCoverArt,
                    s.duration     as songDuration
                FROM artists a
                LEFT JOIN albums al ON al.artist = a.name
                LEFT JOIN songs s ON s.albumId = al.id
                WHERE a.id = ?
                ORDER BY al.name, s.title`,
        [artistId],
      );

      if (results.length === 0) {
        return null;
      }

      // Extract artist info from first row
      const artistInfo = {
        id: results[0].artistId,
        name: results[0].artistName,
        albumCount: results[0].artistAlbumCount,
        coverArt: results[0].artistCoverArt || undefined,
      };

      // Group albums and songs from the flattened results
      const albumsMap = new Map<string, Album>();
      const songs: Song[] = [];

      for (const row of results) {
        // Add album if it exists and not already added
        if (row.albumId && !albumsMap.has(row.albumId)) {
          albumsMap.set(row.albumId, {
            id: row.albumId,
            name: row.albumName!,
            artist: row.albumArtist!,
            songCount: row.albumSongCount!,
            coverArt: row.albumCoverArt || undefined,
          });
        }

        // Add song if it exists
        if (row.songId) {
          songs.push({
            id: row.songId,
            title: row.songTitle!,
            artist: artistInfo.name,
            album: row.albumName!,
            coverArt: row.songCoverArt || undefined,
            duration: row.songDuration!,
          });
        }
      }

      return {
        ...artistInfo,
        albums: Array.from(albumsMap.values()),
        songs,
      };
    } catch (error) {
      console.error("Error getting cached artist details:", error);
      return null;
    }
  }

  /**
   * Get cached artist by name
   */
  async getCachedArtistByName(
    artistName: string,
  ): Promise<CachedArtistRecord | null> {
    try {
      const db = await this.ensureDb();
      const result = await db.getFirstAsync<CachedArtistRecord>(
        "SELECT * FROM artists WHERE name = ?",
        [artistName],
      );
      return result || null;
    } catch (error) {
      console.error("Error getting cached artist by name:", error);
      return null;
    }
  }

  /**
   * Get cached album by name and artist
   */
  async getCachedAlbumByName(
    albumName: string,
    artistName: string,
  ): Promise<CachedAlbumRecord | null> {
    try {
      const db = await this.ensureDb();
      const result = await db.getFirstAsync<CachedAlbumRecord>(
        "SELECT * FROM albums WHERE name = ? AND artist = ?",
        [albumName, artistName],
      );
      return result || null;
    } catch (error) {
      console.error("Error getting cached album by name:", error);
      return null;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }
}

// Export singleton instance
export const dbManager = new DatabaseManager();
