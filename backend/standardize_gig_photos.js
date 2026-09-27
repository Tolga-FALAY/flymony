/**
 * standardize_gig_photos.js
 * 
 * uploads/ klasöründeki tüm sahne (gig) fotoğraflarını standart isimlendirme formatına dönüştürür:
 *   Format: gig_YYYYAAGG_Gun_MEKAN_XX.uzanti
 *   Örnek : gig_20260925_Cuma_BR_01.jpg
 * 
 * Veritabanındaki (Gigs.Photos) kayıtlarını yeni dosya isimleriyle günceller.
 * Varsa eski/artık yinelenen ve sahipsiz dosyaları temizler.
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

// Güvenlik yedeği al
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(__dirname, `song_requests.db.bak_gigphotos_${timestamp}`);
fs.copyFileSync(dbPath, backupPath);
console.log(`🛡️  Veritabanı güvenli yedeği alındı: ${path.basename(backupPath)}`);

const db = new Database(dbPath);

// PRAGMA kontrolü: Venues tablosunda Abbreviation kolonu var mı?
try {
    const tableInfo = db.prepare("PRAGMA table_info(Venues)").all();
    const hasAbbrev = tableInfo.some(col => col.name === 'Abbreviation');
    if (!hasAbbrev) {
        db.exec("ALTER TABLE Venues ADD COLUMN Abbreviation TEXT;");
        console.log("ℹ️  Venues tablosuna 'Abbreviation' kolonu eklendi.");
    }
} catch (e) {
    console.warn("⚠️  Venues kolon kontrolü uyarısı:", e.message);
}

/**
 * Tarihi YYYYAAGG ve gün adı (ASCII) olarak ayıklar
 * Örn: '2026-09-25' -> { yyyymmdd: '20260925', dayName: 'Cuma' }
 */
function formatGigDateInfo(dateStr) {
    if (!dateStr) return { yyyymmdd: '00000000', dayName: 'Bilinmeyen' };
    const cleanDate = dateStr.split('T')[0].trim();
    const parts = cleanDate.split('-').map(Number);
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        return { yyyymmdd: '00000000', dayName: 'Bilinmeyen' };
    }
    const [year, month, day] = parts;
    const yyyymmdd = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    
    // Öğle vakti (12:00) oluşturarak saat dilimi/yaz saati kaymalarını önle
    const d = new Date(year, month - 1, day, 12, 0, 0);
    const dayIndex = d.getDay(); // 0: Pazar, 1: Pazartesi, ...
    
    // Web ve URL uyumluluğu için Türkçe karakterler ASCII'ye uyarlanmıştır
    const dayNames = [
        'Pazar',      // 0
        'Pazartesi',  // 1
        'Sali',       // 2
        'Carsamba',   // 3
        'Persembe',   // 4
        'Cuma',       // 5
        'Cumartesi'   // 6
    ];
    
    const dayName = dayNames[dayIndex] || 'Gun';
    return { yyyymmdd, dayName };
}

/**
 * Mekan kısaltmasını belirler:
 * 1. Abbreviation alanı doluysa onu kullanır (ASCII ve temizlenmiş büyük harf).
 * 2. Dolu değilse:
 *    - Tek kelimelik mekan ise adın kendisini büyük harf yapar (örn: 'Quadro' -> 'QUADRO').
 *    - Çok kelimelik mekan ise kelimelerin ilk harflerini alır (örn: 'Black Raven' -> 'BR').
 */
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
    
    const cleanName = venueName
        .split('')
        .map(c => trMap[c] || c)
        .join('');
    
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

console.log('\n⏳ Sahne kayıtları taranıyor ve fotoğraflar standartlaştırılıyor...');

const gigs = db.prepare(`
    SELECT g.GigID, g.GigDate, g.Photos, g.VenueID, v.VenueName, v.Abbreviation
    FROM Gigs g
    LEFT JOIN Venues v ON g.VenueID = v.VenueID
    WHERE g.Photos IS NOT NULL AND g.Photos != '' AND g.Photos != '[]'
`).all();

const updateGig = db.prepare('UPDATE Gigs SET Photos = ? WHERE GigID = ?');

let totalRenamed = 0;
let totalUpdatedGigs = 0;
const referencedFiles = new Set();

const migrationTransaction = db.transaction(() => {
    for (const gig of gigs) {
        let photosList = [];
        try {
            photosList = typeof gig.Photos === 'string' ? JSON.parse(gig.Photos) : gig.Photos;
        } catch (e) {
            if (typeof gig.Photos === 'string' && gig.Photos.trim()) {
                photosList = [gig.Photos.trim()];
            }
        }

        if (!Array.isArray(photosList) || photosList.length === 0) continue;

        let gigChanged = false;
        const newPhotosList = [];
        const venue = { VenueName: gig.VenueName, Abbreviation: gig.Abbreviation };

        for (let i = 0; i < photosList.length; i++) {
            const currentItem = photosList[i];
            if (!currentItem || typeof currentItem !== 'string') continue;

            // Eğer base64 olarak kalmış bir fotoğraf varsa dosyaya kaydet
            if (currentItem.startsWith('data:image/')) {
                const parts = currentItem.split(',');
                const meta = parts[0] || '';
                const base64Data = parts[1] || '';
                let ext = 'jpg';
                if (meta.includes('png')) ext = 'png';
                else if (meta.includes('webp')) ext = 'webp';

                const targetBase = generateGigPhotoBaseName(venue, gig.GigDate, i);
                const targetFileName = `${targetBase}.${ext}`;
                const targetDiskPath = path.join(uploadsDir, targetFileName);

                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }

                fs.writeFileSync(targetDiskPath, Buffer.from(base64Data, 'base64'));
                newPhotosList.push(`/uploads/${targetFileName}`);
                referencedFiles.add(targetFileName);
                gigChanged = true;
                totalRenamed++;
                console.log(`  💾 Base64 Sahne Fotoğrafı Kaydedildi: ${targetFileName}`);
                continue;
            }

            if (!currentItem.startsWith('/uploads/')) {
                newPhotosList.push(currentItem);
                continue;
            }

            const currentFileName = path.basename(currentItem);
            const ext = path.extname(currentFileName).toLowerCase() || '.jpg';
            const targetBase = generateGigPhotoBaseName(venue, gig.GigDate, i);
            const targetFileName = `${targetBase}${ext}`;
            const targetPath = `/uploads/${targetFileName}`;

            referencedFiles.add(targetFileName);

            // Zaten hedef isme sahipse
            if (currentFileName === targetFileName) {
                newPhotosList.push(currentItem);
                continue;
            }

            const oldDiskPath = path.join(uploadsDir, currentFileName);
            const targetDiskPath = path.join(uploadsDir, targetFileName);

            if (fs.existsSync(oldDiskPath)) {
                // Eğer hedef isimde eski bir dosya varsa kaldır
                if (fs.existsSync(targetDiskPath) && oldDiskPath !== targetDiskPath) {
                    try { fs.unlinkSync(targetDiskPath); } catch (e) {}
                }
                try {
                    fs.renameSync(oldDiskPath, targetDiskPath);
                    totalRenamed++;
                    console.log(`  🔄 [${gig.VenueName || 'Mekan'} - ${gig.GigDate}]:`);
                    console.log(`     ${currentFileName} ➔ ${targetFileName}`);
                } catch (err) {
                    console.error(`     ❌ Yeniden adlandırma hatası: ${currentFileName}`, err.message);
                }
            } else if (fs.existsSync(targetDiskPath)) {
                console.log(`  ℹ️  ${targetFileName} diskte zaten var, veritabanı yolu eşitleniyor.`);
            }

            newPhotosList.push(targetPath);
            gigChanged = true;
        }

        if (gigChanged) {
            updateGig.run(JSON.stringify(newPhotosList), gig.GigID);
            totalUpdatedGigs++;
        }
    }
});

migrationTransaction();

console.log(`\n✅ ${totalUpdatedGigs} sahne kaydının fotoğrafları veritabanında güncellendi.`);
console.log(`✅ ${totalRenamed} adet sahne fotoğrafı diskte yeni standart isme dönüştürüldü.`);

// uploads klasöründeki artık/sahipsiz gig fotoğraflarını tara (eski timestamp damgalı olanlar)
console.log('\n🧹 uploads klasöründeki eski damgalı sahipsiz sahne fotoğrafları taranıyor...');
let cleanedOrphanCount = 0;

if (fs.existsSync(uploadsDir)) {
    const allFiles = fs.readdirSync(uploadsDir);
    for (const file of allFiles) {
        // gig_0_178... veya gig_178... veya gig_photo_178... gibi eski desenler
        const isOldGigFormat = /^gig_(\d+_)?[0-9]{10,}_[0-9]+\.(jpg|jpeg|png|webp)$/i.test(file) ||
                               /^gig_photo_[0-9]{10,}_[0-9]+\.(jpg|jpeg|png|webp)$/i.test(file);

        if (isOldGigFormat && !referencedFiles.has(file)) {
            const filePath = path.join(uploadsDir, file);
            try {
                fs.unlinkSync(filePath);
                cleanedOrphanCount++;
                console.log(`  🗑️  Artık sahne fotoğrafı silindi: ${file}`);
            } catch (e) {}
        }
    }
}

if (cleanedOrphanCount > 0) {
    console.log(`✅ ${cleanedOrphanCount} adet sahipsiz eski sahne fotoğrafı temizlendi.`);
} else {
    console.log(`✅ Temizlenecek sahipsiz eski dosya bulunamadı.`);
}

console.log('\n========================================');
console.log('🎉 SAHNE (GIG) FOTOĞRAFLARI STANDARTLAŞTIRILDI!');
console.log('========================================');
console.log(`📁 İsim formatı: gig_YYYYAAGG_Gun_MEKAN_XX.jpg`);
console.log(`🔄 Yeniden adlandırılan dosya : ${totalRenamed} adet`);
console.log(`🎤 Güncellenen sahne kaydı    : ${totalUpdatedGigs} adet`);
console.log(`🧹 Temizlenen artık dosya     : ${cleanedOrphanCount} adet`);
console.log('========================================\n');
