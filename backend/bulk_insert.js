import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const txtFilePath = path.join(__dirname, '..', 'frontend', 'public', 'sanatcilar.txt');
const dbFilePath = path.join(__dirname, 'song_requests.db');

try {
    if (!fs.existsSync(txtFilePath)) {
        console.error(`Error: File not found at ${txtFilePath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(txtFilePath, 'utf-8');
    const artists = content
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);

    console.log(`Found ${artists.length} artists in sanatcilar.txt.`);

    let db;
    let usingFallback = false;

    try {
        // Try importing project's database module
        const dbModule = await import('./database.js');
        db = dbModule.default;
        if (dbModule.initializeDB) {
            dbModule.initializeDB();
        }
    } catch (e) {
        console.log("Could not load database.js (better-sqlite3 not installed or failed).");
        console.log("Falling back to built-in node:sqlite module...");
        usingFallback = true;
        
        const { DatabaseSync } = await import('node:sqlite');
        db = new DatabaseSync(dbFilePath);
        
        // Initialize basic Artists table in case it does not exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS Artists (
                ArtistID INTEGER PRIMARY KEY AUTOINCREMENT,
                ArtistName TEXT NOT NULL
            );
        `);
    }

    const checkStmt = db.prepare('SELECT ArtistID FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))');
    const insertStmt = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)');

    let insertedCount = 0;
    const skippedArtists = [];

    if (usingFallback) {
        // node:sqlite doesn't have db.transaction(), so we handle transactions manually
        db.exec('BEGIN');
        try {
            for (const name of artists) {
                const existing = checkStmt.get(name);
                if (existing) {
                    skippedArtists.push(name);
                } else {
                    insertStmt.run(name);
                    insertedCount++;
                }
            }
            db.exec('COMMIT');
        } catch (err) {
            db.exec('ROLLBACK');
            throw err;
        }
    } else {
        // Use better-sqlite3 transaction support
        const runBulkInsert = db.transaction((artistList) => {
            for (const name of artistList) {
                const existing = checkStmt.get(name);
                if (existing) {
                    skippedArtists.push(name);
                } else {
                    insertStmt.run(name);
                    insertedCount++;
                }
            }
        });
        runBulkInsert(artists);
    }

    console.log(`\n==========================================`);
    console.log(`Bulk insert completed successfully!`);
    console.log(`------------------------------------------`);
    console.log(`Total artists read: ${artists.length}`);
    console.log(`Successfully written to DB: ${insertedCount}`);
    console.log(`Skipped (already exists): ${skippedArtists.length}`);
    console.log(`==========================================`);
    if (skippedArtists.length > 0) {
        console.log(`\nSkipped Artist Names (Already in DB):`);
        skippedArtists.forEach((name, index) => {
            console.log(`${index + 1}. ${name}`);
        });
    }
    
    // Close database connection
    db.close();
} catch (error) {
    console.error('An error occurred during bulk insert:', error);
    process.exit(1);
}
