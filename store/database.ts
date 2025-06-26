/**
 * SQLite database utilities for cache metadata
 */

import * as SQLite from 'expo-sqlite';
import { Song } from './types';

export interface CachedSongRecord {
    id: string;
    title: string;
    artist: string;
    album: string;
    coverArt: string | null;
    duration: number;
    fileSize: number;
    cachedAt: number;
}

class DatabaseManager {
    private db: SQLite.SQLiteDatabase | null = null;

    /**
     * Initialize the database and create tables
     */
    async init(): Promise<void> {
        try {
            this.db = await SQLite.openDatabaseAsync('phonora_cache.db');

            await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS songs (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          album TEXT NOT NULL,
          coverArt TEXT,
          duration INTEGER DEFAULT 0,
          fileSize INTEGER DEFAULT 0,
          cachedAt INTEGER NOT NULL
        );
      `);

            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
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
     * Save song metadata to database
     */
    async saveSongMetadata(song: Song, fileSize: number = 0): Promise<void> {
        try {
            const db = await this.ensureDb();
            const now = Date.now();

            await db.runAsync(
                `INSERT OR REPLACE INTO songs 
         (id, title, artist, album, coverArt, duration, fileSize, cachedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    song.id,
                    song.title,
                    song.artist,
                    song.album,
                    song.coverArt || null,
                    song.duration || 0,
                    fileSize,
                    now
                ]
            );
        } catch (error) {
            console.error('Error saving song metadata:', error);
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
                'SELECT * FROM songs WHERE id = ?',
                [songId]
            );
            return result || null;
        } catch (error) {
            console.error('Error getting song metadata:', error);
            return null;
        }
    }

    /**
     * Get all cached songs
     */
    async getAllCachedSongs(): Promise<Song[]> {
        try {
            const db = await this.ensureDb();
            const results = await db.getAllAsync<CachedSongRecord>(
                'SELECT * FROM songs ORDER BY cachedAt DESC'
            );

            return results.map(record => ({
                id: record.id,
                title: record.title,
                artist: record.artist,
                album: record.album,
                coverArt: record.coverArt || undefined,
                duration: record.duration
            }));
        } catch (error) {
            console.error('Error getting cached songs:', error);
            return [];
        }
    }

    /**
     * Remove song metadata
     */
    async removeSongMetadata(songId: string): Promise<void> {
        try {
            const db = await this.ensureDb();
            await db.runAsync('DELETE FROM songs WHERE id = ?', [songId]);
        } catch (error) {
            console.error('Error removing song metadata:', error);
            throw error;
        }
    }

    /**
     * Remove multiple songs metadata
     */
    async removeSongsMetadata(songIds: string[]): Promise<void> {
        try {
            const db = await this.ensureDb();
            const placeholders = songIds.map(() => '?').join(', ');
            await db.runAsync(
                `DELETE FROM songs WHERE id IN (${placeholders})`,
                songIds
            );
        } catch (error) {
            console.error('Error removing songs metadata:', error);
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
                'SELECT * FROM songs ORDER BY cachedAt ASC'
            );
            return results;
        } catch (error) {
            console.error('Error getting songs for cleanup:', error);
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
                'SELECT SUM(fileSize) as total FROM songs'
            );
            return result?.total || 0;
        } catch (error) {
            console.error('Error getting total cached size:', error);
            return 0;
        }
    }

    /**
     * Clear all cache metadata
     */
    async clearAllCacheMetadata(): Promise<void> {
        try {
            const db = await this.ensureDb();
            await db.runAsync('DELETE FROM songs');
        } catch (error) {
            console.error('Error clearing cache metadata:', error);
            throw error;
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
