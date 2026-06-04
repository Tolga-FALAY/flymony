import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const txtFilePath = path.join(__dirname, '..', 'frontend', 'public', 'sanatcilar.txt');
const dbFilePath = path.join(__dirname, 'song_requests.db');

// Firestore Configuration
const FIRESTORE_PROJECT_ID = 'flymony2026';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

async function main() {
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

        console.log(`\nFound ${artists.length} artists in sanatcilar.txt.`);

        // ==========================================
        // PART 1: SQLite Seeding
        // ==========================================
        console.log(`\n>>> [1/2] Seeding Local SQLite Database...`);
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

        let sqliteInsertedCount = 0;
        const sqliteSkippedArtists = [];

        if (usingFallback) {
            db.exec('BEGIN');
            try {
                for (const name of artists) {
                    const existing = checkStmt.get(name);
                    if (existing) {
                        sqliteSkippedArtists.push(name);
                    } else {
                        insertStmt.run(name);
                        sqliteInsertedCount++;
                    }
                }
                db.exec('COMMIT');
            } catch (err) {
                db.exec('ROLLBACK');
                throw err;
            }
        } else {
            const runBulkInsert = db.transaction((artistList) => {
                for (const name of artistList) {
                    const existing = checkStmt.get(name);
                    if (existing) {
                        sqliteSkippedArtists.push(name);
                    } else {
                        insertStmt.run(name);
                        sqliteInsertedCount++;
                    }
                }
            });
            runBulkInsert(artists);
        }
        db.close();
        
        console.log(`SQLite completed: ${sqliteInsertedCount} inserted, ${sqliteSkippedArtists.length} skipped.`);

        // ==========================================
        // PART 2: Firebase Firestore Seeding
        // ==========================================
        console.log(`\n>>> [2/2] Seeding Firebase Firestore...`);
        
        // 2a. Fetch all existing artists from Firestore
        const existingFirestoreArtists = [];
        let pageToken = '';
        console.log("Fetching existing artists from Firestore...");
        
        do {
            let url = `${FIRESTORE_BASE_URL}/artists?pageSize=300`;
            if (pageToken) {
                url += `&pageToken=${pageToken}`;
            }
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Failed to fetch Firestore artists: ${res.statusText}`);
            }
            const data = await res.json();
            if (data.documents) {
                for (const doc of data.documents) {
                    const parts = doc.name.split('/');
                    const id = parts[parts.length - 1];
                    const artistName = doc.fields?.ArtistName?.stringValue || '';
                    existingFirestoreArtists.push({ id: Number(id), name: artistName });
                }
            }
            pageToken = data.nextPageToken || '';
        } while (pageToken);

        console.log(`Found ${existingFirestoreArtists.length} existing artists in Firestore.`);

        // Convert existing Firestore names to a normalized lowercase set for fast lookup
        const firestoreNameSet = new Set(
            existingFirestoreArtists.map(a => a.name.trim().toLocaleLowerCase('tr-TR'))
        );

        let firestoreInsertedCount = 0;
        const firestoreSkippedArtists = [];

        // 2b. Insert missing artists
        const nowBase = Date.now();
        
        for (let i = 0; i < artists.length; i++) {
            const name = artists[i];
            const normalized = name.trim().toLocaleLowerCase('tr-TR');
            
            if (firestoreNameSet.has(normalized)) {
                firestoreSkippedArtists.push(name);
            } else {
                // Generate a unique numeric ID similar to frontend String(Date.now() + index)
                const docId = String(nowBase + i);
                const patchUrl = `${FIRESTORE_BASE_URL}/artists/${docId}`;
                
                const response = await fetch(patchUrl, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: {
                            ArtistName: {
                                stringValue: name
                            }
                        }
                    })
                });

                if (!response.ok) {
                    console.error(`Failed to insert ${name} into Firestore:`, response.statusText);
                } else {
                    firestoreInsertedCount++;
                    // Add to local set to prevent duplicate checks in the loop (in case input file has duplicates)
                    firestoreNameSet.add(normalized);
                }
            }
        }

        // ==========================================
        // FINAL REPORT
        // ==========================================
        console.log(`\n==========================================`);
        console.log(`         BULK INSERT FINAL REPORT         `);
        console.log(`==========================================`);
        console.log(`Total artists in input file : ${artists.length}`);
        console.log(`------------------------------------------`);
        console.log(`[SQLite Database]`);
        console.log(` - Successfully Inserted    : ${sqliteInsertedCount}`);
        console.log(` - Skipped (Already Exists) : ${sqliteSkippedArtists.length}`);
        console.log(`------------------------------------------`);
        console.log(`[Firebase Firestore]`);
        console.log(` - Successfully Inserted    : ${firestoreInsertedCount}`);
        console.log(` - Skipped (Already Exists) : ${firestoreSkippedArtists.length}`);
        console.log(`==========================================`);
        
        if (firestoreSkippedArtists.length > 0) {
            console.log(`\nSkipped Artist Names (Already in Firestore):`);
            firestoreSkippedArtists.forEach((name, index) => {
                console.log(`${index + 1}. ${name}`);
            });
        }

    } catch (error) {
        console.error('\nAn error occurred during bulk insert:', error);
        process.exit(1);
    }
}

main();
