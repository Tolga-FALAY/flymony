/**
 * standardize_guest_avatars.js
 * 
 * uploads/ klasöründeki tüm misafir profil fotoğraflarını standart isimlendirme formatına dönüştürür:
 *   Format: guest_avatar_ad_soyad_GuestID.uzanti
 *   Örnek : guest_avatar_tolga_falay_1780317443197.jpg
 * 
 * Kural Detayları:
 *   1) "guest_avatar" + "_" + "ad" + "_" + "soyad" + "_" + "id"
 *   2) Parantez veya harf/rakam dışındaki karakterler temizlenir (örn: (dtss) -> dtss)
 *   3) Soyadı sadece nokta veya boşsa soyadı alanı atlanır (örn: guest_avatar_safiye_nur_1780347320842.jpg)
 *   4) Kişi ID bilgisi daima uzantıdan önce eklenir
 *   5) İsim veya soyisim değiştiğinde dosya adı uploads klasöründe senkronize olur
 * 
 * Veritabanındaki (Guests.ProfilePicture) kayıtlarını yeni dosya isimleriyle günceller.
 * Varsa eski/artık yinelenen ve sahipsiz avatar dosyalarını temizler.
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
const backupPath = path.join(__dirname, `song_requests.db.bak_avatars_${timestamp}`);
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

function generateGuestAvatarBaseName(firstName, lastName, guestId) {
    const cleanFirst = cleanNamePart(firstName);
    const cleanLast = cleanNamePart(lastName);
    
    const parts = ['guest_avatar'];
    if (cleanFirst) parts.push(cleanFirst);
    if (cleanLast) parts.push(cleanLast);
    if (guestId) parts.push(String(guestId));
    
    return parts.join('_');
}

console.log('\n⏳ Misafir profil fotoğrafları taranıyor ve standartlaştırılıyor...');

const guests = db.prepare(`
    SELECT GuestID, FirstName, LastName, ProfilePicture 
    FROM Guests 
    WHERE ProfilePicture IS NOT NULL AND ProfilePicture != ''
`).all();

const updateGuest = db.prepare('UPDATE Guests SET ProfilePicture = ? WHERE GuestID = ?');

let totalRenamed = 0;
let totalUpdatedGuests = 0;
const referencedFiles = new Set();

const migrationTransaction = db.transaction(() => {
    for (const g of guests) {
        const pic = g.ProfilePicture;
        if (!pic || typeof pic !== 'string' || !pic.trim()) continue;

        const targetBase = generateGuestAvatarBaseName(g.FirstName, g.LastName, g.GuestID);

        // Eğer fotoğraf base64 formatındaysa dosyaya yaz
        if (pic.startsWith('data:image/')) {
            const parts = pic.split(',');
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
            updateGuest.run(targetPath, g.GuestID);
            referencedFiles.add(targetFileName);
            totalRenamed++;
            totalUpdatedGuests++;
            console.log(`  💾 Base64 Profil Fotoğrafı Kaydedildi: ${targetFileName}`);
            continue;
        }

        if (!pic.startsWith('/uploads/')) continue;

        const currentFileName = path.basename(pic);
        const ext = path.extname(currentFileName).toLowerCase() || '.jpg';
        const targetFileName = `${targetBase}${ext}`;
        const targetPath = `/uploads/${targetFileName}`;

        referencedFiles.add(targetFileName);

        if (currentFileName === targetFileName) {
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

        updateGuest.run(targetPath, g.GuestID);
        totalUpdatedGuests++;
    }
});

migrationTransaction();

console.log(`\n✅ ${totalUpdatedGuests} misafirin profil fotoğrafı veritabanında güncellendi.`);
console.log(`✅ ${totalRenamed} adet profil fotoğrafı diskte yeni standart isme dönüştürüldü.`);

// uploads klasöründeki artık/sahipsiz avatar fotoğraflarını tara (eski timestamp damgalı olanlar)
console.log('\n🧹 uploads klasöründeki eski damgalı sahipsiz profil fotoğrafları taranıyor...');
let cleanedOrphanCount = 0;

if (fs.existsSync(uploadsDir)) {
    const allFiles = fs.readdirSync(uploadsDir);
    for (const file of allFiles) {
        // guest_avatar_178..._179... gibi eski desenler
        const isOldAvatarFormat = /^guest_avatar_\d{10,}_\d{10,}_[0-9]+\.(jpg|jpeg|png|webp)$/i.test(file);

        if (isOldAvatarFormat && !referencedFiles.has(file)) {
            const filePath = path.join(uploadsDir, file);
            try {
                fs.unlinkSync(filePath);
                cleanedOrphanCount++;
                console.log(`  🗑️  Artık profil fotoğrafı silindi: ${file}`);
            } catch (e) {}
        }
    }
}

if (cleanedOrphanCount > 0) {
    console.log(`✅ ${cleanedOrphanCount} adet sahipsiz eski profil fotoğrafı temizlendi.`);
} else {
    console.log(`✅ Temizlenecek sahipsiz eski dosya bulunamadı.`);
}

console.log('\n========================================');
console.log('🎉 PROFİL (AVATAR) FOTOĞRAFLARI STANDARTLAŞTIRILDI!');
console.log('========================================');
console.log(`📁 İsim formatı: guest_avatar_ad_soyad_GuestID.jpg`);
console.log(`🔄 Yeniden adlandırılan dosya : ${totalRenamed} adet`);
console.log(`👤 Güncellenen misafir kaydı  : ${totalUpdatedGuests} adet`);
console.log(`🧹 Temizlenen artık dosya     : ${cleanedOrphanCount} adet`);
console.log('========================================\n');
