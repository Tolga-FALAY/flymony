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
            Duration TEXT,
            SongYear INTEGER,
            Lyrics TEXT,
            AudioPath TEXT,
            OriginalKey TEXT,
            ChordImagePath TEXT,
            LanguageID INTEGER,
            FOREIGN KEY (LanguageID) REFERENCES Languages(LanguageID)
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
            City TEXT,
            CityTR TEXT,
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
            InstagramLink TEXT,
            Notes TEXT,
            GoogleMapsLink TEXT
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
            GuestID INTEGER,
            TableName TEXT,
            Description TEXT,
            GuestCount INTEGER DEFAULT 1,
            IsAnonymous INTEGER DEFAULT 0,
            FOREIGN KEY (GigID) REFERENCES Gigs(GigID) ON DELETE CASCADE,
            FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS QuickNotes (
            NoteID INTEGER PRIMARY KEY AUTOINCREMENT,
            NoteText TEXT,
            Photos TEXT DEFAULT '[]',
            IsDeleted INTEGER DEFAULT 0,
            CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Ensure QuickNotes has IsDeleted column
    try {
        const noteCols = db.prepare("PRAGMA table_info(QuickNotes)").all();
        if (noteCols.length > 0 && !noteCols.some(col => col.name === 'IsDeleted')) {
            db.exec("ALTER TABLE QuickNotes ADD COLUMN IsDeleted INTEGER DEFAULT 0;");
        }
    } catch (e) {
        console.warn("QuickNotes migration check error:", e);
    }

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
            { name: 'City', type: 'TEXT' },
            { name: 'CityTR', type: 'TEXT' },
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
    // LANGUAGES TABLE CREATION & MIGRATIONS
    // ----------------------------------------------------
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS Languages (
                LanguageID INTEGER PRIMARY KEY AUTOINCREMENT,
                LanguageName TEXT NOT NULL UNIQUE
            );
        `);
        
        // Seed default languages if empty
        const langCount = db.prepare("SELECT COUNT(*) as count FROM Languages").get().count;
        if (langCount === 0) {
            console.log("Seeding default languages: Türkçe, İngilizce...");
            db.prepare("INSERT INTO Languages (LanguageName) VALUES (?)").run("Türkçe");
            db.prepare("INSERT INTO Languages (LanguageName) VALUES (?)").run("İngilizce");
        }
    } catch (e) {
        console.error("Migration error while initializing Languages table:", e);
    }

    // ----------------------------------------------------
    // SONGS TABLE MIGRATION (Add LanguageID & Notes)
    // ----------------------------------------------------
    try {
        const songTableInfo = db.prepare("PRAGMA table_info(Songs)").all();
        const hasLanguageID = songTableInfo.some(col => col.name === 'LanguageID');
        if (!hasLanguageID) {
            console.log("Migrating Songs table: Adding LanguageID column...");
            
            // Get default language ID (Türkçe)
            const defaultLang = db.prepare("SELECT LanguageID FROM Languages WHERE LanguageName = ?").get("Türkçe");
            const defaultLangID = defaultLang ? defaultLang.LanguageID : 1;
            
            db.transaction(() => {
                // SQLite supports ALTER TABLE Songs ADD COLUMN LanguageID INTEGER REFERENCES Languages(LanguageID)
                db.exec("ALTER TABLE Songs ADD COLUMN LanguageID INTEGER REFERENCES Languages(LanguageID);");
                // Update existing records to have the default language
                db.prepare("UPDATE Songs SET LanguageID = ?").run(defaultLangID);
            })();
            console.log("Songs table migration complete: LanguageID added.");
        }

        const hasNotes = songTableInfo.some(col => col.name === 'Notes');
        if (!hasNotes) {
            console.log("Migrating Songs table: Adding Notes column...");
            db.exec("ALTER TABLE Songs ADD COLUMN Notes TEXT;");
            console.log("Songs table migration complete: Notes added.");
        }
    } catch (e) {
        console.error("Migration error while updating Songs table:", e);
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
                        Notes TEXT,
                        GoogleMapsLink TEXT,
                        FOREIGN KEY (CityID) REFERENCES Cities(CityID)
                    );
                `);

                // Copy old records to new table with default city
                db.prepare(`
                    INSERT INTO Venues (VenueID, VenueName, CityID, ContactPerson, ContactPhone, InstagramLink, Notes, GoogleMapsLink)
                    SELECT VenueID, VenueName, ?, ContactPerson, ContactPhone, InstagramLink, NULL, NULL FROM Venues_old;
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
                        const ins = db.prepare("INSERT INTO Venues (VenueName, CityID, ContactPerson, ContactPhone, InstagramLink, Notes, GoogleMapsLink) VALUES (?, ?, '', '', '', '', '')").run(venueName, defaultCityID);
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

    // ----------------------------------------------------
    // VENUES TABLE MIGRATION (Add Notes)
    // ----------------------------------------------------
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Venues)").all();
        const hasNotes = tableInfo.some(col => col.name === 'Notes');
        if (!hasNotes) {
            console.log("Migrating Venues table: Adding Notes column...");
            db.exec("ALTER TABLE Venues ADD COLUMN Notes TEXT;");
            console.log("Venues table migration complete (Notes column added).");
        }
    } catch (e) {
        console.error("Migration error while adding Notes column to Venues table:", e);
    }

    // ----------------------------------------------------
    // VENUES TABLE MIGRATION (Add GoogleMapsLink)
    // ----------------------------------------------------
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Venues)").all();
        const hasGoogleMaps = tableInfo.some(col => col.name === 'GoogleMapsLink');
        if (!hasGoogleMaps) {
            console.log("Migrating Venues table: Adding GoogleMapsLink column...");
            db.exec("ALTER TABLE Venues ADD COLUMN GoogleMapsLink TEXT;");
            console.log("Venues table migration complete (GoogleMapsLink column added).");
        }
    } catch (e) {
        console.error("Migration error while adding GoogleMapsLink column to Venues table:", e);
    }

    // ----------------------------------------------------
    // GIG_GUESTS TABLE MIGRATION (Description, GuestCount, IsAnonymous, Nullable GuestID)
    // ----------------------------------------------------
    try {
        const tableInfo = db.prepare("PRAGMA table_info(Gig_Guests)").all();
        const existingCols = tableInfo.map(col => col.name);
        
        if (!existingCols.includes('Description')) {
            console.log("Migrating database: Adding Description column to Gig_Guests table...");
            db.exec("ALTER TABLE Gig_Guests ADD COLUMN Description TEXT;");
        }
        if (!existingCols.includes('GuestCount')) {
            console.log("Migrating database: Adding GuestCount column to Gig_Guests table...");
            db.exec("ALTER TABLE Gig_Guests ADD COLUMN GuestCount INTEGER DEFAULT 1;");
        }
        if (!existingCols.includes('IsAnonymous')) {
            console.log("Migrating database: Adding IsAnonymous column to Gig_Guests table...");
            db.exec("ALTER TABLE Gig_Guests ADD COLUMN IsAnonymous INTEGER DEFAULT 0;");
        }

        const guestIdCol = tableInfo.find(c => c.name === 'GuestID');
        if (guestIdCol && guestIdCol.notnull === 1) {
            console.log("Migrating Gig_Guests table: Making GuestID column nullable...");
            db.transaction(() => {
                db.exec("ALTER TABLE Gig_Guests RENAME TO Gig_Guests_old;");
                db.exec(`
                    CREATE TABLE Gig_Guests (
                        GigGuestID INTEGER PRIMARY KEY AUTOINCREMENT,
                        GigID INTEGER NOT NULL,
                        GuestID INTEGER,
                        TableName TEXT,
                        Description TEXT,
                        GuestCount INTEGER DEFAULT 1,
                        IsAnonymous INTEGER DEFAULT 0,
                        FOREIGN KEY (GigID) REFERENCES Gigs(GigID) ON DELETE CASCADE,
                        FOREIGN KEY (GuestID) REFERENCES Guests(GuestID) ON DELETE CASCADE
                    );
                `);
                db.exec(`
                    INSERT INTO Gig_Guests (GigGuestID, GigID, GuestID, TableName, Description, GuestCount, IsAnonymous)
                    SELECT GigGuestID, GigID, CASE WHEN GuestID = 0 THEN NULL ELSE GuestID END, TableName, Description, GuestCount, IsAnonymous FROM Gig_Guests_old;
                `);
                db.exec("DROP TABLE Gig_Guests_old;");
            })();
            console.log("Gig_Guests nullable GuestID migration complete.");
        }
    } catch (e) {
        console.error("Migration error while updating Gig_Guests table:", e);
    }

    // ----------------------------------------------------
    // SONGS TABLE MIGRATION (Populate missing SongYear & Notes)
    // ----------------------------------------------------
    try {
        const songsToUpdate = [
            { title: 'Tutamıyorum Zamanı', year: 2001, notes: null },
            { title: 'Kumralım', year: 1996, notes: null },
            { title: 'Acılara Tutunmak', year: 1985, notes: 'Ahmet Kaya (1985)' },
            { title: 'İçim paramparça', year: 2011, notes: null },
            { title: 'Paramparça', year: 2000, notes: 'Teoman (2000)' },
            { title: 'Saydım', year: 2004, notes: null },
            { title: 'Bak', year: 2007, notes: null },
            { title: 'Sabahçı Kahvesi', year: 1992, notes: null },
            { title: 'İhtiyacım Var', year: 2026, notes: null },
            { title: 'No woman no cry', year: 1974, notes: null },
            { title: 'One Love One Heart', year: 1965, notes: null }
        ];

        const checkStmt = db.prepare('SELECT SongID, SongYear, Notes FROM Songs WHERE TRIM(LOWER(SongTitle)) = TRIM(LOWER(?))');
        const updateWithNotes = db.prepare('UPDATE Songs SET SongYear = ?, Notes = ? WHERE SongID = ?');
        const updateYearOnly = db.prepare('UPDATE Songs SET SongYear = ? WHERE SongID = ?');

        const runSongMigration = db.transaction(() => {
            for (const item of songsToUpdate) {
                const found = checkStmt.all(item.title);
                for (const song of found) {
                    if (!song.SongYear) {
                        if (item.notes && !song.Notes) {
                            updateWithNotes.run(item.year, item.notes, song.SongID);
                        } else {
                            updateYearOnly.run(item.year, song.SongID);
                        }
                    }
                }
            }
        });
        runSongMigration();
    } catch (e) {
        console.error("Migration error while updating missing song years:", e);
    }

    // ----------------------------------------------------
    // C:\FLY SONGS & CHORD IMAGES SEEDING (Idempotent)
    // ----------------------------------------------------
    try {
        const uploadDir = path.join(__dirname, '../uploads');
        const seedFilesDir = path.join(__dirname, 'fly_seeds');
        const flyDir = 'C:\\FLY';

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        let readDir = null;
        if (fs.existsSync(flyDir)) {
            readDir = flyDir;
        } else if (fs.existsSync(seedFilesDir)) {
            readDir = seedFilesDir;
        }

        if (readDir) {
            const fileList = fs.readdirSync(readDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
            
            const ARTIST_NORM_MAP = {
                'alifiru': 'Ali Firu',
                'anonimcyp': 'Anonim CYP',
                'anonimtr': 'Anonim',
                'aşık mahsuni': 'Aşık Mahsuni Şerif',
                'asik mahsuni': 'Aşık Mahsuni Şerif',
                'ahmet kaya': 'Ahmet Kaya',
                'barış akarsu': 'Barış Akarsu',
                'baris akarsu': 'Barış Akarsu',
                'coskun sabah': 'Coşkun Sabah',
                'coşkun sabah': 'Coşkun Sabah',
                'levent yüksel': 'Levent Yüksel',
                'levent yüksel': 'Levent Yüksel',
                'ersay under': 'Ersay Üner',
                'ersay üner': 'Ersay Üner',
                'evrencan gunduz': 'Evrencan Gündüz',
                'evrencangunduz': 'Evrencan Gündüz',
                'evrencan gündüz': 'Evrencan Gündüz',
                'feride hilal akin': 'Feride Hilal Akın',
                'feride hilal akın': 'Feride Hilal Akın',
                'ibrahim erkal': 'İbrahim Erkal',
                'i̇brahim erkal': 'İbrahim Erkal',
                'ibrahim tatlıses': 'İbrahim Tatlıses',
                'i̇brahim tatlıses': 'İbrahim Tatlıses',
                'ikilem': 'İkilem',
                'i̇kilem': 'İkilem',
                'ilhan irem': 'İlhan İrem',
                'i̇lhan i̇rem': 'İlhan İrem',
                'ilhan şeşen': 'İlhan Şeşen',
                'i̇lhan şeşen': 'İlhan Şeşen',
                'ilyas yalçıntaş': 'İlyas Yalçıntaş',
                'i̇lyas yalçıntaş': 'İlyas Yalçıntaş',
                'intizar': 'İntizar',
                'i̇ntizar': 'İntizar',
                'irem': 'İrem',
                'i̇rem': 'İrem',
                'irem derici': 'İrem Derici',
                'i̇rem derici': 'İrem Derici',
                'koray avci': 'Koray Avcı',
                'koray avcı': 'Koray Avcı',
                'hiraizerdüş': 'HiraiZerdüş',
                'hiraizerdüs': 'HiraiZerdüş',
                'müslüm': 'Müslüm Gürses',
                'muslum': 'Müslüm Gürses',
                'sertab erener': 'Sertab Erener',
                'yüzyüzeyken konuşuşuruz': 'Yüzyüzeyken Konuşuruz',
                'yuzyuzeyken konusuruz': 'Yüzyüzeyken Konuşuruz',
                'yuzyuzeyken konuslasuruz': 'Yüzyüzeyken Konuşuruz'
            };

            const SONG_YEARS = {
                // Batch 1
                'ervahı ezelde': 2013,
                'bebek': 1996,
                'koca yaşlı şişko dünya': 2014,
                'minnet eylemem': 2015,
                'beni vur': 1993,
                'dardayım': 1998,
                'doruklara sevdalandım': 1994,
                'hep sonradan': 2001,
                'kafama sıkar giderim': 1998,
                'kendine iyi bak v1': 1990,
                'kendine iyi bak v2': 1990,
                'korkarım': 1998,
                'kum gibi': 1994,
                'nerden bileceksiniz': 2001,
                'penceresiz kaldım anne': 1985,
                'yakamoz': 1996,
                'içimde ölen biri var': 1992,
                'şiire gazele - azeri': 1993,

                // Batch 2
                'bambaşka biri': 1979,
                'bir garip yolcuyum (yalan dünya)': 1972,
                'düşünme hiç': 1983,
                'haykıracak nefesim': 1979,
                'hoşgör sen': 1975,
                'kim ne derse desin aşk için': 1976,
                'kimler geldi kimler geçti': 1973,
                'sensiz yıllarda': 1970,
                'anlatamıyorum': 1995,
                'gül bahçesi': 2018,
                'yolcu': 1997,
                'ihtilal': 2021,
                'kurban olayım': 2021,
                'eylülde gel': 1977,
                'fabrika kızı': 1970,
                'seni sana sen': 2020,
                'dillirga': null,
                'feslikan': null,
                'köprüden geçemedim': null,
                'portakal atışalım': null,
                'zeytinden aşı mısın': null,
                'ah bir ataş ver': null,
                'arpa buğday daneler': null,
                'ayva çiçek açmış': null,
                'divane aşık gibi': null,
                'drama köprüsü': null,
                'eklemedir koca kocak': null,
                'eklemedir koca konak': null,
                'izmir marşı': 1923,
                'mağusa limanı': null,
                'çanakkale türküsü': 1915,
                'ne ağlarsın benim zülfü siyahım': 1983,
                'kalp kalbe karşı derler': 2007,
                'bağrı yanık dostlara': 1980,
                'hayriyem': 2014,
                'arsız gönül': 2010,
                'ben böyleyim': 2010,
                'beyoğlu': 2002,
                'dam üstüne çul serer': 1998,
                'herşey güzel olacak': 1998,
                'kafama göre': 2014,
                'serseri mayın': 2010,
                'yalan': 2004,
                'çilli bom': 1993,
                'allah sorar': 1998,
                'anlamazdın': 1975,
                'bağdat': 2016,
                'garibim': 1998,
                'gittiğin yağmurla gel': 1997,
                'ölünce sevemezsem seni': 1997,
                'büklüm büklüm': 1976,
                'ben varım': 1974,
                'ay inanmıyorum': 1994,
                'yalancı bahar': 2001,
                'çeşmi siyahım': 1968,
                'uzun ince bir yoldayım': 1958,

                // Batch 3
                'bu fasulya yedi buçuk lira': null,
                'yanayım yanayım': 2009,
                'bana kara diyen dilber': 2005,
                'sen ağlama': 2005,
                'yalnızlık benim eski sevgilim': 2000,
                'kır papatyası': 2015,
                'unutulur': 1982,
                'ringo ringo şişeler': 2019,
                'gel gör beni aşk neyledi': 2004,
                'gözlerin (yalancı yarim)': 2006,
                'alla beni pulla beni': 1983,
                'aynalı kemer': 1978,
                'dağlar dağlar': 1970,
                'domates biber patlıcan sf1': 1988,
                'domates biber patlıcan sf2': 1988,
                'gesi bağları': 1978,
                'gülpembe': 1981,
                'kara sevda': 1988,
                'kol düğmeleri': 1968,
                'zalım sultan': 1978,
                'efendim işitmedim': 2004,
                'saygımdan': 2013,
                'sev yeter': 1986,
                'yaralarını ben sarayım': 2022,
                'müebbet': 2014,
                'seni seviyorum': 1995,
                'sözlerimi geri alamam': 1996,
                'bebeğim': 1994,
                'benimle oynama': 1994,
                'sen sevda mısın': 2015,
                'benimle oynar mısın': 1974,
                'bu su hiç durmaz': 1990,
                'sensiz olmaz': 1994,
                'haydar haydar': 2013,
                'yalnızım ben': 2013,
                'gökyüzünü tutamam': 2021,
                'acıtır gibi severek': 2020,
                'ağlama ben ağlarım': 2019,
                'sar bu şehri': 2018,
                'toprak yağmura': 2019,
                'annem': 2000,
                'kırık kalpler durağı': 2009,
                'neden': 2002,
                'onlar yanlış biliyor': 1997,
                'söz vermiştin': 2002,
                'kül': 2020,
                'mutlu yıllar': 2010,
                'sen gel diyorsun (öf öf)': 2014,
                'yağmur': 2008,
                'bekle beni': 1982,
                'bu son olsun': 1969,
                'deniz üstü köpürür': 1974,
                'ıslak ıslak': 1992,
                'mavi liman': 1987,
                'namus belası': 1974,
                'raptiye rap rap': 1992,
                'resimdeki gözyaşları': 1968,
                'sen de başını alıp gitme': 1992,
                'tamirci çırağı': 1975,
                'imkansız aşk': 2006,
                'dön bana': 2006,
                'esmer': 2014,
                'hatıram olsun': 1989,
                'bilinmeyen saati uygulaması': 2010,
                'arnavut kaldırımı': 1994,
                'aşktan öte': 2004,
                'gümüş': 2000,
                'deniz koydum adını': 2017,
                'kalbimi kırıyorlar anne': 2020,
                'aldattın mı': 2019,
                'dilerim ki': 2021,
                'gitme': 2019,
                'yapma nolursun': 2017,
                'ahh': 2002,
                'aman aman': 2005,
                'bekle dedi gitti': 2002,
                'beni yak': 1999,
                'elleri ellerime': 2009,
                'kufi': 2024,
                'senden daha güzel': 2009,
                'sor bana pişman mıyım': 2009,
                'yanıbaşımdan': 2002,
                'yürek': 2002,
                'içerim ben bu akşam': 1999,
                'sevdan bir ateş': 1999,
                'çavbella': 1989,
                'terk edilmiş şehirler': 2021,
                'delibal': 2015,
                'afedersin': 1996,
                'ateşteyim': 1994,
                'dilberim': 1994,
                'hercai': 1995,
                'meyhaneci': 1996,

                // Batch 4
                'çingenem': 1999,
                'hatırla sevgili': 2019,
                'aldırma gönül': 1977,
                'güzel günler göreceğiz çocuklar': 1996,
                'hasretinle yandı gönlüm': 1990,
                'kuşlar': 1990,
                'delice bir sevda': 1995,
                'yaz aşkım': 1995,
                'hovarda': 1995,
                'ali cabbar': 2023,
                'beyaz skandalım': 2019,
                'can dostum': 2021,
                'devriliyorsam': 2019,
                'müzik kutusu': 2017,
                'nalan': 2019,
                'aşkı kıyamet': 2003,
                'neyleyim': 2003,
                'sensiz olmuyor': 2005,
                'yani': 2003,
                'belki bir gün özlersin': 2006,
                'hoşçakal': 2010,
                'soğuk odalar': 2012,
                'senden güzeli mi var': 2023,
                'hanımefendi': 2019,
                'elveda deme bana': 1996,
                'sayenizde': 1995,
                'anlatmalıymış meğer': 2000,
                'anma arkadaş': 1974,
                'arap saçı': 1976,
                'aşkımız bitecek': 1976,
                'estarabim': 1975,
                'fesuphanallah': 1974,
                'sevdiğin (doğarken dünyayı)': 1977,
                'yalnızlar rıhtımı': 1976,
                'çöpçüler': 1977,
                'ah bu hayat çekilmez': 1976,
                'işte öyle bir şey': 1976,
                'iki aşık': 2017,
                'unutma beni': 1974,
                'uzunlar': 2020,
                'benimle evlensen kısa': 2018,
                'felaket': 2019,
                'gel ya da git': 2014,
                'ben ölmeden önce': 1999,
                'suçum değil': 1999,
                'anı': 1992,
                'ellerim bomboş': 1992,
                'sonuna kadar': 1995,
                'üzülme': 1995,
                'bana sor': 1990,
                'ben de özledim': 1982,
                'bu şehir': 1988,
                'hatıran yeter': 1990,
                'sabahçı kahvesi': 1992,
                'aşkımı bir sır gibi (gündüzüm seninle)': 1980,
                'dilek taşı': 1978,
                'intihaşk': 2017,
                'alev alev': 2002,
                'mandalinalar': 2012,
                'gönül': 1993,
                'hayal edemezsin': 2014,
                'trenler': 2014,
                'yol': 2018,
                'yak gel': 2009,
                'meyhaneler sen': 2008,
                'aşk nerden nereye': 2010,
                'al aşkını sok': 1994,
                'istanbulda': 1992,
                'gündoğdu marşı': 1988,
                'uğurlama': 1991,
                'yerine sevemem': 1994,
                'üstüme basıp geçme yar': 1995,
                'birkaç beden önce': 2011,
                'aşk': 2019,
                'derdim': 2021,
                'mahşer': 2022,
                'sen i̇stanbulsun': 2014,
                'sen istanbulsun': 2014,
                'yüreğim': 2010,
                'çatı katı': 2014,
                'kalbime gömerim o zaman': 2006,
                'cesaretin var mı aşka': 1995,
                'sen evlisin': 1984,
                'bir telefon': 2004,
                'bir efsaneydi': 1989,
                'karam': 2000,
                'köylü güzeli': 1993,
                'duyanlara': 2015,
                'galata': 2014,
                'isyan': 2011,
                'içim paramparça': 2011,
                'olsun': 2011,
                'allı turnam': 1998,
                'ankara': 1993,
                'anlasana': 1996,
                'aşkın mapushane': 2000,
                'dağlar mı yollar mı': 2004,
                'dert olur': 1999,
                'dostum': 1996,
                'ela gözlüm': 1996,
                'elfida': 2006,
                'kaçış (uçak yaparım)': 1995,
                'sevdana gönül verdim': 2004,
                'sevenler ağlarmış': 2000,
                'yollarda': 1993,
                'çemberimde gül oya': 2004,
                'kırmızı': 2004,
                'mavi duvar': 1998,
                'gir kanıma': 1991,
                'kal benimle': 1995,
                'papatya': 2019,
                'sevme': 2001,
                'haydi söyle': 1994,
                'sarhoş': 1984,
                'bir sebebi var': 2020,
                'bu saatten sonra': 2021,
                'işte hayat': 1977,
                'konuşamıyorum': 1977,
                'ellerimde çiçekler': 2001,
                'incir': 2014,
                'içimdeki duman': 2015,
                'sadem': 2015,
                'istanbul sokakları': 2009,
                'hayalet sevgilim': 2006,
                'beklenen gemi': 2020,
                'seni buldum ya': 2021,
                'böyle sever': 2018,
                'yıldızların altında': 2000,
                'nayino': 2009,
                'bir aşk hikayesi': 1986,
                'esmer günler': 1988,
                'gözlerinin hapsindeyim': 1990,
                'yemin ettim': 1991,
                'ben seni sevdugumi': 2002,
                'gelevera deresi': 2004,
                'aklım karıştı': 2003,
                'ara beni lütfen': 2006,
                'aşk oyunu': 2007,
                'baş harfi ben': 2006,
                'doktor': 2009,
                'gençlik marşı': 2008,
                'güzeller içinden': 2001,
                'hiç bana sordun mu': 1996,
                'kandırdım': 1996,
                'kurşun adres sormaz ki': 1993,
                'tutamıyorum zamanı': 2001,
                'yaparım bilirsin': 1993,
                'haykırsam dünyaya': 1997,
                'kar beyaz': 1997,
                'beni aşka inandır': 2011,
                'böyle ayrılık olmaz': 2011,
                'hoşgeldin': 2015,
                'sevmekten kim usanır': 1993,
                'bir garip aşk bestesi': 1998,
                'endamın yeter': 2001,
                'gidiyorum': 1999,
                'kan ve gül': 2001,
                'çayır çimen geze geze': 2001,
                'karaağaç': 1995,
                'karaağac': 1995,
                'bu gece son': 1993,
                'kadınım': 1993,
                'medcezir': 1993,
                'ya sonra': 1995,
                'yokluğunda': 2013,
                'kalbimin tek sahibine': 2014,

                // Batch 5
                'tavla': 1995,
                'mey': 2016,
                'pembe mezarlık': 2011,
                'bir derdim var': 2004,
                'cambaz': 2004,
                'deli': 2008,
                'sultaniyegah': 2005,
                'yaz yaz yaz': 2003,
                'sevemedim kara gözlüm': 1996,
                'zor dostum zor': 1997,
                'a be kaynana': 2016,
                'ben özledim': 2008,
                'kasaba': 2008,
                'lüzumsuz savaş': 2012,
                'kalbim yaralı': 2002,
                'bu akşam ölürüm': 1999,
                'mihriban': 1998,
                'araba': 1996,
                'aşka yürek gerek': 2002,
                'beni ağlatma': 1994,
                'bize gidelim beyler': 1996,
                'iki tas çorba': 1996,
                'jest oldu': 1996,
                'sana ihtiyacım var': 1996,
                'ben yoruldum hayat': 2015,
                'affet': 2006,
                'hangimiz sevmedik': 1994,
                'geceler kara tren': 1994,
                'gidelim buralardan': 1996,
                'gitme kal bu şehirde': 1992,
                'sen gibi': 2004,
                'zor': 2001,
                'bahça duvarından aştım': 1970,
                'başıma gelenler': 1974,
                'caddelerde rüzgar': 1990,
                'kim arar seni': 1979,
                'son arzum': 1976,
                'parla': 2023,
                'ezo': 1996,
                'saydım': 2004,
                'üflediler söndüm': 2011,
                'seviyorum seni': 1995,
                'yaramızda kalsın': 2018,
                '14 bahar': 2018,
                'adaletsiz seçim': 2018,
                'duygularıma esir oluyorum': 2018,
                'kurşun': 2018,
                'akşam güneşi': 1975,
                'batsın bu dünya': 1975,
                'dil yarası': 1984,
                'damla damla': 2005,
                'çekirge': 2003,
                'bulutlara esir olduk': 2016,
                'vermem seni ellere': 2017,
                'sonsuz': 1997,
                'sensiz ben': 2013,
                'beni kendinden kurtar': 2020,
                'bak': 2007,
                'aşk bir mevsim': 2019,
                'beni al': 2006,
                'beni sen inandır': 2006,
                'bilir o beni': 2018,
                'dön bak dünyaya': 2012,
                'dünyadan uzak': 2020,
                'hele bi gel (kavak yelleri)': 2006,
                'yıldızlar': 2008,
                'aşkın bahardır': 2013,
                'macera dolu amerika': 1995,
                'güzel kadın': 2013,
                'nefes bile almadan': 2008,
                'sen hep benimsin': 2007,
                'aldatıldık': 1996,
                'sevdik sevdalandık': 1997,
                'zifiri': 2017,
                'yan': 2020,
                'gitme bu gece': 2019,
                'siyahın matemi': 2000,
                'kendime yalan söyledim': 2011,
                'ölürüm hasretinle': 2005,
                'şimdi hayat': 2011,
                'özledim': 1989,
                'yürüyorum dikenlerin üstünde': 1989,
                'bana yalan söylediler': 1974,
                'dansöz': 2006,
                'haber gelmiyor yardan': 2004,
                'karabiberim': 1994,
                'mesafe': 2006,
                'zor bela': 2015,
                'aldırma deli gönlüm': 1992,
                'bir damla gözlerimde': 2010,
                'koparılan çiçekler': 2010,
                'o ye': 1992,
                'yanarım': 1999,
                'belalım': 1989,
                'ben sende tutuklu kaldım': 1998,
                'firuze': 1982,
                'geçer geçer': 1984,
                'gülümse': 1991,
                'haydi gel benimle ol': 1984,
                'istanbul istanbul olalı': 2002,
                'kaçın kurası': 1996,
                'masum değiliz': 1993,
                'sarışın': 1988,
                'seni istiyorum': 1988,
                'seni kimler aldı': 1998,
                'unuttun mu beni': 2017,
                'vazgeçtim': 1991,
                'adam': 1995,
                'aşkın olayım': 2018,
                'dilber': 2024,
                'hayyam': 2020,
                'deniz gözlüm': 2001,
                'sen giderken': 2001,
                'buz': 2009,
                'hasret türküsü': 1995,
                'içinde aşk var': 2017,
                'yan benimle': 2016,
                'bilir mi': 2016,
                'nasıl seveceğim': 2015,
                'rica ederim': 2005,
                'affetmedim kendimi': 1998,
                'koy koy koy': 1972,
                'beni anlama': 1997,
                'beni çok sev': 2017,
                'biz nereye': 2003,
                'gül döktüm yollarına': 2001,
                'hepsi senin mi (oynama şıkıdım)': 1994,
                'inci tanem': 1997,
                'kış güneşi': 1994,
                'nasıl geçti habersiz': 1997,
                'unutmamalı': 1994,
                'şeytan azapta': 1994,
                'gemiler': 1998,
                'kupa kızı sinek valesi': 2003,
                'ne ekmek ne de su': 1996,
                'papatya': 1996,
                'renkli rüyalar oteli': 2006,
                'ruhun sarışın': 2001,
                'istanbulda sonbahar': 2001,
                'yine yazı bekleriz': 2010,
                'unutmak i̇stiyorum': 2020,
                'unutmak istiyorum': 2020,
                'ben ölürsem': 2010,
                'tiryakinim': 2000,
                'yine aylardan kasım': 2000,
                'kusura bakma': 2019,
                'bu benim öyküm': 2018,
                'aytenli kadın': 2018,
                'gamzeler': 2019,
                'mor yazma': 2008,
                'neler oluyor hayatta': 1976,
                'aleni aleni': 2015,
                'günaydın': 2004,
                'her şeyim sensin': 2007,
                'ki sen': 2009,
                'kim o sakalli adam': 2018,
                'aldanırım': 1998,
                'bir tanem': 1996,
                'cezayir menekşesi': 2001,
                'kumralım': 1996,
                'kör bıçak': 1998,
                'sebepsiz fırtına': 1998,
                'dostum dostum': 1995,
                'korku': 1997,
                'ruhum': 1997,
                'samistal yaylası': 2003,
                'olmasa mektubun': 1985,
                'sezenler olmuş': 1988,
                'yedikule': 1992,
                'deli mavi': 1995,
                'sokak lambası': 2015,
                'mavi türkü': 2018,
                'aşk durdukça': 2008,
                'belki üstümüzden bir kuş geçer': 2005,
                'döneceksin diye söz ver': 2005,
                'haydi gel içelim': 2008,
                'kafile': 2005,
                'dinle beni bi': 2018,
                'sen varsın diye': 2021,
                'delikanlım': 1994,
                'anason': 2011,
                'ah bu şarkıların gözü kör olsun': 1988,
                'bir yangının külünü': 1970,
                'duydum ki unutmuşsun': 1970,
                'elbet bir gün buluşacağız': 1970,
                'fikrimin i̇nce gülü': 1974,
                'fikrimin ince gülü': 1974,
                'kıyamam': 1997,
                'uslanmıyor bu': 2020,
                'duvar': 2004,
                'pervane': 2001,
                'güneş topla benim için': 1988,
                'karlı kayın ormanında': 1978,
                'yiğidim aslanım': 1980,
                'evlerinin önü boyalı direk': 2007,
                'oy beni vurun': 2018,
                'aç kapıyı gir i̇çeri': 1974,
                'aç kapıyı gir içeri': 1974,
                'gurbet': 1972,
                'elveda': 2005,
                'şeytan': 2005,
                'kayıp şehir': 2012,
                'olduramadım': 2007,
                'dağları deldim': 2002,
                'sen anla': 1999,
                'güneş sensiz doğacak': 2005,
                'son defa': 1996,
                'gözyaşlarım anlatır': 1997,
                'bu aşk fazla sana': 1996,
                'sigara': 2001,
                'sil baştan': 2001,
                'yağmurlar': 1996,

                // Batch 6 - Multi-Artist New Songs from C:\FLY
                'cennet': 2012,
                'ankaranın bağları': 2009,
                'ankaranin baglari': 2009,
                'elvan dalton': 2010,
                'erik dalı': 2017,
                'erik dali': 2017,
                'esmerin adı oya': 1989,
                'esmerin adi oya': 1989,
                'hayatı tespih yapmışım': 2013,
                'hayati tespih yapmisim': 2013,
                'ille de roman olsun': 2008,
                'kara çalı gibi': 1993,
                'kara cali gibi': 1993,
                'konyalım': 1968,
                'konyalim': 1968,
                'osman aga': 1974,
                'zühtü': 1976,
                'zuhtu': 1976,
                'susma': 1990,
                'serserim benim': 1990,
                'ayrılık azeri': 1957,
                'ayrilik azeri': 1957,
                'anlıyorsun değil mi': 1979,
                'anliyorsun degil mi': 1979,
                'rüyamda buluttum': 2021,
                'ruyamda buluttum': 2021,
                'gökyüzünde yalnız gezen yıldızlar': 1968,
                'gokyuzunde yalniz gezen yildizlar': 1968,
                'sarı gelin': 1977,
                'sari gelin': 1977,
                'sen benim şarkılarımsın': 2001,
                'sen benim sarkilarimsin': 2001,
                'altın yüzüğüm kırıldı (pes)': 1972,
                'altin yuzugum kirildi (pes)': 1972,
                'altın yüzüğüm kırıldı': 1972,
                'altin yuzugum kirildi': 1972,
                'kerkük zindanı': 1999,
                'kerkuk zindani': 1999,
                'sarhoş (her akşam votka rakı ve şarap)': 1967,
                'sarhos (her aksam votka raki ve sarap)': 1967,
                'sahte sevgililer': 1989,
                'her şey seninle güzel': 1982,
                'her sey seninle guzel': 1982,
                'merdo': 1982,
                'sen benden gittin gideli': 2001,
                'yaşamdan ölüme': 2001,
                'yasamdan olume': 2001,
                'çıkmaz sokaklar': 2012,
                'cikmaz sokaklar': 2012,
                'yüreğimden tut': 2008,
                'yuregimden tut': 2008,
                'düşler sokağı': 1997,
                'dusler sokagi': 1997,
                'eksik bir şey mi var': 2000,
                'eksik bir sey mi var': 2000,
                'farketmeden': 1995,
                'kurşuni renkler': 1988,
                'kursuni renkler': 1988,
                'herşey bitmedi bitemez': 1976,
                'hersey bitmedi bitemez': 1976,
                'hasretler ayrılıkla başlar': 1996,
                'hasretler ayrilikla baslar': 1996,
                'rüyalar': 1991,
                'ruyalar': 1991,
                'yaz gülü': 2022,
                'yaz gulu': 2022,
                'jingle bells': 1857,
                'jingle bells - en ve tr': 1857,
                'jingle bells (en ve tr)': 1857,
                'en ve tr': 1857,
                'göçmen kızı': 1998,
                'gocmen kizi': 1998,
                'ağlama değmez hayat': 1968,
                'aglama degmez hayat': 1968,
                'ayrılmam': 1990,
                'ayrilmam': 1990,
                'bir hadise var (mühürledim seni kalbime)': 1991,
                'bir hadise var (muhurledim seni kalbime)': 1991,
                'bir hadise var': 1991,
                'bir pazar kahvaltısı': 2014,
                'bir pazar kahvaltisi': 2014,
                'rüyalara sor': 2024,
                'ruyalara sor': 2024,
                'nilüfer': 2006,
                'nilufer': 2006,
                'itirazım var': 1981,
                'itirazim var': 1981,
                'i̇tirazım var': 1981,
                'elveda meyhaneci': 1972,
                'huysuz ve tatlı kadın (şarkılar seni söyler)': 1970,
                'huysuz ve tatli kadin (sarkilar seni soyler)': 1970,
                'huysuz ve tatlı kadın': 1970,
                'huysuz ve tatli kadin': 1970,
                'leylam (yazımı kışa çevirdin)': 1970,
                'leylam (yazimi kisa cevirdin)': 1970,
                'leylam': 1970,
                'neredesin sen': 1969,
                'mevsim bahar': 1996,
                'her yerde kar var': 1965,
                'aşk kitabı': 1982,
                'ask kitabi': 1982,
                'haram geceler': 1992,
                'dokunma': 1979,
                'kal benim için': 2001,
                'kal benim icin': 2001,
                'kal benim i̇çin': 2001,
                'vazgeç gönül': 1996,
                'vazgec gonul': 1996,
                'kara kedi': 2010,
                'rüya': 1999,
                'ruya': 1999,
                'şinanay (ada vapuru)': 1989,
                'sinanay (ada vapuru)': 1989,
                'şinanay': 1989,
                'sinanay': 1989,
                'adı bende saklı': 1998,
                'adi bende sakli': 1998,
                'zalim': 1995,
                'yalnızlık senfonisi': 2011,
                'yalnizlik senfonisi': 2011,
                'biliyorsun': 1980,
                'lale devri': 2005,
                'sevemez kimse seni': 1969,
                'muhbir': 2017,
                'şımarık': 1997,
                'simarik': 1997,
                'sevdim seni bir kere': 1977,
                'iki yabancı': 2000,
                'iki yabanci': 2000,
                'i̇ki yabancı': 2000,
                'birden geldin aklıma': 2016,
                'birden geldin aklima': 2016,
                'yine sevebilirim': 2017,
                'beni sana hapsettin': 1999,
                'hareket vakti': 1994,
                'muhtemel aşk': 2015,
                'muhtemel ask': 2015,
                'vursalar ölemem': 1998,
                'vursalar olemem': 1998,
                'şimdi uzaklardasın': 1952,
                'simdi uzaklardasin': 1952,
                'lan': 2024,
                'leylim ley': 1975
            };

            const trMap = {
                'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
                'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
            };
            const toSlug = (t) => t.split('').map(c => trMap[c] || c).join('').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

            const checkArtistStmt = db.prepare('SELECT ArtistID, ArtistName FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))');
            const insertArtistStmt = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)');

            const checkSongStmt = db.prepare('SELECT SongID, SongTitle, SongYear, ChordImagePath FROM Songs WHERE TRIM(LOWER(SongTitle)) = TRIM(LOWER(?))');
            const insertSongStmt = db.prepare(`
                INSERT INTO Songs (SongTitle, Duration, SongYear, Lyrics, AudioPath, OriginalKey, ChordImagePath, LanguageID, Notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const updateSongYearStmt = db.prepare('UPDATE Songs SET SongYear = ? WHERE SongID = ?');
            const updateSongChordStmt = db.prepare('UPDATE Songs SET ChordImagePath = ? WHERE SongID = ?');
            const insertSongArtistStmt = db.prepare('INSERT OR IGNORE INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');

            const runFlySeeding = db.transaction(() => {
                for (const filename of fileList) {
                    const ext = path.extname(filename);
                    const baseName = path.basename(filename, ext).normalize('NFC');

                    const dashIndex = baseName.indexOf('-');
                    if (dashIndex === -1) {
                        continue;
                    }

                    let rawArtistPart = baseName.substring(0, dashIndex).trim();
                    let rawSongPart = baseName.substring(dashIndex + 1).trim();

                    // Clean trailing underscores/commas/(FLY) in song titles
                    rawSongPart = rawSongPart.replace(/\s*\(FLY\)\s*$/i, '').replace(/[_,]+$/, '').trim();

                    // Special case for Jingle Bells
                    let songTitle = rawSongPart;
                    let rawArtistList = rawArtistPart.split(',').map(a => a.trim()).filter(Boolean);

                    if (rawArtistPart.toLowerCase() === 'jingle bells' && rawSongPart.toLowerCase() === 'en ve tr') {
                        rawArtistList = ['Anonim'];
                        songTitle = 'Jingle Bells (EN ve TR)';
                    }

                    // Process and normalize artists
                    const artistIds = [];
                    for (let aName of rawArtistList) {
                        const aKey = aName.trim().toLocaleLowerCase('tr-TR');
                        if (ARTIST_NORM_MAP[aKey]) {
                            aName = ARTIST_NORM_MAP[aKey];
                        }

                        let artistRow = checkArtistStmt.get(aName);
                        let aId = null;
                        if (!artistRow) {
                            const info = insertArtistStmt.run(aName);
                            aId = info.lastInsertRowid;
                        } else {
                            aId = artistRow.ArtistID;
                        }
                        artistIds.push(aId);
                    }

                    const firstArtistName = rawArtistList[0] || 'various';
                    const srcFilePath = path.join(readDir, filename);
                    const destFileName = `chord_fly_${toSlug(firstArtistName)}_${toSlug(songTitle)}${ext.toLowerCase()}`;
                    const destFilePath = path.join(uploadDir, destFileName);

                    if (!fs.existsSync(destFilePath)) {
                        fs.copyFileSync(srcFilePath, destFilePath);
                    }

                    const chordImagePathValue = JSON.stringify([`/uploads/${destFileName}`]);

                    const normalizedTitleKey = songTitle.trim().toLocaleLowerCase('tr-TR');
                    const songYear = SONG_YEARS[normalizedTitleKey] || SONG_YEARS[toSlug(songTitle).replace(/_/g, ' ')] || null;

                    const existingSong = checkSongStmt.get(songTitle);
                    let songId = null;

                    if (existingSong) {
                        songId = existingSong.SongID;
                        if (!existingSong.SongYear && songYear) {
                            updateSongYearStmt.run(songYear, songId);
                        }
                        if (!existingSong.ChordImagePath || existingSong.ChordImagePath === '[]' || existingSong.ChordImagePath === '') {
                            updateSongChordStmt.run(chordImagePathValue, songId);
                        }
                    } else {
                        const info = insertSongStmt.run(
                            songTitle,
                            '',
                            songYear,
                            null,
                            null,
                            null,
                            chordImagePathValue,
                            1, // Türkçe
                            null
                        );
                        songId = info.lastInsertRowid;
                    }

                    for (const aId of artistIds) {
                        insertSongArtistStmt.run(songId, aId);
                    }
                }
            });

            runFlySeeding();
        }
    } catch (e) {
        console.error("Migration error while seeding FLY songs:", e);
    }

    console.log("Database tables initialized.");
};

export default db;
