import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { initializeDB } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure DB initialized
initializeDB();

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Year metadata lookup for C:\FLY songs
const SONG_YEARS = {
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
  'şiire gazele - azeri': 1993
};

function slugify(text) {
  const trMap = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
  };
  return text
    .split('')
    .map(char => trMap[char] || char)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function importFlySongs(sourceDir = 'C:\\FLY') {
  const seedFilesDir = path.join(__dirname, 'fly_seeds');
  let useSeedDir = false;

  let fileList = [];
  let readDir = sourceDir;

  if (fs.existsSync(sourceDir)) {
    fileList = fs.readdirSync(sourceDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    readDir = sourceDir;
  } else if (fs.existsSync(seedFilesDir)) {
    fileList = fs.readdirSync(seedFilesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
    readDir = seedFilesDir;
    useSeedDir = true;
  } else {
    console.log(`Neither ${sourceDir} nor ${seedFilesDir} found.`);
    return [];
  }

  // Also backup to fly_seeds so Hetzner server can access it
  if (!useSeedDir && !fs.existsSync(seedFilesDir)) {
    fs.mkdirSync(seedFilesDir, { recursive: true });
  }

  const reports = [];

  const checkArtistStmt = db.prepare('SELECT ArtistID, ArtistName FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))');
  const insertArtistStmt = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)');

  const checkSongStmt = db.prepare(`
    SELECT s.SongID, s.SongTitle, sa.ArtistID 
    FROM Songs s 
    INNER JOIN Song_Artists sa ON s.SongID = sa.SongID 
    WHERE TRIM(LOWER(s.SongTitle)) = TRIM(LOWER(?)) AND sa.ArtistID = ?
  `);

  const insertSongStmt = db.prepare(`
    INSERT INTO Songs (SongTitle, Duration, SongYear, Lyrics, AudioPath, OriginalKey, ChordImagePath, LanguageID, Notes) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSongArtistStmt = db.prepare('INSERT INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');

  for (const filename of fileList) {
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);

    const dashIndex = baseName.indexOf('-');
    let artistName = '';
    let songTitle = '';

    if (dashIndex !== -1) {
      artistName = baseName.substring(0, dashIndex).trim();
      songTitle = baseName.substring(dashIndex + 1).trim();
    } else {
      songTitle = baseName.trim();
    }

    if (artistName.toUpperCase() === 'AHMET KAYA') {
      artistName = 'Ahmet Kaya';
    }

    const srcFilePath = path.join(readDir, filename);

    // Save seed copy if we are reading from C:\FLY
    if (!useSeedDir) {
      const seedTarget = path.join(seedFilesDir, filename);
      if (!fs.existsSync(seedTarget)) {
        fs.copyFileSync(srcFilePath, seedTarget);
      }
    }

    // Copy to uploads
    const destFileName = `chord_fly_${slugify(artistName)}_${slugify(songTitle)}${ext.toLowerCase()}`;
    const destFilePath = path.join(uploadDir, destFileName);
    fs.copyFileSync(srcFilePath, destFilePath);

    const chordImagePathValue = JSON.stringify([`/uploads/${destFileName}`]);

    // 1. Check or Insert Artist
    let artistRow = checkArtistStmt.get(artistName);
    let artistStatus = 'Vardı';
    let artistId = null;

    if (!artistRow) {
      const info = insertArtistStmt.run(artistName);
      artistId = info.lastInsertRowid;
      artistStatus = 'Yeni Eklendi';
    } else {
      artistId = artistRow.ArtistID;
    }

    // 2. Check or Insert Song
    const existingSong = checkSongStmt.get(songTitle, artistId);
    let songStatus = 'Eklendi';
    let songId = null;

    const normalizedTitleKey = songTitle.trim().toLocaleLowerCase('tr-TR');
    const songYear = SONG_YEARS[normalizedTitleKey] || null;

    if (existingSong) {
      songStatus = 'Zaten Vardı (Atlandı)';
      songId = existingSong.SongID;
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
      insertSongArtistStmt.run(songId, artistId);
    }

    reports.push({
      file: filename,
      artistName,
      artistStatus,
      artistId,
      songTitle,
      songYear,
      songStatus,
      songId,
      chordPath: `/uploads/${destFileName}`
    });
  }

  return reports;
}

// Run if called directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  console.log("Starting C:\\FLY import...");
  const results = importFlySongs();
  console.log("\n=== IMPORT REPORT ===");
  console.table(results.map(r => ({
    'Dosya': r.file,
    'Sanatçı': r.artistName,
    'Sanatçı Durumu': r.artistStatus,
    'Şarkı': r.songTitle,
    'Yıl': r.songYear || '-',
    'Şarkı Durumu': r.songStatus,
    'Akor Görseli': r.chordPath
  })));
}
