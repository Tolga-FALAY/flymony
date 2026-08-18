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
  'ahmet kaya': 'Ahmet Kaya',
  'barış akarsu': 'Barış Akarsu',
  'baris akarsu': 'Barış Akarsu',
  'coskun sabah': 'Coşkun Sabah',
  'coşkun sabah': 'Coşkun Sabah',
  'levent yüksel': 'Levent Yüksel',
  'levent yüksel': 'Levent Yüksel',
  'ersay under': 'Ersay Üner',
  'ersay üner': 'Ersay Üner',
  'evrencan gunduz': 'Evrencan Gündüz',
  'evrencangunduz': 'Evrencan Gündüz',
  'evrencan gündüz': 'Evrencan Gündüz',
  'feride hilal akin': 'Feride Hilal Akın',
  'feride hilal akın': 'Feride Hilal Akın',
  'ibrahim erkal': 'İbrahim Erkal',
  'i̇brahim erkal': 'İbrahim Erkal',
  'ibrahim tatlıses': 'İbrahim Tatlıses',
  'i̇brahim tatlıses': 'İbrahim Tatlıses',
  'ikilem': 'İkilem',
  'i̇kilem': 'İkilem',
  'ilhan irem': 'İlhan İrem',
  'i̇lhan i̇rem': 'İlhan İrem',
  'ilhan şeşen': 'İlhan Şeşen',
  'i̇lhan şeşen': 'İlhan Şeşen',
  'ilyas yalçıntaş': 'İlyas Yalçıntaş',
  'i̇lyas yalçıntaş': 'İlyas Yalçıntaş',
  'intizar': 'İntizar',
  'i̇ntizar': 'İntizar',
  'irem': 'İrem',
  'i̇rem': 'İrem',
  'irem derici': 'İrem Derici',
  'i̇rem derici': 'İrem Derici',
  'koray avci': 'Koray Avcı',
  'koray avcı': 'Koray Avcı',
  'hiraizerdüş': 'HiraiZerdüş',
  'hiraizerdüs': 'HiraiZerdüş'
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
  'uzun ince bir yoldayım': 1958,

  // Batch 3
  'bu fasulya yedi buçuk lira': null,
  'yanayım yanayım': 2009,
  'bana kara diyen dilber': 2005,
  'sen ağlama': 2005,
  'yalnızlık benim eski sevgilim': 2000,
  'kır papatyası': 2015,
  'unutulur': 1982,
  'ringo ringo şişeler': 2019,
  'gel gör beni aşk neyledi': 2004,
  'gözlerin (yalancı yarim)': 2006,
  'alla beni pulla beni': 1983,
  'aynalı kemer': 1978,
  'dağlar dağlar': 1970,
  'domates biber patlıcan sf1': 1988,
  'domates biber patlıcan sf2': 1988,
  'gesi bağları': 1978,
  'gülpembe': 1981,
  'kara sevda': 1988,
  'kol düğmeleri': 1968,
  'zalım sultan': 1978,
  'efendim işitmedim': 2004,
  'saygımdan': 2013,
  'sev yeter': 1986,
  'yaralarını ben sarayım': 2022,
  'müebbet': 2014,
  'seni seviyorum': 1995,
  'sözlerimi geri alamam': 1996,
  'bebeğim': 1994,
  'benimle oynama': 1994,
  'sen sevda mısın': 2015,
  'benimle oynar mısın': 1974,
  'bu su hiç durmaz': 1990,
  'sensiz olmaz': 1994,
  'haydar haydar': 2013,
  'yalnızım ben': 2013,
  'gökyüzünü tutamam': 2021,
  'acıtır gibi severek': 2020,
  'ağlama ben ağlarım': 2019,
  'sar bu şehri': 2018,
  'toprak yağmura': 2019,
  'annem': 2000,
  'kırık kalpler durağı': 2009,
  'neden': 2002,
  'onlar yanlış biliyor': 1997,
  'söz vermiştin': 2002,
  'kül': 2020,
  'mutlu yıllar': 2010,
  'sen gel diyorsun (öf öf)': 2014,
  'yağmur': 2008,
  'bekle beni': 1982,
  'bu son olsun': 1969,
  'deniz üstü köpürür': 1974,
  'ıslak ıslak': 1992,
  'mavi liman': 1987,
  'namus belası': 1974,
  'raptiye rap rap': 1992,
  'resimdeki gözyaşları': 1968,
  'sen de başını alıp gitme': 1992,
  'tamirci çırağı': 1975,
  'imkansız aşk': 2006,
  'dön bana': 2006,
  'esmer': 2014,
  'hatıram olsun': 1989,
  'bilinmeyen saati uygulaması': 2010,
  'arnavut kaldırımı': 1994,
  'aşktan öte': 2004,
  'gümüş': 2000,
  'deniz koydum adını': 2017,
  'kalbimi kırıyorlar anne': 2020,
  'aldattın mı': 2019,
  'dilerim ki': 2021,
  'gitme': 2019,
  'yapma nolursun': 2017,
  'ahh': 2002,
  'aman aman': 2005,
  'bekle dedi gitti': 2002,
  'beni yak': 1999,
  'elleri ellerime': 2009,
  'kufi': 2024,
  'senden daha güzel': 2009,
  'sor bana pişman mıyım': 2009,
  'yanıbaşımdan': 2002,
  'yürek': 2002,
  'içerim ben bu akşam': 1999,
  'sevdan bir ateş': 1999,
  'çavbella': 1989,
  'terk edilmiş şehirler': 2021,
  'delibal': 2015,
  'afedersin': 1996,
  'ateşteyim': 1994,
  'dilberim': 1994,
  'hercai': 1995,
  'meyhaneci': 1996,

  // Batch 4
  'çingenem': 1999,
  'hatırla sevgili': 2019,
  'aldırma gönül': 1977,
  'güzel günler göreceğiz çocuklar': 1996,
  'hasretinle yandı gönlüm': 1990,
  'kuşlar': 1990,
  'delice bir sevda': 1995,
  'yaz aşkım': 1995,
  'hovarda': 1995,
  'ali cabbar': 2023,
  'beyaz skandalım': 2019,
  'can dostum': 2021,
  'devriliyorsam': 2019,
  'müzik kutusu': 2017,
  'nalan': 2019,
  'aşkı kıyamet': 2003,
  'neyleyim': 2003,
  'sensiz olmuyor': 2005,
  'yani': 2003,
  'belki bir gün özlersin': 2006,
  'hoşçakal': 2010,
  'soğuk odalar': 2012,
  'senden güzeli mi var': 2023,
  'hanımefendi': 2019,
  'elveda deme bana': 1996,
  'sayenizde': 1995,
  'anlatmalıymış meğer': 2000,
  'anma arkadaş': 1974,
  'arap saçı': 1976,
  'aşkımız bitecek': 1976,
  'estarabim': 1975,
  'fesuphanallah': 1974,
  'sevdiğin (doğarken dünyayı)': 1977,
  'yalnızlar rıhtımı': 1976,
  'çöpçüler': 1977,
  'ah bu hayat çekilmez': 1976,
  'işte öyle bir şey': 1976,
  'iki aşık': 2017,
  'unutma beni': 1974,
  'uzunlar': 2020,
  'benimle evlensen kısa': 2018,
  'felaket': 2019,
  'gel ya da git': 2014,
  'ben ölmeden önce': 1999,
  'suçum değil': 1999,
  'anı': 1992,
  'ellerim bomboş': 1992,
  'sonuna kadar': 1995,
  'üzülme': 1995,
  'bana sor': 1990,
  'ben de özledim': 1982,
  'bu şehir': 1988,
  'hatıran yeter': 1990,
  'sabahçı kahvesi': 1992,
  'aşkımı bir sır gibi (gündüzüm seninle)': 1980,
  'dilek taşı': 1978,
  'intihaşk': 2017,
  'alev alev': 2002,
  'mandalinalar': 2012,
  'gönül': 1993,
  'hayal edemezsin': 2014,
  'trenler': 2014,
  'yol': 2018,
  'yak gel': 2009,
  'meyhaneler sen': 2008,
  'aşk nerden nereye': 2010,
  'al aşkını sok': 1994,
  'istanbulda': 1992,
  'gündoğdu marşı': 1988,
  'uğurlama': 1991,
  'yerine sevemem': 1994,
  'üstüme basıp geçme yar': 1995,
  'birkaç beden önce': 2011,
  'aşk': 2019,
  'derdim': 2021,
  'mahşer': 2022,
  'sen i̇stanbulsun': 2014,
  'sen istanbulsun': 2014,
  'yüreğim': 2010,
  'çatı katı': 2014,
  'kalbime gömerim o zaman': 2006,
  'cesaretin var mı aşka': 1995,
  'sen evlisin': 1984,
  'bir telefon': 2004,
  'bir efsaneydi': 1989,
  'karam': 2000,
  'köylü güzeli': 1993,
  'duyanlara': 2015,
  'galata': 2014,
  'isyan': 2011,
  'içim paramparça': 2011,
  'olsun': 2011,
  'allı turnam': 1998,
  'ankara': 1993,
  'anlasana': 1996,
  'aşkın mapushane': 2000,
  'dağlar mı yollar mı': 2004,
  'dert olur': 1999,
  'dostum': 1996,
  'ela gözlüm': 1996,
  'elfida': 2006,
  'kaçış (uçak yaparım)': 1995,
  'sevdana gönül verdim': 2004,
  'sevenler ağlarmış': 2000,
  'yollarda': 1993,
  'çemberimde gül oya': 2004,
  'kırmızı': 2004,
  'mavi duvar': 1998,
  'gir kanıma': 1991,
  'kal benimle': 1995,
  'papatya': 2019,
  'sevme': 2001,
  'haydi söyle': 1994,
  'sarhoş': 1984,
  'bir sebebi var': 2020,
  'bu saatten sonra': 2021,
  'işte hayat': 1977,
  'konuşamıyorum': 1977,
  'ellerimde çiçekler': 2001,
  'incir': 2014,
  'içimdeki duman': 2015,
  'sadem': 2015,
  'istanbul sokakları': 2009,
  'hayalet sevgilim': 2006,
  'beklenen gemi': 2020,
  'seni buldum ya': 2021,
  'böyle sever': 2018,
  'yıldızların altında': 2000,
  'nayino': 2009,
  'bir aşk hikayesi': 1986,
  'esmer günler': 1988,
  'gözlerinin hapsindeyim': 1990,
  'yemin ettim': 1991,
  'ben seni sevdugumi': 2002,
  'gelevera deresi': 2004,
  'aklım karıştı': 2003,
  'ara beni lütfen': 2006,
  'aşk oyunu': 2007,
  'baş harfi ben': 2006,
  'doktor': 2009,
  'gençlik marşı': 2008,
  'güzeller içinden': 2001,
  'hiç bana sordun mu': 1996,
  'kandırdım': 1996,
  'kurşun adres sormaz ki': 1993,
  'tutamıyorum zamanı': 2001,
  'yaparım bilirsin': 1993,
  'haykırsam dünyaya': 1997,
  'kar beyaz': 1997,
  'beni aşka inandır': 2011,
  'böyle ayrılık olmaz': 2011,
  'hoşgeldin': 2015,
  'sevmekten kim usanır': 1993,
  'bir garip aşk bestesi': 1998,
  'endamın yeter': 2001,
  'gidiyorum': 1999,
  'kan ve gül': 2001,
  'çayır çimen geze geze': 2001,
  'karaağaç': 1995,
  'karaağac': 1995,
  'bu gece son': 1993,
  'kadınım': 1993,
  'medcezir': 1993,
  'ya sonra': 1995,
  'yokluğunda': 2013,
  'kalbimin tek sahibine': 2014
};

function slugify(text) {
  const trMap = {
    'ç': 'c', 'Ç': 'c', 'ğ': 'g', 'Ğ': 'g', 'ı': 'i', 'I': 'i', 'İ': 'i', 'i': 'i',
    'ö': 'o', 'Ö': 'o', 'ş': 's', 'Ş': 's', 'ü': 'u', 'Ü': 'u'
  };
  return text
    .normalize('NFC')
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
    const baseName = path.basename(filename, ext).normalize('NFC');

    // Rule: Skip files with more than one dash '-'
    const dashCount = (baseName.match(/-/g) || []).length;
    if (dashCount > 1) {
      reports.push({
        file: filename,
        artistName: '-',
        artistStatus: '-',
        artistId: null,
        songTitle: '-',
        songYear: null,
        songStatus: 'Atlandı (Birden fazla tire içeriyor)',
        songId: null,
        chordPath: '-'
      });
      continue;
    }

    const dashIndex = baseName.indexOf('-');
    if (dashIndex === -1) {
      reports.push({
        file: filename,
        artistName: '-',
        artistStatus: '-',
        artistId: null,
        songTitle: baseName,
        songYear: null,
        songStatus: 'Atlandı (Tire bulunamadı)',
        songId: null,
        chordPath: '-'
      });
      continue;
    }

    let artistName = baseName.substring(0, dashIndex).trim();
    let songTitle = baseName.substring(dashIndex + 1).trim();

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
