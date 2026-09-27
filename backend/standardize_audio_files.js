/**
 * standardize_audio_files.js
 * 
 * uploads/ klasöründeki tüm ses kayıt dosyalarını standart isimlendirme formatına dönüştürür:
 *   Format: audio_sanatci_adi_sarki_adi.uzanti
 *   Örnek : audio_riza_tamer_yan.mp3
 * 
 * Kural Detayları:
 *   1) "audio" + "_" + "sanatçı adı" + "_" + "şarkı adı" + "." + "dosya uzantısı"
 *   2) Şarkı adı veya sanatçı adı değiştiğinde dosya adı uploads klasöründe otomatik rename olur
 * 
 * Veritabanındaki (Songs.AudioPath) kayıtlarını yeni dosya isimleriyle günceller.
 * Varsa eski/artık yinelenen ve sahipsiz ses kayıt dosyalarını temizler.
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
const backupPath = path.join(__dirname, `song_requests.db.bak_audio_${timestamp}`);
fs.copyFileSync(dbPath, backupPath);
console.log(`🛡️  Veritabanı güvenli yedeği alındı: ${path.basename(backupPath)}`);

const db = new Database(dbPath);

function slugify(text) {
    if (!text || typeof text !== 'string') return 'bilinmeyen';
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
        .replace(/^_|_$/g, '') || 'bilinmeyen';
}

function generateAudioBaseName(artistName, songTitle) {
    const aSlug = slugify(artistName || 'bilinmeyen');
    const sSlug = slugify(songTitle || 'isimsiz');
    return `audio_${aSlug}_${sSlug}`;
}

console.log('\n⏳ Şarkı ses kayıtları (AudioPath) taranıyor ve standartlaştırılıyor...');

const songs = db.prepare(`
    SELECT s.SongID, s.SongTitle, s.AudioPath,
           (
               SELECT a.ArtistName 
               FROM Song_Artists sa 
               JOIN Artists a ON sa.ArtistID = a.ArtistID 
               WHERE sa.SongID = s.SongID 
               LIMIT 1
           ) as ArtistName
    FROM Songs s
    WHERE s.AudioPath IS NOT NULL AND s.AudioPath != ''
`).all();

const updateSongAudio = db.prepare('UPDATE Songs SET AudioPath = ? WHERE SongID = ?');

let totalRenamed = 0;
let totalUpdatedSongs = 0;
const referencedFiles = new Set();

const migrationTransaction = db.transaction(() => {
    for (const song of songs) {
        const audioPath = song.AudioPath;
        if (!audioPath || typeof audioPath !== 'string' || !audioPath.trim()) continue;

        const targetBase = generateAudioBaseName(song.ArtistName, song.SongTitle);

        // Eğer ses base64 olarak kalmışsa dosyaya kaydet
        if (audioPath.startsWith('data:audio/') || audioPath.startsWith('data:video/')) {
            const parts = audioPath.split(';base64,');
            const meta = parts[0] || '';
            const base64Data = parts[1] || '';
            let ext = 'mp3';
            if (meta.includes('wav')) ext = 'wav';
            else if (meta.includes('m4a')) ext = 'm4a';
            else if (meta.includes('ogg')) ext = 'ogg';
            else if (meta.includes('webm')) ext = 'webm';
            else if (meta.includes('aac')) ext = 'aac';

            const targetFileName = `${targetBase}.${ext}`;
            const targetDiskPath = path.join(uploadsDir, targetFileName);

            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            fs.writeFileSync(targetDiskPath, Buffer.from(base64Data, 'base64'));
            const targetPath = `/uploads/${targetFileName}`;
            updateSongAudio.run(targetPath, song.SongID);
            referencedFiles.add(targetFileName);
            totalRenamed++;
            totalUpdatedSongs++;
            console.log(`  💾 Base64 Ses Dosyası Kaydedildi: ${targetFileName}`);
            continue;
        }

        if (!audioPath.startsWith('/uploads/')) continue;

        const currentFileName = path.basename(audioPath);
        const ext = path.extname(currentFileName).toLowerCase() || '.mp3';
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
                console.log(`  🔄 [${song.ArtistName || 'Sanatçı'} - ${song.SongTitle}]:`);
                console.log(`     ${currentFileName} ➔ ${targetFileName}`);
            } catch (err) {
                console.error(`     ❌ Yeniden adlandırma hatası: ${currentFileName}`, err.message);
            }
        } else if (fs.existsSync(targetDiskPath)) {
            console.log(`  ℹ️  ${targetFileName} zaten mevcut, veritabanı yolu eşitleniyor.`);
        }

        updateSongAudio.run(targetPath, song.SongID);
        totalUpdatedSongs++;
    }
});

migrationTransaction();

console.log(`\n✅ ${totalUpdatedSongs} şarkının ses kaydı veritabanında güncellendi.`);
console.log(`✅ ${totalRenamed} adet ses dosyası diskte yeni standart isme dönüştürüldü.`);

// uploads klasöründeki artık/sahipsiz audio_ dosyalarını tara (eski timestamp damgalı olanlar)
console.log('\n🧹 uploads klasöründeki eski damgalı sahipsiz ses dosyaları taranıyor...');
let cleanedOrphanCount = 0;

if (fs.existsSync(uploadsDir)) {
    const allFiles = fs.readdirSync(uploadsDir);
    for (const file of allFiles) {
        // audio_\d+_\d+... gibi eski desenler
        const isOldAudioFormat = /^audio_\d{10,}_\d+\.(mp3|m4a|wav|ogg|webm|aac)$/i.test(file);

        if (isOldAudioFormat && !referencedFiles.has(file)) {
            const filePath = path.join(uploadsDir, file);
            try {
                fs.unlinkSync(filePath);
                cleanedOrphanCount++;
                console.log(`  🗑️  Artık ses dosyası silindi: ${file}`);
            } catch (e) {}
        }
    }
}

if (cleanedOrphanCount > 0) {
    console.log(`✅ ${cleanedOrphanCount} adet sahipsiz eski ses dosyası temizlendi.`);
} else {
    console.log(`✅ Temizlenecek sahipsiz eski dosya bulunamadı.`);
}

console.log('\n========================================');
console.log('🎉 SES KAYITLARI (AUDIO) STANDARTLAŞTIRILDI!');
console.log('========================================');
console.log(`📁 İsim formatı: audio_sanatci_adi_sarki_adi.uzanti`);
console.log(`🔄 Yeniden adlandırılan dosya : ${totalRenamed} adet`);
console.log(`🎵 Güncellenen şarkı kaydı    : ${totalUpdatedSongs} adet`);
console.log(`🧹 Temizlenen artık dosya     : ${cleanedOrphanCount} adet`);
console.log('========================================\n');
