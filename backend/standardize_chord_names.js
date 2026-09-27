/**
 * standardize_chord_names.js
 * 
 * uploads/ klasöründeki tüm milisaniye damgalı (chord_178... gibi) akor dosyalarını
 * standart isimlendirme formatına dönüştürür:
 *   - Tek sayfa: chord_fly_sanatci_adi_sarki_adi.jpg
 *   - Çok sayfa: chord_fly_sanatci_adi_sarki_adi_1of2.jpg, ..._2of2.jpg
 * 
 * Veritabanındaki (Songs.ChordImagePath) kayıtlarını yeni dosya isimleriyle günceller.
 * Varsa eski/artık yinelenen dosyaları temizler.
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
const backupPath = path.join(__dirname, `song_requests.db.bak_chords_${timestamp}`);
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

function parseChordImages(chordVal) {
    if (!chordVal) return [];
    if (Array.isArray(chordVal)) return chordVal.filter(Boolean);
    if (typeof chordVal === 'string') {
        const trimmed = chordVal.trim();
        if (trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.filter(Boolean);
            } catch (e) {}
        }
        if (trimmed) return [trimmed];
    }
    return [];
}

function generateChordBaseName(artistName, songTitle, index = 0, total = 1) {
    const aSlug = slugify(artistName || 'bilinmeyen');
    const sSlug = slugify(songTitle || 'isimsiz');
    if (total > 1) {
        return `chord_fly_${aSlug}_${sSlug}_${index + 1}of${total}`;
    }
    return `chord_fly_${aSlug}_${sSlug}`;
}

console.log('\n⏳ Şarkılar taranıyor ve akor isimleri standartlaştırılıyor...');

const songs = db.prepare(`
    SELECT s.SongID, s.SongTitle, s.ChordImagePath,
           (
               SELECT a.ArtistName 
               FROM Song_Artists sa 
               JOIN Artists a ON sa.ArtistID = a.ArtistID 
               WHERE sa.SongID = s.SongID 
               LIMIT 1
           ) as ArtistName
    FROM Songs s
    WHERE s.ChordImagePath IS NOT NULL AND s.ChordImagePath != '' AND s.ChordImagePath != '[]'
`).all();

const updateSongChord = db.prepare('UPDATE Songs SET ChordImagePath = ? WHERE SongID = ?');

let totalRenamed = 0;
let totalUpdatedSongs = 0;
const referencedFiles = new Set();

const migrationTransaction = db.transaction(() => {
    for (const song of songs) {
        const chordList = parseChordImages(song.ChordImagePath);
        if (!chordList || chordList.length === 0) continue;

        let songChanged = false;
        const newChordList = [];
        const totalPages = chordList.length;

        for (let i = 0; i < totalPages; i++) {
            const currentPath = chordList[i];
            if (!currentPath || typeof currentPath !== 'string') continue;

            const ext = path.extname(currentPath).toLowerCase() || '.jpg';
            const baseName = path.basename(currentPath);
            const targetBase = generateChordBaseName(song.ArtistName, song.SongTitle, i, totalPages);
            const targetFileName = `${targetBase}${ext}`;
            const targetPath = `/uploads/${targetFileName}`;

            referencedFiles.add(targetFileName);

            // Eğer dosya ismi zaten hedef formatta ise
            if (baseName === targetFileName) {
                newChordList.push(currentPath);
                continue;
            }

            // Dosya ismi timestamp damgalı veya standart dışı ise
            const oldFilePath = path.join(uploadsDir, baseName);
            const targetFilePath = path.join(uploadsDir, targetFileName);

            if (fs.existsSync(oldFilePath)) {
                // Eğer hedef isimde eski bir dosya zaten varsa (örn. eski seed dosyası)
                if (fs.existsSync(targetFilePath) && oldFilePath !== targetFilePath) {
                    try {
                        fs.unlinkSync(targetFilePath); // Eski kopyayı sil
                    } catch (e) {}
                }
                try {
                    fs.renameSync(oldFilePath, targetFilePath);
                    totalRenamed++;
                    console.log(`  🔄 [${song.ArtistName || 'Sanatçı'} - ${song.SongTitle}]:`);
                    console.log(`     ${baseName} ➔ ${targetFileName}`);
                } catch (err) {
                    console.error(`     ❌ Yeniden adlandırma hatası: ${baseName}`, err.message);
                }
            } else if (fs.existsSync(targetFilePath)) {
                // Eski dosya yok ama hedef dosya zaten mevcut
                console.log(`  ℹ️  ${targetFileName} zaten mevcut, veritabanı yolu eşitleniyor.`);
            }

            newChordList.push(targetPath);
            songChanged = true;
        }

        if (songChanged) {
            updateSongChord.run(JSON.stringify(newChordList), song.SongID);
            totalUpdatedSongs++;
        }
    }
});

migrationTransaction();

console.log(`\n✅ ${totalUpdatedSongs} şarkının akor yolu veritabanında güncellendi.`);
console.log(`✅ ${totalRenamed} adet dosya diskte yeni standart isme dönüştürüldü.`);

// Artık kalan sahipsiz chord_178... dosyalarını temizle
console.log('\n🧹 uploads klasöründeki sahipsiz milisaniyeli akor dosyaları taranıyor...');
let cleanedOrphanCount = 0;

if (fs.existsSync(uploadsDir)) {
    const allUploadFiles = fs.readdirSync(uploadsDir);
    for (const file of allUploadFiles) {
        // Sadece chord_178... gibi milisaniyeli olanlar
        if (/^chord_\d{10,}_\d+\.(jpg|jpeg|png|webp)$/i.test(file)) {
            const filePath = path.join(uploadsDir, file);
            try {
                fs.unlinkSync(filePath);
                cleanedOrphanCount++;
                console.log(`  🗑️  Artık dosya silindi: ${file}`);
            } catch (e) {}
        }
    }
}

if (cleanedOrphanCount > 0) {
    console.log(`✅ ${cleanedOrphanCount} adet sahipsiz/yinelenen eski akor dosyası temizlendi.`);
} else {
    console.log(`✅ Temizlenecek sahipsiz milisaniyeli dosya bulunamadı.`);
}

console.log('\n========================================');
console.log('🎉 AKOR İSİMLERİ STANDARTLAŞTIRILDI!');
console.log('========================================');
console.log(`📁 İsim formatı: chord_fly_sanatci_sarki[_1of2].jpg`);
console.log(`🔄 Yeniden adlandırılan dosya : ${totalRenamed} adet`);
console.log(`🎵 Güncellenen şarkı kaydı    : ${totalUpdatedSongs} adet`);
console.log(`🧹 Temizlenen artık dosya     : ${cleanedOrphanCount} adet`);
console.log('========================================\n');
