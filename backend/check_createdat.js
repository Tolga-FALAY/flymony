import db from './database.js';

// Look for songs added after 2026-08-21
const recent = db.prepare(`SELECT SongID, SongTitle, CreatedAt FROM Songs WHERE CreatedAt > '2026-08-21 07:33:19' ORDER BY CreatedAt DESC, SongID DESC LIMIT 20`).all();
console.log(`Sonradan eklenen şarkılar (${recent.length} adet):`);
recent.forEach(s => console.log(`  ID: ${s.SongID} | CreatedAt: ${s.CreatedAt} | ${s.SongTitle}`));
