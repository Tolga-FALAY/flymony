import Database from 'better-sqlite3';
import path from 'path';
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
            Duration TEXT,
            SongYear INTEGER,
            Lyrics TEXT
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
            InstagramLink TEXT,
            Notes TEXT,
            ProfilePicture TEXT,
            BirthDateDay INTEGER,
            BirthDateMonth INTEGER,
            BirthDateYear INTEGER,
            Photos TEXT,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
                        Status TEXT DEFAULT 'Kayıtlı',
                        Link TEXT,
                        Vardi INTEGER DEFAULT 0,
                        Notes TEXT,
                        StatusChangeDate TEXT,
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
                    Status TEXT DEFAULT 'Kayıtlı',
                    Link TEXT,
                    Vardi INTEGER DEFAULT 0,
                    Notes TEXT,
                    StatusChangeDate TEXT,
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
                Status TEXT DEFAULT 'Kayıtlı',
                Link TEXT,
                Vardi INTEGER DEFAULT 0,
                Notes TEXT,
                StatusChangeDate TEXT,
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

    // Migration for adding new guest columns dynamically if they do not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Guests)").all();
        const existingCols = tableInfo.map(col => col.name);

        const newCols = [
            { name: 'Notes', type: 'TEXT' },
            { name: 'ProfilePicture', type: 'TEXT' },
            { name: 'BirthDateDay', type: 'INTEGER' },
            { name: 'BirthDateMonth', type: 'INTEGER' },
            { name: 'BirthDateYear', type: 'INTEGER' },
            { name: 'Photos', type: 'TEXT' },
            { name: 'CreatedAt', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
            { name: 'UpdatedAt', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' }
        ];

        for (const col of newCols) {
            if (!existingCols.includes(col.name)) {
                console.log(`Migrating database: Adding column ${col.name} to Guests table...`);
                db.exec(`ALTER TABLE Guests ADD COLUMN ${col.name} ${col.type};`);
            }
        }
    } catch (e) {
        console.error("Migration error while adding guest columns:", e);
    }

    // Migration for adding Status column to Requests table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Requests)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('Status')) {
            console.log("Migrating database: Adding column Status to Requests table...");
            db.exec("ALTER TABLE Requests ADD COLUMN Status TEXT DEFAULT 'Kayıtlı';");
        }
    } catch (e) {
        console.error("Migration error while adding Status column to Requests table:", e);
    }

    // Migration for adding Link column to Requests table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Requests)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('Link')) {
            console.log("Migrating database: Adding column Link to Requests table...");
            db.exec("ALTER TABLE Requests ADD COLUMN Link TEXT;");
        }
    } catch (e) {
        console.error("Migration error while adding Link column to Requests table:", e);
    }

    // Migration for adding Vardi column to Requests table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Requests)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('Vardi')) {
            console.log("Migrating database: Adding column Vardi to Requests table...");
            db.exec("ALTER TABLE Requests ADD COLUMN Vardi INTEGER DEFAULT 0;");
        }
    } catch (e) {
        console.error("Migration error while adding Vardi column to Requests table:", e);
    }

    // Migration for adding Notes column to Requests table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Requests)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('Notes')) {
            console.log("Migrating database: Adding column Notes to Requests table...");
            db.exec("ALTER TABLE Requests ADD COLUMN Notes TEXT;");
        }
    } catch (e) {
        console.error("Migration error while adding Notes column to Requests table:", e);
    }

    // Migration for adding StatusChangeDate column to Requests table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Requests)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('StatusChangeDate')) {
            console.log("Migrating database: Adding column StatusChangeDate to Requests table...");
            db.exec("ALTER TABLE Requests ADD COLUMN StatusChangeDate TEXT;");
        }
    } catch (e) {
        console.error("Migration error while adding StatusChangeDate column to Requests table:", e);
    }

    // Migration for adding SongYear column to Songs table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Songs)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('SongYear')) {
            console.log("Migrating database: Adding column SongYear to Songs table...");
            db.exec("ALTER TABLE Songs ADD COLUMN SongYear INTEGER;");
        }
    } catch (e) {
        console.error("Migration error while adding SongYear column to Songs table:", e);
    }

    // Migration for adding Lyrics column to Songs table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Songs)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('Lyrics')) {
            console.log("Migrating database: Adding column Lyrics to Songs table...");
            db.exec("ALTER TABLE Songs ADD COLUMN Lyrics TEXT;");
        }
    } catch (e) {
        console.error("Migration error while adding Lyrics column to Songs table:", e);
    }

    // Migration for updating Status 'Vardı' to 'Bakalım'
    try {
        console.log("Migrating database: Updating status 'Vardı' to 'Bakalım'...");
        db.prepare("UPDATE Requests SET Status = 'Bakalım' WHERE Status = 'Vardı'").run();
    } catch (e) {
        console.error("Migration error while updating Status 'Vardı' to 'Bakalım':", e);
    }

    console.log("Database tables initialized.");
};

export default db;
