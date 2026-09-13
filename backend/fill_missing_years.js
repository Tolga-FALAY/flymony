import db from './database.js';
import fs from 'fs';

async function fetchYear(songTitle, artistName) {
  try {
    const query = encodeURIComponent(`${songTitle} ${artistName || ''}`.trim());
    const url = `https://itunes.apple.com/search?term=${query}&entity=song&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const releaseDate = data.results[0].releaseDate;
      if (releaseDate) {
        return new Date(releaseDate).getFullYear();
      }
    }
  } catch (err) {
    console.error(`Error fetching for ${songTitle}:`, err.message);
  }
  return null;
}

async function main() {
  const stmt = db.prepare(`
    SELECT s.SongID, s.SongTitle, GROUP_CONCAT(a.ArtistName, ', ') as ArtistNames
    FROM Songs s
    LEFT JOIN Song_Artists sa ON s.SongID = sa.SongID
    LEFT JOIN Artists a ON sa.ArtistID = a.ArtistID
    WHERE s.SongYear IS NULL OR s.SongYear = '' OR s.SongYear = 0
    GROUP BY s.SongID
  `);
  
  const songs = stmt.all();
  console.log(`Found ${songs.length} songs missing year.`);
  
  const updatedSongs = [];
  
  for (const song of songs) {
    // Ignore test songs if obvious
    if (song.SongTitle.toLowerCase().includes('test')) {
      continue;
    }
    
    console.log(`Searching year for: ${song.SongTitle} - ${song.ArtistNames || ''}`);
    const year = await fetchYear(song.SongTitle, song.ArtistNames);
    
    if (year) {
      console.log(`=> Found year: ${year}`);
      const updateStmt = db.prepare(`UPDATE Songs SET SongYear = ? WHERE SongID = ?`);
      updateStmt.run(year, song.SongID);
      updatedSongs.push({
        title: song.SongTitle,
        artist: song.ArtistNames || '-',
        year: year
      });
    } else {
      console.log(`=> No year found.`);
    }
    
    // rate limit prevention
    await new Promise(r => setTimeout(r, 500));
  }
  
  const mdContent = `# Bulunan ve İşlenen Şarkılar (Toplam: ${updatedSongs.length})\n\n` +
    `| Şarkı | Sanatçı | Bulunan Yıl |\n|-------|---------|-------------|\n` +
    updatedSongs.map(s => `| ${s.title} | ${s.artist} | ${s.year} |`).join('\n');
    
  fs.writeFileSync('updated_years_report.md', mdContent, 'utf-8');
  console.log('Finished. Report saved to updated_years_report.md');
}

main().catch(console.error);
