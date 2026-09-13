import db from './database.js';

const stmt = db.prepare(`
  SELECT s.SongID, s.SongTitle, GROUP_CONCAT(a.ArtistName, ', ') as ArtistNames
  FROM Songs s
  LEFT JOIN Song_Artists sa ON s.SongID = sa.SongID
  LEFT JOIN Artists a ON sa.ArtistID = a.ArtistID
  WHERE s.SongYear IS NULL OR s.SongYear = '' OR s.SongYear = 0
  GROUP BY s.SongID
`);

const songs = stmt.all();
console.log('Missing year count:', songs.length);
// Print first 5 just to see
console.log(songs.slice(0, 5));
