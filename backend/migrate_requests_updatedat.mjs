/**
 * migrate_requests_updatedat.mjs
 * 
 * ONE-TIME migration: Adds UpdatedAt column to Requests table if missing.
 * Run this on Hetzner server: node backend/migrate_requests_updatedat.mjs
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'song_requests.db'));

console.log('=== Requests UpdatedAt Migration ===\n');

const cols = db.prepare('PRAGMA table_info(Requests)').all();
console.log('Mevcut kolonlar:', cols.map(c => c.name).join(', '));

if (!cols.some(c => c.name === 'UpdatedAt')) {
    console.log('\nUpdatedAt kolonu EKSİK — ekleniyor...');
    db.exec('ALTER TABLE Requests ADD COLUMN UpdatedAt DATETIME;');
    const result = db.prepare('UPDATE Requests SET UpdatedAt = RequestDate WHERE UpdatedAt IS NULL').run();
    console.log(`UpdatedAt kolonu eklendi. ${result.changes} kayıt güncellendi.`);
} else {
    console.log('\nUpdatedAt kolonu zaten mevcut — migration gerekmedi.');
}

// Verify
const sample = db.prepare('SELECT RequestID, RequestDate, UpdatedAt FROM Requests LIMIT 5').all();
console.log('\nDoğrulama (ilk 5 kayıt):');
sample.forEach(r => console.log(` RequestID: ${r.RequestID}, RequestDate: ${r.RequestDate}, UpdatedAt: ${r.UpdatedAt}`));

db.close();
console.log('\n✅ Migration tamamlandı.');
