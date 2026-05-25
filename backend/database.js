import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to SQLite DB (creates file if not exists)
const db = new Database(path.join(__dirname, 'song_requests.db'), { verbose: console.log });

// Initialize Tables
export const initializeDB = () => {
    // 1. Create base tables if they don't exist
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
    `);

    // Check if Requests table exists and has GuestID column
    let hasRequestsTable = false;
    try {
        const check = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Requests'").get();
        if (check) {
            hasRequestsTable = true;
        }
    } catch (e) {
        // Table doesn't exist
    }

    if (hasRequestsTable) {
        const tableInfo = db.prepare("PRAGMA table_info(Requests)").all();
        const hasGuestID = tableInfo.some(col => col.name === 'GuestID');
        if (hasGuestID) {
            console.log("Migrating Requests table to support multiple guests...");
            const runMigration = db.transaction(() => {
                // Ensure Request_Guests table is created
                db.exec(`
                    CREATE TABLE IF NOT EXISTS Request_Guests (
                        RequestID INTEGER,
                        GuestID INTEGER,
                        PRIMARY KEY (RequestID, GuestID),
                        FOREIGN KEY (RequestID) REFERENCES Requests(RequestID) ON DELETE CASCADE,
                        FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
                    );
                `);

                // Migrate existing guest relationships
                db.exec(`
                    INSERT OR IGNORE INTO Request_Guests (RequestID, GuestID)
                    SELECT RequestID, GuestID FROM Requests WHERE GuestID IS NOT NULL;
                `);

                // Recreate Requests table without GuestID column
                db.exec(`
                    CREATE TABLE IF NOT EXISTS Requests_new (
                        RequestID INTEGER PRIMARY KEY AUTOINCREMENT,
                        SongID INTEGER NOT NULL,
                        RequestDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (SongID) REFERENCES Songs(SongID) ON DELETE CASCADE
                    );

                    INSERT INTO Requests_new (RequestID, SongID, RequestDate)
                    SELECT RequestID, SongID, RequestDate FROM Requests;

                    DROP TABLE Requests;
                    ALTER TABLE Requests_new RENAME TO Requests;
                `);
            });
            runMigration();
            console.log("Migration completed successfully.");
        } else {
            // Already migrated or clean setup, ensure Request_Guests table exists
            db.exec(`
                CREATE TABLE IF NOT EXISTS Requests (
                    RequestID INTEGER PRIMARY KEY AUTOINCREMENT,
                    SongID INTEGER NOT NULL,
                    RequestDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (SongID) REFERENCES Songs(SongID) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS Request_Guests (
                    RequestID INTEGER,
                    GuestID INTEGER,
                    PRIMARY KEY (RequestID, GuestID),
                    FOREIGN KEY (RequestID) REFERENCES Requests(RequestID) ON DELETE CASCADE,
                    FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
                );
            `);
        }
    } else {
        // Clean initialization of Requests and Request_Guests
        db.exec(`
            CREATE TABLE IF NOT EXISTS Requests (
                RequestID INTEGER PRIMARY KEY AUTOINCREMENT,
                SongID INTEGER NOT NULL,
                RequestDate DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (SongID) REFERENCES Songs(SongID) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS Request_Guests (
                RequestID INTEGER,
                GuestID INTEGER,
                PRIMARY KEY (RequestID, GuestID),
                FOREIGN KEY (RequestID) REFERENCES Requests(RequestID) ON DELETE CASCADE,
                FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
            );
        `);
    }

    console.log("Database tables initialized.");

    // Auto-import artists from txt file if it exists
    try {
        const txtFilePath = path.join(__dirname, '..', 'frontend', 'public', 'sanatcilar.txt');
        if (fs.existsSync(txtFilePath)) {
            console.log(`[Auto-Import] Reading artist names from: ${txtFilePath}`);
            const data = fs.readFileSync(txtFilePath, 'utf-8');
            const artistNames = data
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(line => line.length > 0);

            if (artistNames.length > 0) {
                const checkStmt = db.prepare('SELECT 1 FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))');
                const insertStmt = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)');

                let insertedCount = 0;
                let skippedCount = 0;

                const importTx = db.transaction((names) => {
                    for (const name of names) {
                        const existing = checkStmt.get(name);
                        if (existing) {
                            skippedCount++;
                        } else {
                            insertStmt.run(name);
                            insertedCount++;
                        }
                    }
                });

                importTx(artistNames);
                console.log(`[Auto-Import] Successfully processed ${artistNames.length} artists (Inserted: ${insertedCount}, Skipped: ${skippedCount}).`);
            }
        } else {
            console.log(`[Auto-Import] Artists text file not found at: ${txtFilePath}`);
        }
    } catch (err) {
        console.error("[Auto-Import] Failed to auto-import artists:", err);
    }
};

export default db;
