/**
 * migrate_base64_to_uploads.js
 * 
 * Veritabanındaki (Gigs, Guests, QuickNotes, Songs) Base64 olarak kayıtlı tüm fotoğrafları
 * fiziksel dosya olarak ../uploads/ klasörüne çıkarır ve veritabanındaki kayıtları
 * dosya yolları (/uploads/...) ile günceller.
 * 
 * İşlem öncesinde veritabanının otomatik yedeğini alır.
 * İşlem sonunda VACUUM çalıştırarak veritabanı dosyasını küçültür.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'song_requests.db');
const uploadsDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(dbPath)) {
    console.error('❌ Veritabanı dosyası bulunamadı:', dbPath);
    process.exit(1);
}

// 1. uploads klasörünü hazırla
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 uploads klasörü oluşturuldu:', uploadsDir);
}

// 2. Güvenlik için veritabanı yedeği al
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `song_requests.db.bak_${timestamp}`);
fs.copyFileSync(dbPath, backupPath);
console.log(`🛡️  Veritabanı güvenli yedeği alındı: ${path.basename(backupPath)}`);

const initialDbSize = fs.statSync(dbPath).size;
console.log(`📊 Başlangıç veritabanı boyutu: ${(initialDbSize / (1024 * 1024)).toFixed(2)} MB`);

const db = new Database(dbPath);

// Base64 string'i fiziksel dosyaya kaydetme yardımcısı
function saveBase64ToFile(dataUri, filePrefix, customExactName = null) {
    if (!dataUri || typeof dataUri !== 'string' || !dataUri.startsWith('data:image/')) {
        return null;
    }

    try {
        const parts = dataUri.split(';base64,');
        if (parts.length !== 2) return null;

        const meta = parts[0];
        const base64Data = parts[1];
        const mimeType = meta.split(':')[1]?.split(';')[0] || 'image/jpeg';

        let ext = 'jpg';
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('gif')) ext = 'gif';
        else if (mimeType.includes('svg')) ext = 'svg';

        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = customExactName 
            ? `${customExactName}.${ext}`
            : `${filePrefix}_${Date.now()}_${Math.floor(Math.random() * 1000000)}.${ext}`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, buffer);
        return `/uploads/${fileName}`;
    } catch (err) {
        console.error('Fotoğraf kaydedilirken hata:', err.message);
        return null;
    }
}

// Tarihi YYYYAAGG ve gün adı (ASCII) olarak ayıklar
function formatGigDateInfo(dateStr) {
    if (!dateStr) return { yyyymmdd: '00000000', dayName: 'Bilinmeyen' };
    const cleanDate = dateStr.split('T')[0].trim();
    const parts = cleanDate.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return { yyyymmdd: '00000000', dayName: 'Bilinmeyen' };
    }
    const [year, month, day] = parts;
    const yyyymmdd = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    const d = new Date(year, month - 1, day, 12, 0, 0);
    const dayNames = ['Pazar', 'Pazartesi', 'Sali', 'Carsamba', 'Persembe', 'Cuma', 'Cumartesi'];
    const dayName = dayNames[d.getDay()] || 'Gun';
    return { yyyymmdd, dayName };
}

function getVenueAbbreviation(venue) {
    if (!venue) return 'GN';
    const trMap = {
        'ç': 'C', 'Ç': 'C', 'ğ': 'G', 'Ğ': 'G', 'ı': 'I', 'I': 'I', 'İ': 'I', 'i': 'I',
        'ö': 'O', 'Ö': 'O', 'ş': 'S', 'Ş': 'S', 'ü': 'U', 'Ü': 'U'
    };
    if (venue.Abbreviation && venue.Abbreviation.trim()) {
        const abbrevClean = venue.Abbreviation.trim()
            .split('')
            .map(c => trMap[c] || c)
            .join('')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
        if (abbrevClean) return abbrevClean;
    }
    const venueName = (venue.VenueName || '').trim();
    if (!venueName) return 'GN';
    const cleanName = venueName.split('').map(c => trMap[c] || c).join('');
    const words = cleanName.split(/\s+/).filter(Boolean);
    if (words.length > 1) {
        return words.map(w => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
    } else {
        return cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
}

function generateGigPhotoBaseName(venue, gigDate, photoIndex = 0) {
    const { yyyymmdd, dayName } = formatGigDateInfo(gigDate);
    const venueAbbrev = getVenueAbbreviation(venue);
    const numStr = String(photoIndex + 1).padStart(2, '0');
    return `gig_${yyyymmdd}_${dayName}_${venueAbbrev}_${numStr}`;
}

let totalMigratedFiles = 0;
let totalBytesSaved = 0;

// ==========================================
// 3. GUESTS MİGRASYONU (ProfilePicture & Photos)
// ==========================================
console.log('\n⏳ Misafir (Guests) fotoğrafları taranıyor...');
const guests = db.prepare('SELECT GuestID, ProfilePicture, Photos FROM Guests').all();
const updateGuest = db.prepare('UPDATE Guests SET ProfilePicture = ?, Photos = ? WHERE GuestID = ?');

const guestMigration = db.transaction(() => {
    let guestUpdatedCount = 0;
    for (const g of guests) {
        let changed = false;
        let newProfilePic = g.ProfilePicture;
        let newPhotos = [];

        // Profil resmi kontrolü
        if (g.ProfilePicture && g.ProfilePicture.startsWith('data:image/')) {
            const savedPath = saveBase64ToFile(g.ProfilePicture, `guest_avatar_${g.GuestID}`);
            if (savedPath) {
                totalBytesSaved += g.ProfilePicture.length;
                newProfilePic = savedPath;
                changed = true;
                totalMigratedFiles++;
            }
        }

        // Misafir albüm fotoğrafları kontrolü
        if (g.Photos) {
            try {
                const photosArr = typeof g.Photos === 'string' ? JSON.parse(g.Photos) : g.Photos;
                if (Array.isArray(photosArr)) {
                    for (let i = 0; i < photosArr.length; i++) {
                        const p = photosArr[i];
                        if (typeof p === 'string' && p.startsWith('data:image/')) {
                            const savedPath = saveBase64ToFile(p, `guest_${g.GuestID}_${i}`);
                            if (savedPath) {
                                totalBytesSaved += p.length;
                                newPhotos.push(savedPath);
                                changed = true;
                                totalMigratedFiles++;
                            } else {
                                newPhotos.push(p);
                            }
                        } else {
                            newPhotos.push(p);
                        }
                    }
                }
            } catch (e) {
                newPhotos = g.Photos;
            }
        }

        if (changed) {
            updateGuest.run(newProfilePic || '', JSON.stringify(newPhotos), g.GuestID);
            guestUpdatedCount++;
        }
    }
    return guestUpdatedCount;
});

const updatedGuestsCount = guestMigration();
console.log(`✅ Misafir tablosu güncellendi: ${updatedGuestsCount} misafirin fotoğrafları taşındı.`);

// ==========================================
// 4. GIGS MİGRASYONU (Sahne Fotoğrafları)
// ==========================================
console.log('\n⏳ Sahne Kayıtları (Gigs) fotoğrafları taranıyor...');
const gigs = db.prepare(`
    SELECT g.GigID, g.GigDate, g.Photos, v.VenueName, v.Abbreviation 
    FROM Gigs g 
    LEFT JOIN Venues v ON g.VenueID = v.VenueID
`).all();
const updateGig = db.prepare('UPDATE Gigs SET Photos = ? WHERE GigID = ?');

const gigMigration = db.transaction(() => {
    let gigUpdatedCount = 0;
    for (const gig of gigs) {
        if (!gig.Photos) continue;
        let changed = false;
        let newPhotos = [];

        try {
            const photosArr = typeof gig.Photos === 'string' ? JSON.parse(gig.Photos) : gig.Photos;
            if (Array.isArray(photosArr)) {
                for (let i = 0; i < photosArr.length; i++) {
                    const p = photosArr[i];
                    if (typeof p === 'string' && p.startsWith('data:image/')) {
                        const baseName = generateGigPhotoBaseName(gig, gig.GigDate, i);
                        const savedPath = saveBase64ToFile(p, 'gig', baseName);
                        if (savedPath) {
                            totalBytesSaved += p.length;
                            newPhotos.push(savedPath);
                            changed = true;
                            totalMigratedFiles++;
                        } else {
                            newPhotos.push(p);
                        }
                    } else {
                        newPhotos.push(p);
                    }
                }
            }
        } catch (e) {
            newPhotos = gig.Photos;
        }

        if (changed) {
            updateGig.run(JSON.stringify(newPhotos), gig.GigID);
            gigUpdatedCount++;
        }
    }
    return gigUpdatedCount;
});

const updatedGigsCount = gigMigration();
console.log(`✅ Sahne kayıtları tablosu güncellendi: ${updatedGigsCount} sahnenin fotoğrafları taşındı.`);

// ==========================================
// 5. QUICKNOTES MİGRASYONU (Not Fotoğrafları)
// ==========================================
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
if (tables.includes('QuickNotes')) {
    console.log('\n⏳ Hızlı Notlar (QuickNotes) fotoğrafları taranıyor...');
    const notes = db.prepare('SELECT NoteID, Photos FROM QuickNotes').all();
    const updateNote = db.prepare('UPDATE QuickNotes SET Photos = ? WHERE NoteID = ?');

    const noteMigration = db.transaction(() => {
        let noteUpdatedCount = 0;
        for (const note of notes) {
            if (!note.Photos) continue;
            let changed = false;
            let newPhotos = [];

            try {
                const photosArr = typeof note.Photos === 'string' ? JSON.parse(note.Photos) : note.Photos;
                if (Array.isArray(photosArr)) {
                    for (let i = 0; i < photosArr.length; i++) {
                        const p = photosArr[i];
                        if (typeof p === 'string' && p.startsWith('data:image/')) {
                            const savedPath = saveBase64ToFile(p, `note_${note.NoteID}_${i}`);
                            if (savedPath) {
                                totalBytesSaved += p.length;
                                newPhotos.push(savedPath);
                                changed = true;
                                totalMigratedFiles++;
                            } else {
                                newPhotos.push(p);
                            }
                        } else {
                            newPhotos.push(p);
                        }
                    }
                }
            } catch (e) {
                newPhotos = note.Photos;
            }

            if (changed) {
                updateNote.run(JSON.stringify(newPhotos), note.NoteID);
                noteUpdatedCount++;
            }
        }
        return noteUpdatedCount;
    });

    const updatedNotesCount = noteMigration();
    console.log(`✅ Notlar tablosu güncellendi: ${updatedNotesCount} notun fotoğrafları taşındı.`);
}

// ==========================================
// 6. SONGS MİGRASYONU (Varsa Base64 Akorlar)
// ==========================================
console.log('\n⏳ Şarkı akor görselleri taranıyor...');
const songs = db.prepare('SELECT SongID, ChordImagePath FROM Songs').all();
const updateSongChord = db.prepare('UPDATE Songs SET ChordImagePath = ? WHERE SongID = ?');

let songUpdatedCount = 0;
for (const s of songs) {
    if (!s.ChordImagePath) continue;
    let changed = false;
    let newPaths = [];

    try {
        let list = [];
        if (s.ChordImagePath.startsWith('[')) {
            list = JSON.parse(s.ChordImagePath);
        } else {
            list = [s.ChordImagePath];
        }

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (typeof item === 'string' && item.startsWith('data:image/')) {
                const savedPath = saveBase64ToFile(item, `chord_${s.SongID}_${i}`);
                if (savedPath) {
                    totalBytesSaved += item.length;
                    newPaths.push(savedPath);
                    changed = true;
                    totalMigratedFiles++;
                } else {
                    newPaths.push(item);
                }
            } else {
                newPaths.push(item);
            }
        }

        if (changed) {
            updateSongChord.run(JSON.stringify(newPaths), s.SongID);
            songUpdatedCount++;
        }
    } catch (e) {}
}
if (songUpdatedCount > 0) {
    console.log(`✅ Şarkılar tablosu güncellendi: ${songUpdatedCount} şarkı akoru taşındı.`);
} else {
    console.log(`✅ Şarkılarda taşınacak base64 akor yok (zaten uploads klasöründe).`);
}

// ==========================================
// 7. VACUUM: Veritabanını Sıkıştır ve Küçült
// ==========================================
console.log('\n🧹 Veritabanı sıkıştırılıyor (VACUUM)...');
db.exec('VACUUM;');

const finalDbSize = fs.statSync(dbPath).size;

console.log('\n========================================');
console.log('🎉 MİGRASYON BAŞARIYLA TAMAMLANDI!');
console.log('========================================');
console.log(`📁 uploads/ klasörüne çıkarılan fotoğraf sayısı : ${totalMigratedFiles} adet`);
console.log(`💾 Veritabanından temizlenen Base64 veri hacmi   : ${(totalBytesSaved / (1024 * 1024)).toFixed(2)} MB`);
console.log(`📉 Başlangıç Veritabanı Boyutu                   : ${(initialDbSize / (1024 * 1024)).toFixed(2)} MB`);
console.log(`✨ Sıkıştırma Sonrası Veritabanı Boyutu          : ${(finalDbSize / (1024 * 1024)).toFixed(2)} MB`);
console.log(`🚀 Veritabanı Boyut Kazancı                      : %${(((initialDbSize - finalDbSize) / initialDbSize) * 100).toFixed(1)}`);
console.log('========================================\n');
