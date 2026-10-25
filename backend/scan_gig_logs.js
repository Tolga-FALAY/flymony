import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'song_requests.db');
if (!fs.existsSync(dbPath)) {
    console.error(`❌ Veritabanı bulunamadı: ${dbPath}`);
    process.exit(1);
}

const db = new Database(dbPath, { readonly: false });

// 1. 23 Ekim Sahnesini Bul
const gig = db.prepare(`
    SELECT g.GigID, g.VenueID, g.GigDate, v.VenueName 
    FROM Gigs g 
    LEFT JOIN Venues v ON g.VenueID = v.VenueID 
    WHERE g.GigDate LIKE '%10-23%' OR g.GigDate LIKE '2026-10-23%'
    ORDER BY g.GigID DESC LIMIT 1
`).get();

if (!gig) {
    console.log("❌ 23 Ekim tarihli sahne kaydı bulunamadı! Mevcut son 5 sahne:");
    const lastGigs = db.prepare("SELECT GigID, GigDate, VenueID FROM Gigs ORDER BY GigDate DESC LIMIT 5").all();
    console.table(lastGigs);
    process.exit(1);
}

console.log(`\n===============================================================`);
console.log(`🎯 23 EKİM SAHNESİ TESPİT EDİLDİ:`);
console.log(`   GigID: ${gig.GigID} | Mekan: ${gig.VenueName || ('ID: ' + gig.VenueID)} | Tarih: ${gig.GigDate}`);
console.log(`===============================================================\n`);

// Canlı DB'deki mevcut şarkıları al
const currentSongs = db.prepare(`
    SELECT gs.GigSongID, gs.SongID, gs.SortOrder, gs.IsPlayed, gs.IsRequest, s.SongTitle,
           (SELECT GROUP_CONCAT(a.ArtistName, ', ') FROM Song_Artists sa JOIN Artists a ON sa.ArtistID = a.ArtistID WHERE sa.SongID = s.SongID) as ArtistNames
    FROM Gig_Songs gs
    JOIN Songs s ON gs.SongID = s.SongID
    WHERE gs.GigID = ?
    ORDER BY gs.SortOrder ASC
`).all(gig.GigID);

console.log(`📊 Şu an canlı veritabanında bu sahnede kayıtlı şarkı sayısı: ${currentSongs.length}`);
console.log(`   - Çalındı görünen: ${currentSongs.filter(s => s.IsPlayed === 1).length}`);
console.log(`   - İstek görünen:   ${currentSongs.filter(s => s.IsRequest === 1).length}\n`);

// 2. PM2 Log Dosyalarını Belirle
const possiblePm2Dirs = [
    '/root/.pm2/logs',
    path.join(process.env.HOME || '/root', '.pm2/logs'),
    '/var/log/pm2'
];

let logFiles = [];
for (const pDir of possiblePm2Dirs) {
    if (fs.existsSync(pDir)) {
        const files = fs.readdirSync(pDir)
            .filter(f => f.includes('flymony') && (f.includes('out') || f.includes('err')))
            .map(f => path.join(pDir, f));
        logFiles.push(...files);
    }
}
logFiles = [...new Set(logFiles)];

console.log(`🔍 PM2 Log Dosyaları taranıyor (${logFiles.length} dosya bulundu)...`);

const playedSongIds = new Set();
const requestSongMap = new Map(); // SongID -> { sortOrder, isPlayed }
let totalMatches = 0;
let deleteEvents = 0;

async function scanFile(filePath) {
    return new Promise((resolve) => {
        if (!fs.existsSync(filePath)) return resolve();
        const stat = fs.statSync(filePath);
        console.log(`   📄 Taranıyor: ${filePath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

        const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let pendingSql = '';
        let lineCounter = 0;

        rl.on('line', (line) => {
            lineCounter++;

            // DELETE olaylarını da sayalım (kaç kez güncelleme yapılmış)
            if (line.includes('DELETE FROM Gig_Songs') && (line.includes(String(gig.GigID)) || line.includes(`${gig.GigID}.0`))) {
                deleteEvents++;
            }

            // INSERT INTO Gig_Songs başlangıcı
            if (line.includes('INSERT INTO Gig_Songs')) {
                pendingSql = line;
            } else if (pendingSql) {
                pendingSql += ' ' + line;
            }

            // Eğer biriken SQL içinde VALUES (...) tamamlandıysa çözümle
            if (pendingSql && pendingSql.includes('VALUES') && pendingSql.includes(')')) {
                const m = /INSERT INTO Gig_Songs[\s\S]*?VALUES\s*\(([^)]+)\)/i.exec(pendingSql);
                if (m) {
                    const cleanParts = m[1].replace(/['"`]/g, '').split(',').map(s => Number(s.trim()));
                    const rowGigId = cleanParts[0];
                    const songId = cleanParts[1];
                    const sortOrder = cleanParts[2];
                    const isPlayed = cleanParts[3];
                    const isRequest = cleanParts[4];

                    if (rowGigId === gig.GigID) {
                        totalMatches++;
                        if (isPlayed === 1) {
                            playedSongIds.add(songId);
                        }
                        if (isRequest === 1) {
                            requestSongMap.set(songId, { sortOrder, isPlayed: isPlayed === 1 });
                        }
                    }
                }
                pendingSql = '';
            } else if (pendingSql && pendingSql.length > 500) {
                // Çok uzadıysa ve VALUES bulunamadıysa sıfırla
                pendingSql = '';
            }
        });

        rl.on('close', () => {
            resolve();
        });

        rl.on('error', (err) => {
            console.warn(`   ⚠️ ${filePath} okuma hatası:`, err.message);
            resolve();
        });
    });
}

async function main() {
    for (const file of logFiles) {
        await scanFile(file);
    }

    console.log(`\n===============================================================`);
    console.log(`📋 PM2 LOGLARINDAN ÇIKARILAN 23 EKİM HAREKETLERİ:`);
    console.log(`   - İlgili sahneye ait INSERT satırı: ${totalMatches}`);
    console.log(`   - Sahneye yapılan toplu güncelleme (DELETE) sayısı: ${deleteEvents}`);
    console.log(`   - Çalındığı tespit edilen şarkı sayısı: ${playedSongIds.size}`);
    console.log(`   - İstek olarak eklenen şarkı sayısı: ${requestSongMap.size}`);
    console.log(`===============================================================\n`);

    if (playedSongIds.size > 0 || requestSongMap.size > 0) {
        console.log("🎵 ÇALINAN VE İSTEK ŞARKILAR LİSTESİ:\n");
        let count = 1;

        for (const songId of playedSongIds) {
            const s = db.prepare(`
                SELECT s.SongID, s.SongTitle,
                       (SELECT GROUP_CONCAT(a.ArtistName, ', ') FROM Song_Artists sa JOIN Artists a ON sa.ArtistID = a.ArtistID WHERE sa.SongID = s.SongID) as ArtistNames
                FROM Songs s WHERE s.SongID = ?
            `).get(songId);
            
            const isReq = requestSongMap.has(songId);
            const title = s ? s.SongTitle : `SongID: ${songId}`;
            const artist = s ? (s.ArtistNames || '-') : '-';
            console.log(`${count++}. [${isReq ? 'İSTEK + ÇALINDI' : '✓ ÇALINDI'}] ${title} - ${artist}`);
        }

        for (const [songId, info] of requestSongMap.entries()) {
            if (!playedSongIds.has(songId)) {
                const s = db.prepare(`
                    SELECT s.SongID, s.SongTitle,
                           (SELECT GROUP_CONCAT(a.ArtistName, ', ') FROM Song_Artists sa JOIN Artists a ON sa.ArtistID = a.ArtistID WHERE sa.SongID = s.SongID) as ArtistNames
                FROM Songs s WHERE s.SongID = ?
                `).get(songId);
                const title = s ? s.SongTitle : `SongID: ${songId}`;
                const artist = s ? (s.ArtistNames || '-') : '-';
                console.log(`${count++}. [SADECE İSTEK (Çalınmadı)] ${title} - ${artist}`);
            }
        }

        // Uygulama parametresi: --apply
        const isApply = process.argv.includes('--apply');
        if (!isApply) {
            console.log(`\n---------------------------------------------------------------`);
            console.log(`💡 BİLGİ: Bu sadece bir ÖNİZLEMEDİR. Veritabanına hiçbir şey yazılmadı.`);
            console.log(`   Eğer bu listeyi 23 Ekim sahnesine cerrahi olarak işletmek isterseniz:`);
            console.log(`   👉  node scan_gig_logs.js --apply`);
            console.log(`   komutunu çalıştırmanız yeterlidir.`);
            console.log(`---------------------------------------------------------------\n`);
        } else {
            console.log(`\n⚡ UYGULANIYOR: Çalındı ve İstek durumları 23 Ekim sahnesine işleniyor...`);
            
            const backupTarget = path.join(__dirname, `song_requests_before_apply_${Date.now()}.db`);
            fs.copyFileSync(dbPath, backupTarget);
            console.log(`   🛡️ Otomatik güvenlik yedeği alındı: ${path.basename(backupTarget)}`);

            const updateTx = db.transaction(() => {
                // 1. Çalınanları güncelle
                const updateStmt = db.prepare(`
                    UPDATE Gig_Songs 
                    SET IsPlayed = 1 
                    WHERE GigID = ? AND SongID = ?
                `);
                for (const songId of playedSongIds) {
                    updateStmt.run(gig.GigID, songId);
                }

                // 2. İstekleri güncelle veya eksikse ekle
                const checkExistStmt = db.prepare(`
                    SELECT COUNT(*) as c FROM Gig_Songs WHERE GigID = ? AND SongID = ?
                `);
                const maxOrderStmt = db.prepare(`
                    SELECT MAX(SortOrder) as maxO FROM Gig_Songs WHERE GigID = ?
                `);
                const insertReqStmt = db.prepare(`
                    INSERT INTO Gig_Songs (GigID, SongID, SortOrder, IsPlayed, IsRequest)
                    VALUES (?, ?, ?, ?, ?)
                `);

                let currentMaxOrder = (maxOrderStmt.get(gig.GigID).maxO || 0);

                for (const [songId, info] of requestSongMap.entries()) {
                    const exist = checkExistStmt.get(gig.GigID, songId).c > 0;
                    if (!exist) {
                        currentMaxOrder++;
                        insertReqStmt.run(gig.GigID, songId, currentMaxOrder, info.isPlayed ? 1 : 0, 1);
                    } else {
                        db.prepare(`UPDATE Gig_Songs SET IsRequest = 1 WHERE GigID = ? AND SongID = ?`).run(gig.GigID, songId);
                    }
                }
            });

            updateTx();
            console.log(`✅ BAŞARILI! 23 Ekim sahnesinin çalındı ve istek bilgileri cerrahi olarak güncellendi.`);
            console.log(`   24 Ekim'deki misafirleriniz, diğer sahneler ve şarkılar %100 KORUNDU.\n`);
        }
    } else {
        console.log("⚠️ PM2 loglarında bu GigID için eşleşen INSERT bulunamadı.");
        console.log("   Alternatif olarak log içinde 'GigID = 35' aramasını derinleştirelim.");
    }
}

main().catch(err => console.error("Hata:", err));
