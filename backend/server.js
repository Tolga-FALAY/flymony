import express from 'express';
import cors from 'cors';
import db, { initializeDB } from './database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve React production build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Serve root vanilla folder on /vanilla route
app.use('/vanilla', express.static(path.join(__dirname, '../')));

// Initialize the database
initializeDB();

// ========================
// ARTISTS API
// ========================
app.get('/api/artists', (req, res) => {
    try {
        const artists = db.prepare('SELECT * FROM Artists').all();
        res.json(artists);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/artists', (req, res) => {
    try {
        const { ArtistName } = req.body;
        if (!ArtistName || !ArtistName.trim()) {
            return res.status(400).json({ error: 'Sanatçı adı boş olamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?))').get(ArtistName);
        if (existing) {
            return res.status(400).json({ error: 'Bu sanatçı zaten kayıtlı!' });
        }
        const info = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)').run(ArtistName);
        res.status(201).json({ id: info.lastInsertRowid, ArtistName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/artists/:id', (req, res) => {
    try {
        const { ArtistName } = req.body;
        if (!ArtistName || !ArtistName.trim()) {
            return res.status(400).json({ error: 'Sanatçı adı boş olamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Artists WHERE TRIM(LOWER(ArtistName)) = TRIM(LOWER(?)) AND ArtistID != ?').get(ArtistName, req.params.id);
        if (existing) {
            return res.status(400).json({ error: 'Bu isimde başka bir sanatçı zaten kayıtlı!' });
        }
        db.prepare('UPDATE Artists SET ArtistName = ? WHERE ArtistID = ?').run(ArtistName, req.params.id);
        res.json({ message: 'Artist updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/artists/:id', (req, res) => {
    try {
        const isLinked = db.prepare('SELECT 1 FROM Song_Artists WHERE ArtistID = ?').get(req.params.id);
        if (isLinked) {
            return res.status(400).json({ error: 'Bu sanatçı bir şarkıda kayıtlı, sanatçıyı silmek için önce ilgili şarkı kaydınız silmeniz gerekir' });
        }
        db.prepare('DELETE FROM Artists WHERE ArtistID = ?').run(req.params.id);
        res.json({ message: 'Artist deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// SONGS API
// ========================
app.get('/api/songs', (req, res) => {
    try {
        // Fetch songs with their associated artists
        const songs = db.prepare(`
            SELECT s.SongID, s.SongTitle, s.Duration, s.SongYear, s.Lyrics, s.AudioPath, s.OriginalKey, s.ChordImagePath,
                   GROUP_CONCAT(a.ArtistID) as ArtistIDs,
                   GROUP_CONCAT(a.ArtistName, ', ') as ArtistNames
            FROM Songs s
            LEFT JOIN Song_Artists sa ON s.SongID = sa.SongID
            LEFT JOIN Artists a ON sa.ArtistID = a.ArtistID
            GROUP BY s.SongID
        `).all();

        // Parse ArtistIDs to an array of numbers for the frontend
        const formattedSongs = songs.map(s => ({
            ...s,
            ArtistIDs: s.ArtistIDs ? s.ArtistIDs.split(',').map(Number) : [],
            SongYear: s.SongYear || '',
            Lyrics: s.Lyrics || '',
            AudioPath: s.AudioPath || '',
            OriginalKey: s.OriginalKey || '',
            ChordImagePath: s.ChordImagePath || ''
        }));

        // Sort songs alphabetically ascending by title (Turkish locale aware)
        formattedSongs.sort((a, b) => {
            return (a.SongTitle || "").toLocaleLowerCase('tr-TR').localeCompare((b.SongTitle || "").toLocaleLowerCase('tr-TR'), 'tr');
        });

        res.json(formattedSongs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper to save base64 audio data to disk
function saveAudioFile(audioData) {
    if (!audioData) return null;
    let mimeType = 'audio/mpeg';
    let base64Content = audioData;
    let extension = 'mp3';
    
    if (audioData.startsWith('data:')) {
        const parts = audioData.split(';base64,');
        const meta = parts[0];
        base64Content = parts[1];
        mimeType = meta.split(':')[1].split(';')[0];
        
        if (mimeType.includes('wav')) extension = 'wav';
        else if (mimeType.includes('webm')) extension = 'webm';
        else if (mimeType.includes('ogg')) extension = 'ogg';
        else if (mimeType.includes('m4a')) extension = 'm4a';
        else if (mimeType.includes('mp4')) extension = 'mp4';
        else if (mimeType.includes('aac')) extension = 'aac';
    }
    
    const buffer = Buffer.from(base64Content, 'base64');
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `audio_${Date.now()}_${Math.floor(Math.random() * 1000000)}.${extension}`;
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return `/uploads/${fileName}`;
}

// Helper to save base64 chord image data to disk
function saveChordImageFile(imageData) {
    if (!imageData) return null;
    let mimeType = 'image/jpeg';
    let base64Content = imageData;
    let extension = 'jpg';
    
    if (imageData.startsWith('data:')) {
        const parts = imageData.split(';base64,');
        const meta = parts[0];
        base64Content = parts[1];
        mimeType = meta.split(':')[1].split(';')[0];
        
        if (mimeType.includes('png')) extension = 'png';
        else if (mimeType.includes('gif')) extension = 'gif';
        else if (mimeType.includes('webp')) extension = 'webp';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) extension = 'jpg';
    }
    
    const buffer = Buffer.from(base64Content, 'base64');
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const fileName = `chord_${Date.now()}_${Math.floor(Math.random() * 1000000)}.${extension}`;
    fs.writeFileSync(path.join(uploadDir, fileName), buffer);
    return `/uploads/${fileName}`;
}

app.post('/api/songs', (req, res) => {
    const { SongTitle, Duration, ArtistIDs, SongYear, Lyrics, AudioPath, AudioData, OriginalKey, ChordImagePath, ChordImageData } = req.body; // ArtistIDs should be an array of IDs
    if (!SongTitle || !SongTitle.trim()) {
        return res.status(400).json({ error: 'Şarkı adı boş olamaz!' });
    }

    try {
        const existingSongs = db.prepare('SELECT SongID FROM Songs WHERE TRIM(LOWER(SongTitle)) = TRIM(LOWER(?))').all(SongTitle);
        let isDuplicate = false;
        const newArtistIDs = (ArtistIDs || []).map(Number);
        
        for (const s of existingSongs) {
            const existingArtists = db.prepare('SELECT ArtistID FROM Song_Artists WHERE SongID = ?').all(s.SongID).map(row => row.ArtistID);
            if (existingArtists.length === 0 && newArtistIDs.length === 0) {
                isDuplicate = true;
                break;
            }
            if (newArtistIDs.some(id => existingArtists.includes(id))) {
                isDuplicate = true;
                break;
            }
        }
        
        if (isDuplicate) {
            return res.status(400).json({ error: 'Bu şarkı zaten kayıtlı!' });
        }

        let audioPathToSave = null;
        if (AudioData) {
            audioPathToSave = saveAudioFile(AudioData);
        } else if (AudioPath) {
            audioPathToSave = AudioPath;
        }

        let chordImagePathToSave = null;
        if (ChordImageData) {
            chordImagePathToSave = saveChordImageFile(ChordImageData);
        } else if (ChordImagePath) {
            chordImagePathToSave = ChordImagePath;
        }

        const insertSong = db.prepare('INSERT INTO Songs (SongTitle, Duration, SongYear, Lyrics, AudioPath, OriginalKey, ChordImagePath) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const insertSongArtist = db.prepare('INSERT INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');

        const transaction = db.transaction((songTitle, duration, songYear, lyrics, audioPath, originalKey, chordImagePath, artistIds) => {
            const info = insertSong.run(songTitle, duration, songYear || null, lyrics || null, audioPath || null, originalKey || null, chordImagePath || null);
            const songId = info.lastInsertRowid;
            if (artistIds && artistIds.length > 0) {
                for (const artistId of artistIds) {
                    insertSongArtist.run(songId, artistId);
                }
            }
            return songId;
        });

        const songId = transaction(SongTitle, Duration, SongYear ? Number(SongYear) : null, Lyrics || null, audioPathToSave, OriginalKey || null, chordImagePathToSave, ArtistIDs || []);
        res.status(201).json({ id: songId, message: 'Song created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/songs/:id', (req, res) => {
    const { SongTitle, Duration, ArtistIDs, SongYear, Lyrics, AudioPath, AudioData, OriginalKey, ChordImagePath, ChordImageData } = req.body;
    const songId = req.params.id;
    if (!SongTitle || !SongTitle.trim()) {
        return res.status(400).json({ error: 'Şarkı adı boş olamaz!' });
    }

    try {
        const existingSongs = db.prepare('SELECT SongID FROM Songs WHERE TRIM(LOWER(SongTitle)) = TRIM(LOWER(?)) AND SongID != ?').all(SongTitle, songId);
        let isDuplicate = false;
        const newArtistIDs = (ArtistIDs || []).map(Number);
        
        for (const s of existingSongs) {
            const existingArtists = db.prepare('SELECT ArtistID FROM Song_Artists WHERE SongID = ?').all(s.SongID).map(row => row.ArtistID);
            if (existingArtists.length === 0 && newArtistIDs.length === 0) {
                isDuplicate = true;
                break;
            }
            if (newArtistIDs.some(id => existingArtists.includes(id))) {
                isDuplicate = true;
                break;
            }
        }
        
        if (isDuplicate) {
            return res.status(400).json({ error: 'Bu şarkı zaten kayıtlı!' });
        }

        const existingSong = db.prepare('SELECT AudioPath, ChordImagePath FROM Songs WHERE SongID = ?').get(songId);
        let finalAudioPath = existingSong ? existingSong.AudioPath : null;
        let finalChordImagePath = existingSong ? existingSong.ChordImagePath : null;

        if (AudioData) {
            // Delete old file if exists
            if (finalAudioPath) {
                const oldFilePath = path.join(__dirname, '..', finalAudioPath);
                if (fs.existsSync(oldFilePath)) {
                    try { fs.unlinkSync(oldFilePath); } catch (e) { console.error("Error deleting old file:", e); }
                }
            }
            finalAudioPath = saveAudioFile(AudioData);
        } else if (AudioPath === '' || AudioPath === null) {
            // User explicitly cleared the audio
            if (finalAudioPath) {
                const oldFilePath = path.join(__dirname, '..', finalAudioPath);
                if (fs.existsSync(oldFilePath)) {
                    try { fs.unlinkSync(oldFilePath); } catch (e) { console.error("Error deleting old file:", e); }
                }
            }
            finalAudioPath = null;
        }

        if (ChordImageData) {
            // Delete old file if exists
            if (finalChordImagePath) {
                const oldFilePath = path.join(__dirname, '..', finalChordImagePath);
                if (fs.existsSync(oldFilePath)) {
                    try { fs.unlinkSync(oldFilePath); } catch (e) { console.error("Error deleting old chord image:", e); }
                }
            }
            finalChordImagePath = saveChordImageFile(ChordImageData);
        } else if (ChordImagePath === '' || ChordImagePath === null) {
            // User explicitly cleared the chord image
            if (finalChordImagePath) {
                const oldFilePath = path.join(__dirname, '..', finalChordImagePath);
                if (fs.existsSync(oldFilePath)) {
                    try { fs.unlinkSync(oldFilePath); } catch (e) { console.error("Error deleting old chord image:", e); }
                }
            }
            finalChordImagePath = null;
        }

        const updateSong = db.prepare('UPDATE Songs SET SongTitle = ?, Duration = ?, SongYear = ?, Lyrics = ?, AudioPath = ?, OriginalKey = ?, ChordImagePath = ? WHERE SongID = ?');
        const deleteSongArtists = db.prepare('DELETE FROM Song_Artists WHERE SongID = ?');
        const insertSongArtist = db.prepare('INSERT INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');

        const transaction = db.transaction((id, title, duration, songYear, lyrics, audioPath, originalKey, chordImagePath, artistIds) => {
            updateSong.run(title, duration, songYear || null, lyrics || null, audioPath || null, originalKey || null, chordImagePath || null, id);
            deleteSongArtists.run(id);
            if (artistIds && artistIds.length > 0) {
                for (const artistId of artistIds) {
                    insertSongArtist.run(id, artistId);
                }
            }
        });

        transaction(songId, SongTitle, Duration, SongYear ? Number(SongYear) : null, Lyrics || null, finalAudioPath, OriginalKey || null, finalChordImagePath, ArtistIDs || []);
        res.json({ message: 'Song updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/songs/:id', (req, res) => {
    try {
        const isLinked = db.prepare('SELECT 1 FROM Requests WHERE SongID = ?').get(req.params.id);
        if (isLinked) {
            return res.status(400).json({ error: 'Bu şarkıyı veya misafiri silmek için önce bu şarkının ve misafirin kayıtlı olduğu tüm istek kayıtlarını silmelisiniz' });
        }
        
        const existingSong = db.prepare('SELECT AudioPath, ChordImagePath FROM Songs WHERE SongID = ?').get(req.params.id);
        
        db.prepare('DELETE FROM Songs WHERE SongID = ?').run(req.params.id);
        
        if (existingSong && existingSong.AudioPath) {
            const filePath = path.join(__dirname, '..', existingSong.AudioPath);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { console.error("Error deleting file on song deletion:", e); }
            }
        }
        if (existingSong && existingSong.ChordImagePath) {
            const filePath = path.join(__dirname, '..', existingSong.ChordImagePath);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) { console.error("Error deleting chord image file on song deletion:", e); }
            }
        }
        res.json({ message: 'Song deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// GUESTS API
// ========================
app.get('/api/guests', (req, res) => {
    try {
        const guests = db.prepare('SELECT * FROM Guests').all();
        const relationships = db.prepare('SELECT * FROM Guest_Relationships').all();
        
        const relMap = {};
        relationships.forEach(r => {
            if (!relMap[r.GuestID]) relMap[r.GuestID] = [];
            relMap[r.GuestID].push(r.RelatedGuestID);
        });

        const parsedGuests = guests.map(g => ({
            ...g,
            Photos: g.Photos ? JSON.parse(g.Photos) : [],
            RelatedGuestIDs: relMap[g.GuestID] || []
        }));
        // Sort by FirstName and LastName (Turkish locale aware)
        parsedGuests.sort((a, b) => {
            const fNameCompare = (a.FirstName || "").toLocaleLowerCase('tr-TR').localeCompare((b.FirstName || "").toLocaleLowerCase('tr-TR'), 'tr');
            if (fNameCompare !== 0) return fNameCompare;
            return (a.LastName || "").toLocaleLowerCase('tr-TR').localeCompare((b.LastName || "").toLocaleLowerCase('tr-TR'), 'tr');
        });
        res.json(parsedGuests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/guests', (req, res) => {
    try {
        const { FirstName, LastName, PhoneNumber, InstagramLink, Notes, ProfilePicture, BirthDateDay, BirthDateMonth, BirthDateYear, Photos, RelatedGuestIDs, IsMusician } = req.body;
        if (!FirstName || !FirstName.trim() || !LastName || !LastName.trim()) {
            return res.status(400).json({ error: 'Ad ve soyad alanları boş bırakılamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Guests WHERE TRIM(LOWER(FirstName)) = TRIM(LOWER(?)) AND TRIM(LOWER(LastName)) = TRIM(LOWER(?))').get(FirstName, LastName);
        if (existing) {
            return res.status(400).json({ error: 'Bu misafir zaten kayıtlı!' });
        }

        const insertGuestTransaction = db.transaction(() => {
            const info = db.prepare(`
                INSERT INTO Guests (FirstName, LastName, PhoneNumber, InstagramLink, Notes, ProfilePicture, BirthDateDay, BirthDateMonth, BirthDateYear, Photos, IsMusician) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                FirstName, 
                LastName, 
                PhoneNumber || "", 
                InstagramLink || "", 
                Notes || "", 
                ProfilePicture || "", 
                BirthDateDay ? Number(BirthDateDay) : null, 
                BirthDateMonth ? Number(BirthDateMonth) : null, 
                BirthDateYear ? Number(BirthDateYear) : null, 
                Photos ? JSON.stringify(Photos) : '[]',
                IsMusician ? 1 : 0
            );
            const guestId = info.lastInsertRowid;
            
            if (RelatedGuestIDs && Array.isArray(RelatedGuestIDs)) {
                const insertRel = db.prepare('INSERT OR IGNORE INTO Guest_Relationships (GuestID, RelatedGuestID) VALUES (?, ?)');
                for (const rId of RelatedGuestIDs) {
                    insertRel.run(guestId, Number(rId));
                    insertRel.run(Number(rId), guestId); // bidirectional
                }
            }
            return guestId;
        });

        const guestId = insertGuestTransaction();
        res.status(201).json({ id: guestId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/guests/:id', (req, res) => {
    try {
        const { FirstName, LastName, PhoneNumber, InstagramLink, Notes, ProfilePicture, BirthDateDay, BirthDateMonth, BirthDateYear, Photos, RelatedGuestIDs, IsMusician } = req.body;
        const guestId = req.params.id;
        if (!FirstName || !FirstName.trim() || !LastName || !LastName.trim()) {
            return res.status(400).json({ error: 'Ad ve soyad alanları boş bırakılamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Guests WHERE TRIM(LOWER(FirstName)) = TRIM(LOWER(?)) AND TRIM(LOWER(LastName)) = TRIM(LOWER(?)) AND GuestID != ?').get(FirstName, LastName, guestId);
        if (existing) {
            return res.status(400).json({ error: 'Bu isimde başka bir misafir zaten kayıtlı!' });
        }

        const updateGuestTransaction = db.transaction(() => {
            db.prepare(`
                UPDATE Guests 
                SET FirstName = ?, LastName = ?, PhoneNumber = ?, InstagramLink = ?, Notes = ?, ProfilePicture = ?, BirthDateDay = ?, BirthDateMonth = ?, BirthDateYear = ?, Photos = ?, IsMusician = ?, UpdatedAt = CURRENT_TIMESTAMP 
                WHERE GuestID = ?
            `).run(
                FirstName, 
                LastName, 
                PhoneNumber || "", 
                InstagramLink || "", 
                Notes || "", 
                ProfilePicture || "", 
                BirthDateDay ? Number(BirthDateDay) : null, 
                BirthDateMonth ? Number(BirthDateMonth) : null, 
                BirthDateYear ? Number(BirthDateYear) : null, 
                Photos ? JSON.stringify(Photos) : '[]',
                IsMusician ? 1 : 0,
                guestId
            );

            // Clean old relationships
            db.prepare('DELETE FROM Guest_Relationships WHERE GuestID = ? OR RelatedGuestID = ?').run(guestId, guestId);

            // Insert new ones
            if (RelatedGuestIDs && Array.isArray(RelatedGuestIDs)) {
                const insertRel = db.prepare('INSERT OR IGNORE INTO Guest_Relationships (GuestID, RelatedGuestID) VALUES (?, ?)');
                for (const rId of RelatedGuestIDs) {
                    insertRel.run(Number(guestId), Number(rId));
                    insertRel.run(Number(rId), Number(guestId)); // bidirectional
                }
            }
        });

        updateGuestTransaction();
        res.json({ message: 'Guest updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/guests/:id', (req, res) => {
    try {
        const isLinked = db.prepare('SELECT 1 FROM Request_Guests WHERE GuestID = ?').get(req.params.id);
        if (isLinked) {
            return res.status(400).json({ error: 'Bu şarkıyı veya misafiri silmek için önce bu şarkının ve misafirin kayıtlı olduğu tüm istek kayıtlarını silmelisiniz' });
        }

        const deleteGuestTransaction = db.transaction(() => {
            // Clean relationships manually first (though foreign key delete cascade should work, manual is safe)
            db.prepare('DELETE FROM Guest_Relationships WHERE GuestID = ? OR RelatedGuestID = ?').run(req.params.id, req.params.id);
            db.prepare('DELETE FROM Guests WHERE GuestID = ?').run(req.params.id);
        });

        deleteGuestTransaction();
        res.json({ message: 'Guest deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// REQUESTS API
// ========================
app.get('/api/requests', (req, res) => {
    try {
        const requests = db.prepare(`
            SELECT r.RequestID, r.RequestDate, r.Status, r.Link, r.Vardi, r.Notes, r.StatusChangeDate, s.SongID, s.SongTitle,
                   GROUP_CONCAT(DISTINCT g.GuestID) as GuestIDs,
                   GROUP_CONCAT(DISTINCT g.FullName) as FullNames,
                   (
                       SELECT GROUP_CONCAT(a.ArtistName, ', ')
                       FROM Song_Artists sa
                       JOIN Artists a ON sa.ArtistID = a.ArtistID
                       WHERE sa.SongID = s.SongID
                   ) as ArtistNames
            FROM Requests r
            JOIN Songs s ON r.SongID = s.SongID
            LEFT JOIN Request_Guests rg ON r.RequestID = rg.RequestID
            LEFT JOIN Guests g ON rg.GuestID = g.GuestID
            GROUP BY r.RequestID
            ORDER BY r.RequestDate DESC
        `).all();

        const formattedRequests = requests.map(r => ({
            ...r,
            GuestIDs: r.GuestIDs ? r.GuestIDs.split(',').map(Number) : [],
            SongTitle: r.SongTitle + (r.ArtistNames ? ` (${r.ArtistNames})` : ''),
            Status: r.Status || 'Kayıtlı',
            Link: r.Link || '',
            Vardi: r.Vardi || 0,
            Notes: r.Notes || '',
            StatusChangeDate: r.StatusChangeDate || ''
        }));
        res.json(formattedRequests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/requests', (req, res) => {
    const { SongID, GuestIDs, Status, Link, Vardi, Notes, StatusChangeDate } = req.body; // GuestIDs should be an array of IDs
    if (!SongID || !GuestIDs || !Array.isArray(GuestIDs) || GuestIDs.length === 0) {
        return res.status(400).json({ error: 'Geçersiz istek verisi. Şarkı ve en az bir misafir seçilmelidir.' });
    }

    try {
        // Check for duplicates (Song must be unique across all requests)
        const existingRequest = db.prepare('SELECT RequestID FROM Requests WHERE SongID = ?').get(SongID);
        if (existingRequest) {
            return res.status(400).json({ error: 'Bu istek zaten kayıtlı' });
        }

        const insertRequest = db.prepare('INSERT INTO Requests (SongID, Status, Link, Vardi, Notes, StatusChangeDate) VALUES (?, ?, ?, ?, ?, ?)');
        const insertRequestGuest = db.prepare('INSERT INTO Request_Guests (RequestID, GuestID) VALUES (?, ?)');

        const transaction = db.transaction((songId, guestIds, status, link, vardi, notes, statusChangeDate) => {
            const info = insertRequest.run(songId, status || 'Kayıtlı', link || '', vardi || 0, notes || '', statusChangeDate || null);
            const requestId = info.lastInsertRowid;
            for (const guestId of guestIds) {
                insertRequestGuest.run(requestId, guestId);
            }
            return requestId;
        });

        const requestId = transaction(SongID, GuestIDs, Status, Link, Vardi, Notes, StatusChangeDate);
        res.status(201).json({ id: requestId, message: 'İstek başarıyla oluşturuldu' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/requests/:id', (req, res) => {
    const { SongID, GuestIDs, Status, Link, Vardi, Notes, StatusChangeDate } = req.body;
    const requestId = req.params.id;
    if (!SongID || !GuestIDs || !Array.isArray(GuestIDs) || GuestIDs.length === 0) {
        return res.status(400).json({ error: 'Geçersiz istek verisi. Şarkı ve en az bir misafir seçilmelidir.' });
    }

    try {
        // Check for duplicates (Song must be unique across all requests)
        const existingRequest = db.prepare('SELECT RequestID FROM Requests WHERE SongID = ? AND RequestID != ?').get(SongID, requestId);
        if (existingRequest) {
            return res.status(400).json({ error: 'Bu istek zaten kayıtlı' });
        }

        const updateRequest = db.prepare('UPDATE Requests SET SongID = ?, Status = ?, Link = ?, Vardi = ?, Notes = ?, StatusChangeDate = ? WHERE RequestID = ?');
        const deleteRequestGuests = db.prepare('DELETE FROM Request_Guests WHERE RequestID = ?');
        const insertRequestGuest = db.prepare('INSERT INTO Request_Guests (RequestID, GuestID) VALUES (?, ?)');

        const transaction = db.transaction((reqId, songId, guestIds, status, link, vardi, notes, statusChangeDate) => {
            updateRequest.run(songId, status || 'Kayıtlı', link || '', vardi || 0, notes || '', statusChangeDate || null, reqId);
            deleteRequestGuests.run(reqId);
            for (const guestId of guestIds) {
                insertRequestGuest.run(reqId, guestId);
            }
        });

        transaction(requestId, SongID, GuestIDs, Status, Link, Vardi, Notes, StatusChangeDate);
        res.json({ message: 'İstek başarıyla güncellendi' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/requests/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM Requests WHERE RequestID = ?').run(req.params.id);
        res.json({ message: 'Request deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// REQUEST STATUSES API
// ========================
app.get('/api/statuses', (req, res) => {
    try {
        const statuses = db.prepare('SELECT * FROM RequestStatuses').all();
        res.json(statuses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/statuses', (req, res) => {
    try {
        const { StatusName, Color } = req.body;
        if (!StatusName || !StatusName.trim()) {
            return res.status(400).json({ error: 'Durum adı boş olamaz!' });
        }
        if (!Color || !Color.trim()) {
            return res.status(400).json({ error: 'Renk boş olamaz!' });
        }
        const existing = db.prepare('SELECT * FROM RequestStatuses WHERE TRIM(LOWER(StatusName)) = TRIM(LOWER(?))').get(StatusName);
        if (existing) {
            return res.status(400).json({ error: 'Bu durum zaten tanımlı!' });
        }
        const info = db.prepare('INSERT INTO RequestStatuses (StatusName, Color) VALUES (?, ?)').run(StatusName.trim(), Color.trim());
        res.status(201).json({ id: info.lastInsertRowid, StatusName: StatusName.trim(), Color: Color.trim() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/statuses/:id', (req, res) => {
    try {
        const { StatusName, Color } = req.body;
        const statusId = req.params.id;
        if (!StatusName || !StatusName.trim()) {
            return res.status(400).json({ error: 'Durum adı boş olamaz!' });
        }
        if (!Color || !Color.trim()) {
            return res.status(400).json({ error: 'Renk boş olamaz!' });
        }
        
        const existing = db.prepare('SELECT * FROM RequestStatuses WHERE TRIM(LOWER(StatusName)) = TRIM(LOWER(?)) AND StatusID != ?').get(StatusName, statusId);
        if (existing) {
            return res.status(400).json({ error: 'Bu isimde başka bir durum zaten tanımlı!' });
        }

        const oldStatus = db.prepare('SELECT StatusName FROM RequestStatuses WHERE StatusID = ?').get(statusId);
        
        const transaction = db.transaction((id, name, color, oldName) => {
            db.prepare('UPDATE RequestStatuses SET StatusName = ?, Color = ? WHERE StatusID = ?').run(name, color, id);
            // If the status name changed, update existing requests with this status to keep compatibility
            if (oldName && oldName.toLowerCase() !== name.toLowerCase()) {
                db.prepare('UPDATE Requests SET Status = ? WHERE Status = ?').run(name, oldName);
            }
        });

        transaction(statusId, StatusName.trim(), Color.trim(), oldStatus ? oldStatus.StatusName : null);
        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/statuses/:id', (req, res) => {
    try {
        const statusId = req.params.id;
        const status = db.prepare('SELECT StatusName FROM RequestStatuses WHERE StatusID = ?').get(statusId);
        if (!status) {
            return res.status(404).json({ error: 'Durum bulunamadı!' });
        }

        const isLinked = db.prepare('SELECT 1 FROM Requests WHERE Status = ?').get(status.StatusName);
        if (isLinked) {
            return res.status(400).json({ error: 'Silmek istediğiniz durum parametresi, bir istek kaydında mevcut. Durum kaydını silmek için önce istek kaydından durum bilgisini değişmeniz gerekir' });
        }

        db.prepare('DELETE FROM RequestStatuses WHERE StatusID = ?').run(statusId);
        res.json({ message: 'Status deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// VENUES API
// ========================
app.get('/api/venues', (req, res) => {
    try {
        const venues = db.prepare('SELECT * FROM Venues').all();
        res.json(venues);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/venues', (req, res) => {
    try {
        const { VenueName, ContactPerson, ContactPhone, InstagramLink } = req.body;
        if (!VenueName || !VenueName.trim()) {
            return res.status(400).json({ error: 'Mekan adı boş olamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Venues WHERE TRIM(LOWER(VenueName)) = TRIM(LOWER(?))').get(VenueName);
        if (existing) {
            return res.status(400).json({ error: 'Bu mekan zaten tanımlı!' });
        }
        const info = db.prepare(`
            INSERT INTO Venues (VenueName, ContactPerson, ContactPhone, InstagramLink) 
            VALUES (?, ?, ?, ?)
        `).run(VenueName.trim(), ContactPerson ? ContactPerson.trim() : '', ContactPhone ? ContactPhone.trim() : '', InstagramLink ? InstagramLink.trim() : '');
        res.status(201).json({ 
            id: info.lastInsertRowid, 
            VenueName: VenueName.trim(), 
            ContactPerson: ContactPerson ? ContactPerson.trim() : '', 
            ContactPhone: ContactPhone ? ContactPhone.trim() : '', 
            InstagramLink: InstagramLink ? InstagramLink.trim() : ''
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/venues/:id', (req, res) => {
    try {
        const { VenueName, ContactPerson, ContactPhone, InstagramLink } = req.body;
        const venueId = req.params.id;
        if (!VenueName || !VenueName.trim()) {
            return res.status(400).json({ error: 'Mekan adı boş olamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Venues WHERE TRIM(LOWER(VenueName)) = TRIM(LOWER(?)) AND VenueID != ?').get(VenueName, venueId);
        if (existing) {
            return res.status(400).json({ error: 'Bu isimde başka bir mekan zaten tanımlı!' });
        }
        db.prepare(`
            UPDATE Venues 
            SET VenueName = ?, ContactPerson = ?, ContactPhone = ?, InstagramLink = ? 
            WHERE VenueID = ?
        `).run(VenueName.trim(), ContactPerson ? ContactPerson.trim() : '', ContactPhone ? ContactPhone.trim() : '', InstagramLink ? InstagramLink.trim() : '', venueId);
        res.json({ message: 'Venue updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/venues/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM Venues WHERE VenueID = ?').run(req.params.id);
        res.json({ message: 'Venue deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// GIGS API
// ========================
app.get('/api/gigs', (req, res) => {
    try {
        const gigs = db.prepare('SELECT * FROM Gigs ORDER BY GigDate DESC, GigID DESC').all();
        
        const formattedGigs = gigs.map(gig => {
            const songs = db.prepare(`
                SELECT gs.GigSongID, gs.SongID, gs.SortOrder, gs.IsPlayed, gs.IsRequest, s.SongTitle,
                       (
                           SELECT GROUP_CONCAT(a.ArtistName, ', ')
                           FROM Song_Artists sa
                           JOIN Artists a ON sa.ArtistID = a.ArtistID
                           WHERE sa.SongID = s.SongID
                       ) as ArtistNames
                FROM Gig_Songs gs
                JOIN Songs s ON gs.SongID = s.SongID
                WHERE gs.GigID = ?
                ORDER BY gs.SortOrder ASC
            `).all(gig.GigID).map(s => ({
                GigSongID: Number(s.GigSongID),
                SongID: Number(s.SongID),
                SortOrder: Number(s.SortOrder),
                IsPlayed: Number(s.IsPlayed),
                IsRequest: Number(s.IsRequest),
                SongTitle: s.SongTitle,
                ArtistNames: s.ArtistNames || '-'
            }));

            const guests = db.prepare(`
                SELECT gg.GigGuestID, gg.GuestID, gg.TableName, g.FirstName, g.LastName
                FROM Gig_Guests gg
                JOIN Guests g ON gg.GuestID = g.GuestID
                WHERE gg.GigID = ?
            `).all(gig.GigID).map(g => ({
                GigGuestID: Number(g.GigGuestID),
                GuestID: Number(g.GuestID),
                TableName: g.TableName || '',
                FullName: `${g.FirstName} ${g.LastName}`.trim()
            }));

            return {
                GigID: Number(gig.GigID),
                VenueName: gig.VenueName,
                GigDate: gig.GigDate,
                Notes: gig.Notes || '',
                Photos: gig.Photos ? JSON.parse(gig.Photos) : [],
                Videos: gig.Videos ? JSON.parse(gig.Videos) : [],
                Songs: songs,
                Guests: guests,
                CreatedAt: gig.CreatedAt,
                UpdatedAt: gig.UpdatedAt
            };
        });

        res.json(formattedGigs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/gigs', (req, res) => {
    const { VenueName, GigDate, Notes, Photos, Videos, Songs, Guests } = req.body;
    if (!VenueName || !VenueName.trim() || !GigDate) {
        return res.status(400).json({ error: 'Mekân adı ve tarih alanları boş bırakılamaz!' });
    }

    try {
        const createTransaction = db.transaction(() => {
            const gigInfo = db.prepare(`
                INSERT INTO Gigs (VenueName, GigDate, Notes, Photos, Videos)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                VenueName.trim(),
                GigDate,
                Notes || '',
                Photos ? JSON.stringify(Photos) : '[]',
                Videos ? JSON.stringify(Videos) : '[]'
            );
            const gigId = gigInfo.lastInsertRowid;

            if (Songs && Array.isArray(Songs)) {
                const insertSong = db.prepare(`
                    INSERT INTO Gig_Songs (GigID, SongID, SortOrder, IsPlayed, IsRequest)
                    VALUES (?, ?, ?, ?, ?)
                `);
                Songs.forEach(song => {
                    insertSong.run(gigId, Number(song.SongID), Number(song.SortOrder), Number(song.IsPlayed || 0), Number(song.IsRequest || 0));
                });
            }

            if (Guests && Array.isArray(Guests)) {
                const insertGuest = db.prepare(`
                    INSERT INTO Gig_Guests (GigID, GuestID, TableName)
                    VALUES (?, ?, ?)
                `);
                Guests.forEach(guest => {
                    insertGuest.run(gigId, Number(guest.GuestID), guest.TableName || '');
                });
            }

            return gigId;
        });

        const gigId = createTransaction();
        res.status(201).json({ id: gigId, message: 'Sahne kaydı oluşturuldu.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/gigs/:id', (req, res) => {
    const gigId = req.params.id;
    const { VenueName, GigDate, Notes, Photos, Videos, Songs, Guests } = req.body;
    if (!VenueName || !VenueName.trim() || !GigDate) {
        return res.status(400).json({ error: 'Mekân adı ve tarih alanları boş bırakılamaz!' });
    }

    try {
        const updateTransaction = db.transaction(() => {
            db.prepare(`
                UPDATE Gigs
                SET VenueName = ?, GigDate = ?, Notes = ?, Photos = ?, Videos = ?, UpdatedAt = CURRENT_TIMESTAMP
                WHERE GigID = ?
            `).run(
                VenueName.trim(),
                GigDate,
                Notes || '',
                Photos ? JSON.stringify(Photos) : '[]',
                Videos ? JSON.stringify(Videos) : '[]',
                gigId
            );

            db.prepare('DELETE FROM Gig_Songs WHERE GigID = ?').run(gigId);
            if (Songs && Array.isArray(Songs)) {
                const insertSong = db.prepare(`
                    INSERT INTO Gig_Songs (GigID, SongID, SortOrder, IsPlayed, IsRequest)
                    VALUES (?, ?, ?, ?, ?)
                `);
                Songs.forEach(song => {
                    insertSong.run(gigId, Number(song.SongID), Number(song.SortOrder), Number(song.IsPlayed || 0), Number(song.IsRequest || 0));
                });
            }

            db.prepare('DELETE FROM Gig_Guests WHERE GigID = ?').run(gigId);
            if (Guests && Array.isArray(Guests)) {
                const insertGuest = db.prepare(`
                    INSERT INTO Gig_Guests (GigID, GuestID, TableName)
                    VALUES (?, ?, ?)
                `);
                Guests.forEach(guest => {
                    insertGuest.run(gigId, Number(guest.GuestID), guest.TableName || '');
                });
            }
        });

        updateTransaction();
        res.json({ message: 'Sahne kaydı güncellendi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/gigs/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM Gigs WHERE GigID = ?').run(req.params.id);
        res.json({ message: 'Sahne kaydı silindi.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback for React Router (Single Page Application routing)
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/vanilla')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// ========================
// START SERVER
// ========================
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
