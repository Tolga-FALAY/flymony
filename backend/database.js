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
            Lyrics TEXT,
            AudioPath TEXT,
            OriginalKey TEXT,
            ChordImagePath TEXT
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
            IsMusician INTEGER DEFAULT 0,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Guest_Relationships (
            GuestID INTEGER,
            RelatedGuestID INTEGER,
            PRIMARY KEY (GuestID, RelatedGuestID),
            FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE,
            FOREIGN KEY (RelatedGuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS RequestStatuses (
            StatusID INTEGER PRIMARY KEY AUTOINCREMENT,
            StatusName TEXT NOT NULL UNIQUE,
            Color TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS Venues (
            VenueID INTEGER PRIMARY KEY AUTOINCREMENT,
            VenueName TEXT NOT NULL UNIQUE,
            ContactPerson TEXT,
            ContactPhone TEXT,
            InstagramLink TEXT
        );

        CREATE TABLE IF NOT EXISTS Gigs (
            GigID INTEGER PRIMARY KEY AUTOINCREMENT,
            VenueName TEXT NOT NULL,
            GigDate TEXT NOT NULL,
            Notes TEXT,
            Photos TEXT,
            Videos TEXT,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS Gig_Songs (
            GigSongID INTEGER PRIMARY KEY AUTOINCREMENT,
            GigID INTEGER NOT NULL,
            SongID INTEGER NOT NULL,
            SortOrder INTEGER NOT NULL,
            IsPlayed INTEGER DEFAULT 0,
            IsRequest INTEGER DEFAULT 0,
            FOREIGN KEY (GigID) REFERENCES Gigs(GigID) ON DELETE CASCADE,
            FOREIGN KEY (SongID) REFERENCES Songs(SongID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS Gig_Guests (
            GigGuestID INTEGER PRIMARY KEY AUTOINCREMENT,
            GigID INTEGER NOT NULL,
            GuestID INTEGER NOT NULL,
            TableName TEXT,
            FOREIGN KEY (GigID) REFERENCES Gigs(GigID) ON DELETE CASCADE,
            FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
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
            { name: 'IsMusician', type: 'INTEGER DEFAULT 0' },
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

    // Migration for adding AudioPath column to Songs table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Songs)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('AudioPath')) {
            console.log("Migrating database: Adding column AudioPath to Songs table...");
            db.exec("ALTER TABLE Songs ADD COLUMN AudioPath TEXT;");
        }
    } catch (e) {
        console.error("Migration error while adding AudioPath column to Songs table:", e);
    }

    // Migration for adding OriginalKey column to Songs table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Songs)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('OriginalKey')) {
            console.log("Migrating database: Adding column OriginalKey to Songs table...");
            db.exec("ALTER TABLE Songs ADD COLUMN OriginalKey TEXT;");
        }
    } catch (e) {
        console.error("Migration error while adding OriginalKey column to Songs table:", e);
    }

    // Migration for adding ChordImagePath column to Songs table dynamically if it does not exist
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Songs)").all();
        const existingCols = tableInfo.map(col => col.name);
        if (!existingCols.includes('ChordImagePath')) {
            console.log("Migrating database: Adding column ChordImagePath to Songs table...");
            db.exec("ALTER TABLE Songs ADD COLUMN ChordImagePath TEXT;");
        }
    } catch (e) {
        console.error("Migration error while adding ChordImagePath column to Songs table:", e);
    }

    // Migration for updating Status 'Vardı' to 'Bakalım'
    try {
        console.log("Migrating database: Updating status 'Vardı' to 'Bakalım'...");
        db.prepare("UPDATE Requests SET Status = 'Bakalım' WHERE Status = 'Vardı'").run();
    } catch (e) {
        console.error("Migration error while updating Status 'Vardı' to 'Bakalım':", e);
    }

    // Seed RequestStatuses if empty
    try {
        const count = db.prepare("SELECT COUNT(*) as count FROM RequestStatuses").get().count;
        if (count === 0) {
            console.log("Seeding default RequestStatuses...");
            const insertStatus = db.prepare("INSERT INTO RequestStatuses (StatusName, Color) VALUES (?, ?)");
            const seed = [
                ['Kayıtlı', '#0ea5e9'],
                ['Denemede', '#f59e0b'],
                ['Eklendi', '#10b981'],
                ['Bakalım', '#8b5cf6'],
                ['İptal', '#ef4444']
            ];
            const runSeeding = db.transaction(() => {
                for (const item of seed) {
                    insertStatus.run(item[0], item[1]);
                }
            });
            runSeeding();
        }
    } catch (e) {
        console.error("Migration error while seeding RequestStatuses:", e);
    }

    // ----------------------------------------------------
    // CITIES TABLE CREATION & MIGRATIONS
    // ----------------------------------------------------
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS Cities (
                CityID INTEGER PRIMARY KEY AUTOINCREMENT,
                CityName TEXT NOT NULL UNIQUE
            );
        `);
        
        // Seed default city if empty
        const cityCount = db.prepare("SELECT COUNT(*) as count FROM Cities").get().count;
        if (cityCount === 0) {
            console.log("Seeding default city: İstanbul...");
            db.prepare("INSERT INTO Cities (CityName) VALUES (?)").run("İstanbul");
        }
    } catch (e) {
        console.error("Migration error while initializing Cities table:", e);
    }

    // ----------------------------------------------------
    // VENUES TABLE MIGRATION (Add CityID)
    // ----------------------------------------------------
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Venues)").all();
        const hasCityID = tableInfo.some(col => col.name === 'CityID');
        if (!hasCityID) {
            console.log("Migrating Venues table: Adding CityID column...");
            
            // Get default city ID
            const defaultCity = db.prepare("SELECT CityID FROM Cities WHERE CityName = ?").get("İstanbul") 
                || db.prepare("SELECT CityID FROM Cities LIMIT 1").get();
            const defaultCityID = defaultCity ? defaultCity.CityID : 1;

            db.transaction(() => {
                // Rename Venues to Venues_old
                db.exec("ALTER TABLE Venues RENAME TO Venues_old;");
                
                // Create new Venues table
                db.exec(`
                    CREATE TABLE Venues (
                        VenueID INTEGER PRIMARY KEY AUTOINCREMENT,
                        VenueName TEXT NOT NULL UNIQUE,
                        CityID INTEGER NOT NULL,
                        ContactPerson TEXT,
                        ContactPhone TEXT,
                        InstagramLink TEXT,
                        FOREIGN KEY (CityID) REFERENCES Cities(CityID)
                    );
                `);

                // Copy old records to new table with default city
                db.prepare(`
                    INSERT INTO Venues (VenueID, VenueName, CityID, ContactPerson, ContactPhone, InstagramLink)
                    SELECT VenueID, VenueName, ?, ContactPerson, ContactPhone, InstagramLink FROM Venues_old;
                `).run(defaultCityID);

                // Drop old table
                db.exec("DROP TABLE Venues_old;");
            })();
            console.log("Venues table migration complete.");
        }
    } catch (e) {
        console.error("Migration error while updating Venues table:", e);
    }

    // ----------------------------------------------------
    // GIGS TABLE MIGRATION (VenueName -> VenueID)
    // ----------------------------------------------------
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Gigs)").all();
        const hasVenueID = tableInfo.some(col => col.name === 'VenueID');
        if (!hasVenueID) {
            console.log("Migrating Gigs table: Replacing VenueName with VenueID...");
            
            const defaultCity = db.prepare("SELECT CityID FROM Cities WHERE CityName = ?").get("İstanbul") 
                || db.prepare("SELECT CityID FROM Cities LIMIT 1").get();
            const defaultCityID = defaultCity ? defaultCity.CityID : 1;

            db.transaction(() => {
                // Rename Gigs to Gigs_old
                db.exec("ALTER TABLE Gigs RENAME TO Gigs_old;");

                // Create new Gigs table referencing VenueID
                db.exec(`
                    CREATE TABLE Gigs (
                        GigID INTEGER PRIMARY KEY AUTOINCREMENT,
                        VenueID INTEGER NOT NULL,
                        GigDate TEXT NOT NULL,
                        Notes TEXT,
                        Photos TEXT,
                        Videos TEXT,
                        CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (VenueID) REFERENCES Venues(VenueID)
                    );
                `);

                // Get old Gigs
                const oldGigs = db.prepare("SELECT * FROM Gigs_old").all();
                
                for (const gig of oldGigs) {
                    const venueName = (gig.VenueName || 'Bilinmeyen Mekan').trim();
                    
                    // Check if venue already exists in Venues
                    let venue = db.prepare("SELECT VenueID FROM Venues WHERE TRIM(LOWER(VenueName)) = TRIM(LOWER(?))").get(venueName);
                    
                    if (!venue) {
                        // Create a new venue entry with the default city
                        const ins = db.prepare("INSERT INTO Venues (VenueName, CityID, ContactPerson, ContactPhone, InstagramLink) VALUES (?, ?, '', '', '')").run(venueName, defaultCityID);
                        venue = { VenueID: ins.lastInsertRowid };
                        console.log(`Auto-created parametric venue: ${venueName} (İstanbul)`);
                    }

                    // Insert gig referencing new/existing VenueID
                    db.prepare(`
                        INSERT INTO Gigs (GigID, VenueID, GigDate, Notes, Photos, Videos, CreatedAt, UpdatedAt)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        gig.GigID,
                        venue.VenueID,
                        gig.GigDate,
                        gig.Notes || '',
                        gig.Photos || '[]',
                        gig.Videos || '[]',
                        gig.CreatedAt,
                        gig.UpdatedAt
                    );
                }

                // Drop Gigs_old
                db.exec("DROP TABLE Gigs_old;");
            })();
            console.log("Gigs table migration complete.");
        }
    } catch (e) {
        console.error("Migration error while updating Gigs table:", e);
    }

    // ----------------------------------------------------
    // GIG_SONGS & GIG_GUESTS FOREIGN KEY REPAIR MIGRATION
    // ----------------------------------------------------
    try {
        const gigSongsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Gig_Songs'").get()?.sql || '';
        const gigGuestsSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Gig_Guests'").get()?.sql || '';

        if (gigSongsSql.includes('Gigs_old') || gigGuestsSql.includes('Gigs_old')) {
            console.log("Repairing broken foreign keys in Gig_Songs and Gig_Guests...");
            
            db.transaction(() => {
                // Rebuild Gig_Songs
                if (gigSongsSql.includes('Gigs_old')) {
                    db.exec("ALTER TABLE Gig_Songs RENAME TO Gig_Songs_old;");
                    db.exec(`
                        CREATE TABLE Gig_Songs (
                            GigSongID INTEGER PRIMARY KEY AUTOINCREMENT,
                            GigID INTEGER NOT NULL,
                            SongID INTEGER NOT NULL,
                            SortOrder INTEGER NOT NULL,
                            IsPlayed INTEGER DEFAULT 0,
                            IsRequest INTEGER DEFAULT 0,
                            FOREIGN KEY (GigID) REFERENCES Gigs(GigID) ON DELETE CASCADE,
                            FOREIGN KEY (SongID) REFERENCES Songs(SongID) ON DELETE CASCADE
                        );
                    `);
                    db.exec("INSERT INTO Gig_Songs (GigSongID, GigID, SongID, SortOrder, IsPlayed, IsRequest) SELECT GigSongID, GigID, SongID, SortOrder, IsPlayed, IsRequest FROM Gig_Songs_old;");
                    db.exec("DROP TABLE Gig_Songs_old;");
                }

                // Rebuild Gig_Guests
                if (gigGuestsSql.includes('Gigs_old')) {
                    db.exec("ALTER TABLE Gig_Guests RENAME TO Gig_Guests_old;");
                    db.exec(`
                        CREATE TABLE Gig_Guests (
                            GigGuestID INTEGER PRIMARY KEY AUTOINCREMENT,
                            GigID INTEGER NOT NULL,
                            GuestID INTEGER NOT NULL,
                            TableName TEXT,
                            FOREIGN KEY (GigID) REFERENCES Gigs(GigID) ON DELETE CASCADE,
                            FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
                        );
                    `);
                    db.exec("INSERT INTO Gig_Guests (GigGuestID, GigID, GuestID, TableName) SELECT GigGuestID, GigID, GuestID, TableName FROM Gig_Guests_old;");
                    db.exec("DROP TABLE Gig_Guests_old;");
                }
            })();
            console.log("Gig_Songs and Gig_Guests foreign key repair complete.");
        }
    } catch (e) {
        console.error("Migration error while repairing Gig_Songs/Gig_Guests tables:", e);
    }

    console.log("Database tables initialized.");
};

export default db;
