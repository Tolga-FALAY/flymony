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

// Artist normalization map
const ARTIST_NORM_MAP = {
  'alifiru': 'Ali Firu',
  'anonimcyp': 'Anonim CYP',
  'anonimtr': 'Anonim',
  'aşık mahsuni': 'Aşık Mahsuni Şerif',
  'asik mahsuni': 'Aşık Mahsuni Şerif',
  'ahmet kaya': 'Ahmet Kaya'
};

// Known release years lookup
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
  'uzun ince bir yoldayım': 1958
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
  if (!fs.existsSync(seedFilesDir)) {
    fs.mkdirSync(seedFilesDir, { recursive: true });
  }

  // Combine files from sourceDir (if exists) and seedFilesDir
  const fileSourceMap = new Map();

  if (fs.existsSync(seedFilesDir)) {
    for (const f of fs.readdirSync(seedFilesDir)) {
      if (/\.(jpg|jpeg|png)$/i.test(f)) {
        fileSourceMap.set(f, path.join(seedFilesDir, f));
      }
    }
  }

  if (fs.existsSync(sourceDir)) {
    for (const f of fs.readdirSync(sourceDir)) {
      if (/\.(jpg|jpeg|png)$/i.test(f)) {
        const srcPath = path.join(sourceDir, f);
        fileSourceMap.set(f, srcPath);
        // Backup to fly_seeds
        const targetSeed = path.join(seedFilesDir, f);
        if (!fs.existsSync(targetSeed)) {
          fs.copyFileSync(srcPath, targetSeed);
        }
      }
    }
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

  for (const [filename, srcFilePath] of fileSourceMap.entries()) {
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

    // Apply normalization
    const artistKey = artistName.trim().toLocaleLowerCase('tr-TR');
    if (ARTIST_NORM_MAP[artistKey]) {
      artistName = ARTIST_NORM_MAP[artistKey];
    }

    // Copy to uploads folder
    const destFileName = `chord_fly_${slugify(artistName)}_${slugify(songTitle)}${ext.toLowerCase()}`;
    const destFilePath = path.join(uploadDir, destFileName);
    if (!fs.existsSync(destFilePath)) {
      fs.copyFileSync(srcFilePath, destFilePath);
    }

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
