import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to SQLite DB (creates file if not exists)
const db = new Database(path.join(__dirname, 'song_requests.db'), { verbose: console.log });

// Initialize Tables
export const initializeDB = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS Artists (
            ArtistID INTEGER PRIMARY KEY AUTOINCREMENT,
            ArtistName TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Songs (
            SongID INTEGER PRIMARY KEY AUTOINCREMENT,
            SongTitle TEXT NOT NULL,
            Duration TEXT
        );

        CREATE TABLE IF NOT EXISTS Song_Artists (
            SongID INTEGER,
            ArtistID INTEGER,
            PRIMARY KEY (SongID, ArtistID),
            FOREIGN KEY (SongID) REFERENCES Songs(SongID) ON DELETE CASCADE,
            FOREIGN KEY (ArtistID) REFERENCES Artists(ArtistID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS Guests (
            GuestID INTEGER PRIMARY KEY AUTOINCREMENT,
            FirstName TEXT NOT NULL,
            LastName TEXT NOT NULL,
            FullName TEXT GENERATED ALWAYS AS (FirstName || ' ' || LastName) VIRTUAL,
            PhoneNumber TEXT,
            InstagramLink TEXT
        );

        CREATE TABLE IF NOT EXISTS Requests (
            RequestID INTEGER PRIMARY KEY AUTOINCREMENT,
            SongID INTEGER NOT NULL,
            GuestID INTEGER NOT NULL,
            RequestDate DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (SongID) REFERENCES Songs(SongID) ON DELETE CASCADE,
            FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
        );
    `);
    console.log("Database tables initialized.");
};

export default db;
