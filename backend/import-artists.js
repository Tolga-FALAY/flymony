import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const txtFilePath = path.join(__dirname, '../frontend/public/sanatcilar.txt');

function run() {
    try {
        console.log(`Reading artist names from: ${txtFilePath}`);
        if (!fs.existsSync(txtFilePath)) {
            console.error(`File does not exist: ${txtFilePath}`);
            process.exit(1);
        }

        const data = fs.readFileSync(txtFilePath, 'utf-8');
        const artistNames = data
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        console.log(`Found ${artistNames.length} artists in text file.`);

        const checkStmt = db.prepare('SELECT 1 FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))');
        const insertStmt = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)');

        let insertedCount = 0;
        let skippedCount = 0;

        const insertTransaction = db.transaction((names) => {
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

        console.log('Inserting artists in bulk (transaction)...');
        insertTransaction(artistNames);

        console.log(`Import completed successfully!`);
        console.log(`Inserted: ${insertedCount} new artists.`);
        console.log(`Skipped: ${skippedCount} duplicate artists.`);

    } catch (error) {
        console.error('An error occurred during import:', error);
    } finally {
        db.close();
    }
}

run();
