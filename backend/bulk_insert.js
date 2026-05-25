import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const txtFilePath = path.join(__dirname, '..', 'frontend', 'public', 'sanatcilar.txt');

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

    const checkStmt = db.prepare('SELECT ArtistID FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))');
    const insertStmt = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)');

    let insertedCount = 0;
    let skippedCount = 0;

    const runBulkInsert = db.transaction((artistList) => {
        for (const name of artistList) {
            const existing = checkStmt.get(name);
            if (existing) {
                skippedCount++;
            } else {
                insertStmt.run(name);
                insertedCount++;
            }
        }
    });

    runBulkInsert(artists);

    console.log(`Bulk insert completed!`);
    console.log(`Inserted: ${insertedCount}`);
    console.log(`Skipped (already exists): ${skippedCount}`);
    
    // Close database connection
    db.close();
} catch (error) {
    console.error('An error occurred during bulk insert:', error);
    process.exit(1);
}
