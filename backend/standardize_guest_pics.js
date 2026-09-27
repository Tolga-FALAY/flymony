/**
 * standardize_guest_pics.js
 * 
 * uploads/ klasöründeki tüm misafir albüm fotoğraflarını (misafirle çekilen fotoğraflar)
 * standart isimlendirme formatına dönüştürür:
 *   Format: guest_pics_ad_soyad_GuestID_XX.uzanti
 *   Örnek : guest_pics_tolga_falay_1780317443197_01.jpg
 * 
 * Kural Detayları:
 *   1) "guest_pics" + "_" + "ad" + "_" + "soyad" + "_" + "GuestID" + "_" + "iki haneli FotoNo" + "uzanti"
 *   2) Ad veya soyaddaki parantez veya özel karakterler temizlenir (örn: (dtss) -> dtss)
 *   3) Soyadı sadece nokta veya boşsa soyadı alanı atlanır (örn: guest_pics_safiye_nur_1780347320842_01.jpg)
 *   4) İsim veya soyisim değiştiğinde dosya adı uploads klasöründe senkronize olur
 * 
 * Veritabanındaki (Guests.Photos) kayıtlarını yeni dosya isimleriyle günceller.
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
const backupPath = path.join(__dirname, `song_requests.db.bak_guestpics_${timestamp}`);
fs.copyFileSync(dbPath, backupPath);
console.log(`🛡️  Veritabanı güvenli yedeği alındı: ${path.basename(backupPath)}`);

const db = new Database(dbPath);

function cleanNamePart(text) {
    if (!text || typeof text !== 'string') return '';
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

function generateGuestPicBaseName(firstName, lastName, guestId, photoIndex = 0) {
    const cleanFirst = cleanNamePart(firstName);
    const cleanLast = cleanNamePart(lastName);
    
    const parts = ['guest_pics'];
    if (cleanFirst) parts.push(cleanFirst);
    if (cleanLast) parts.push(cleanLast);
    if (guestId) parts.push(String(guestId));
    
    const numStr = String(photoIndex + 1).padStart(2, '0');
    parts.push(numStr);
    
    return parts.join('_');
}

console.log('\n⏳ Misafir albüm fotoğrafları taranıyor ve standartlaştırılıyor...');

const guests = db.prepare(`
    SELECT GuestID, FirstName, LastName, Photos 
    FROM Guests 
    WHERE Photos IS NOT NULL AND Photos != '' AND Photos != '[]'
`).all();

const updateGuest = db.prepare('UPDATE Guests SET Photos = ? WHERE GuestID = ?');

let totalRenamed = 0;
let totalUpdatedGuests = 0;
const referencedFiles = new Set();

const migrationTransaction = db.transaction(() => {
    for (const g of guests) {
        let photosList = [];
        try {
            photosList = typeof g.Photos === 'string' ? JSON.parse(g.Photos) : g.Photos;
        } catch (e) {
            if (typeof g.Photos === 'string' && g.Photos.trim()) {
                photosList = [g.Photos.trim()];
            }
        }

        if (!Array.isArray(photosList) || photosList.length === 0) continue;

        let guestChanged = false;
        const newPhotosList = [];

        for (let i = 0; i < photosList.length; i++) {
            const currentItem = photosList[i];
            if (!currentItem || typeof currentItem !== 'string') continue;

            const targetBase = generateGuestPicBaseName(g.FirstName, g.LastName, g.GuestID, i);

            // Eğer fotoğraf base64 formatındaysa dosyaya kaydet
            if (currentItem.startsWith('data:image/')) {
                const parts = currentItem.split(',');
                const meta = parts[0] || '';
                const base64Data = parts[1] || '';
                let ext = 'jpg';
                if (meta.includes('png')) ext = 'png';
                else if (meta.includes('webp')) ext = 'webp';

                const targetFileName = `${targetBase}.${ext}`;
                const targetDiskPath = path.join(uploadsDir, targetFileName);

                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir, { recursive: true });
                }

                fs.writeFileSync(targetDiskPath, Buffer.from(base64Data, 'base64'));
                const targetPath = `/uploads/${targetFileName}`;
                newPhotosList.push(targetPath);
                referencedFiles.add(targetFileName);
                guestChanged = true;
                totalRenamed++;
                console.log(`  💾 Base64 Fotoğraf Kaydedildi: ${targetFileName}`);
                continue;
            }

            if (!currentItem.startsWith('/uploads/')) {
                newPhotosList.push(currentItem);
                continue;
            }

            const currentFileName = path.basename(currentItem);
            const ext = path.extname(currentFileName).toLowerCase() || '.jpg';
            const targetFileName = `${targetBase}${ext}`;
            const targetPath = `/uploads/${targetFileName}`;

            referencedFiles.add(targetFileName);

            if (currentFileName === targetFileName) {
                newPhotosList.push(currentItem);
                continue;
            }

            const oldDiskPath = path.join(uploadsDir, currentFileName);
            const targetDiskPath = path.join(uploadsDir, targetFileName);

            if (fs.existsSync(oldDiskPath)) {
                if (fs.existsSync(targetDiskPath) && oldDiskPath !== targetDiskPath) {
                    try { fs.unlinkSync(targetDiskPath); } catch (e) {}
                }
                try {
                    fs.renameSync(oldDiskPath, targetDiskPath);
                    totalRenamed++;
                    console.log(`  🔄 [${g.FirstName} ${g.LastName}]:`);
                    console.log(`     ${currentFileName} ➔ ${targetFileName}`);
                } catch (err) {
                    console.error(`     ❌ Yeniden adlandırma hatası: ${currentFileName}`, err.message);
                }
            } else if (fs.existsSync(targetDiskPath)) {
                console.log(`  ℹ️  ${targetFileName} zaten mevcut, veritabanı yolu eşitleniyor.`);
            }

            newPhotosList.push(targetPath);
            guestChanged = true;
        }

        if (guestChanged) {
            updateGuest.run(JSON.stringify(newPhotosList), g.GuestID);
            totalUpdatedGuests++;
        }
    }
});

migrationTransaction();

console.log(`\n✅ ${totalUpdatedGuests} misafirin albüm fotoğrafları veritabanında güncellendi.`);
console.log(`✅ ${totalRenamed} adet albüm fotoğrafı diskte yeni standart isme dönüştürüldü.`);

// uploads klasöründeki artık/sahipsiz guest_ fotoğraflarını tara (eski timestamp damgalı olanlar, avatar hariç)
console.log('\n🧹 uploads klasöründeki eski damgalı sahipsiz misafir albüm fotoğrafları taranıyor...');
let cleanedOrphanCount = 0;

if (fs.existsSync(uploadsDir)) {
    const allFiles = fs.readdirSync(uploadsDir);
    for (const file of allFiles) {
        // guest_178..._0_179... gibi eski desenler (guest_avatar ile başlayanları atla)
        if (file.startsWith('guest_avatar') || file.startsWith('guest_pics')) continue;

        const isOldGuestPicFormat = /^guest_\d+(_\d+)?_\d+_\d+\.(jpg|jpeg|png|webp)$/i.test(file);

        if (isOldGuestPicFormat && !referencedFiles.has(file)) {
            const filePath = path.join(uploadsDir, file);
            try {
                fs.unlinkSync(filePath);
                cleanedOrphanCount++;
                console.log(`  🗑️  Artık misafir fotoğrafı silindi: ${file}`);
            } catch (e) {}
        }
    }
}

if (cleanedOrphanCount > 0) {
    console.log(`✅ ${cleanedOrphanCount} adet sahipsiz eski misafir fotoğrafı temizlendi.`);
} else {
    console.log(`✅ Temizlenecek sahipsiz eski dosya bulunamadı.`);
}

console.log('\n========================================');
console.log('🎉 MİSAFİR ALBÜM FOTOĞRAFLARI (PICS) STANDARTLAŞTIRILDI!');
console.log('========================================');
console.log(`📁 İsim formatı: guest_pics_ad_soyad_GuestID_XX.jpg`);
console.log(`🔄 Yeniden adlandırılan dosya : ${totalRenamed} adet`);
console.log(`👤 Güncellenen misafir kaydı  : ${totalUpdatedGuests} adet`);
console.log(`🧹 Temizlenen artık dosya     : ${cleanedOrphanCount} adet`);
console.log('========================================\n');
