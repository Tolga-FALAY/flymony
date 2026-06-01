import express from 'express';
import cors from 'cors';
import db, { initializeDB } from './database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

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
            SELECT s.SongID, s.SongTitle, s.Duration, 
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
            ArtistIDs: s.ArtistIDs ? s.ArtistIDs.split(',').map(Number) : []
        }));

        res.json(formattedSongs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/songs', (req, res) => {
    const { SongTitle, Duration, ArtistIDs } = req.body; // ArtistIDs should be an array of IDs
    if (!SongTitle || !SongTitle.trim()) {
        return res.status(400).json({ error: 'Şarkı adı boş olamaz!' });
    }

    try {
        const existing = db.prepare('SELECT * FROM Songs WHERE TRIM(LOWER(SongTitle)) = TRIM(LOWER(?))').get(SongTitle);
        if (existing) {
            return res.status(400).json({ error: 'Bu şarkı zaten kayıtlı!' });
        }

        const insertSong = db.prepare('INSERT INTO Songs (SongTitle, Duration) VALUES (?, ?)');
        const insertSongArtist = db.prepare('INSERT INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');

        const transaction = db.transaction((songTitle, duration, artistIds) => {
            const info = insertSong.run(songTitle, duration);
            const songId = info.lastInsertRowid;
            if (artistIds && artistIds.length > 0) {
                for (const artistId of artistIds) {
                    insertSongArtist.run(songId, artistId);
                }
            }
            return songId;
        });

        const songId = transaction(SongTitle, Duration, ArtistIDs || []);
        res.status(201).json({ id: songId, message: 'Song created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/songs/:id', (req, res) => {
    const { SongTitle, Duration, ArtistIDs } = req.body;
    const songId = req.params.id;
    if (!SongTitle || !SongTitle.trim()) {
        return res.status(400).json({ error: 'Şarkı adı boş olamaz!' });
    }

    try {
        const existing = db.prepare('SELECT * FROM Songs WHERE TRIM(LOWER(SongTitle)) = TRIM(LOWER(?)) AND SongID != ?').get(SongTitle, songId);
        if (existing) {
            return res.status(400).json({ error: 'Bu isimde başka bir şarkı zaten kayıtlı!' });
        }

        const updateSong = db.prepare('UPDATE Songs SET SongTitle = ?, Duration = ? WHERE SongID = ?');
        const deleteSongArtists = db.prepare('DELETE FROM Song_Artists WHERE SongID = ?');
        const insertSongArtist = db.prepare('INSERT INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');

        const transaction = db.transaction((id, title, duration, artistIds) => {
            updateSong.run(title, duration, id);
            deleteSongArtists.run(id);
            if (artistIds && artistIds.length > 0) {
                for (const artistId of artistIds) {
                    insertSongArtist.run(id, artistId);
                }
            }
        });

        transaction(songId, SongTitle, Duration, ArtistIDs || []);
        res.json({ message: 'Song updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/songs/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM Songs WHERE SongID = ?').run(req.params.id);
        res.json({ message: 'Song deleted' });
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
        res.json(guests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/guests', (req, res) => {
    try {
        const { FirstName, LastName, PhoneNumber, InstagramLink } = req.body;
        if (!FirstName || !FirstName.trim() || !LastName || !LastName.trim()) {
            return res.status(400).json({ error: 'Ad ve soyad alanları boş bırakılamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Guests WHERE TRIM(LOWER(FirstName)) = TRIM(LOWER(?)) AND TRIM(LOWER(LastName)) = TRIM(LOWER(?))').get(FirstName, LastName);
        if (existing) {
            return res.status(400).json({ error: 'Bu misafir zaten kayıtlı!' });
        }
        const info = db.prepare('INSERT INTO Guests (FirstName, LastName, PhoneNumber, InstagramLink) VALUES (?, ?, ?, ?)').run(FirstName, LastName, PhoneNumber, InstagramLink);
        res.status(201).json({ id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/guests/:id', (req, res) => {
    try {
        const { FirstName, LastName, PhoneNumber, InstagramLink } = req.body;
        if (!FirstName || !FirstName.trim() || !LastName || !LastName.trim()) {
            return res.status(400).json({ error: 'Ad ve soyad alanları boş bırakılamaz!' });
        }
        const existing = db.prepare('SELECT * FROM Guests WHERE TRIM(LOWER(FirstName)) = TRIM(LOWER(?)) AND TRIM(LOWER(LastName)) = TRIM(LOWER(?)) AND GuestID != ?').get(FirstName, LastName, req.params.id);
        if (existing) {
            return res.status(400).json({ error: 'Bu isimde başka bir misafir zaten kayıtlı!' });
        }
        db.prepare('UPDATE Guests SET FirstName = ?, LastName = ?, PhoneNumber = ?, InstagramLink = ? WHERE GuestID = ?').run(FirstName, LastName, PhoneNumber, InstagramLink, req.params.id);
        res.json({ message: 'Guest updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/guests/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM Guests WHERE GuestID = ?').run(req.params.id);
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
            SELECT r.RequestID, r.RequestDate, s.SongID, s.SongTitle,
                   GROUP_CONCAT(g.GuestID) as GuestIDs,
                   GROUP_CONCAT(g.FullName, ', ') as FullNames
            FROM Requests r
            JOIN Songs s ON r.SongID = s.SongID
            LEFT JOIN Request_Guests rg ON r.RequestID = rg.RequestID
            LEFT JOIN Guests g ON rg.GuestID = g.GuestID
            GROUP BY r.RequestID
            ORDER BY r.RequestDate DESC
        `).all();

        const formattedRequests = requests.map(r => ({
            ...r,
            GuestIDs: r.GuestIDs ? r.GuestIDs.split(',').map(Number) : []
        }));
        res.json(formattedRequests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/requests', (req, res) => {
    const { SongID, GuestIDs } = req.body; // GuestIDs should be an array of IDs
    if (!SongID || !GuestIDs || !Array.isArray(GuestIDs) || GuestIDs.length === 0) {
        return res.status(400).json({ error: 'Geçersiz istek verisi. Şarkı ve en az bir misafir seçilmelidir.' });
    }

    try {
        // Check for duplicates (Song must be unique across all requests)
        const existingRequest = db.prepare('SELECT RequestID FROM Requests WHERE SongID = ?').get(SongID);
        if (existingRequest) {
            return res.status(400).json({ error: 'Bu şarkı daha önce kaydedilmiş!' });
        }

        const insertRequest = db.prepare('INSERT INTO Requests (SongID) VALUES (?)');
        const insertRequestGuest = db.prepare('INSERT INTO Request_Guests (RequestID, GuestID) VALUES (?, ?)');

        const transaction = db.transaction((songId, guestIds) => {
            const info = insertRequest.run(songId);
            const requestId = info.lastInsertRowid;
            for (const guestId of guestIds) {
                insertRequestGuest.run(requestId, guestId);
            }
            return requestId;
        });

        const requestId = transaction(SongID, GuestIDs);
        res.status(201).json({ id: requestId, message: 'İstek başarıyla oluşturuldu' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/requests/:id', (req, res) => {
    const { SongID, GuestIDs } = req.body;
    const requestId = req.params.id;
    if (!SongID || !GuestIDs || !Array.isArray(GuestIDs) || GuestIDs.length === 0) {
        return res.status(400).json({ error: 'Geçersiz istek verisi. Şarkı ve en az bir misafir seçilmelidir.' });
    }

    try {
        // Check for duplicates (Song must be unique across all requests)
        const existingRequest = db.prepare('SELECT RequestID FROM Requests WHERE SongID = ? AND RequestID != ?').get(SongID, requestId);
        if (existingRequest) {
            return res.status(400).json({ error: 'Bu şarkı daha önce kaydedilmiş!' });
        }

        const updateRequest = db.prepare('UPDATE Requests SET SongID = ? WHERE RequestID = ?');
        const deleteRequestGuests = db.prepare('DELETE FROM Request_Guests WHERE RequestID = ?');
        const insertRequestGuest = db.prepare('INSERT INTO Request_Guests (RequestID, GuestID) VALUES (?, ?)');

        const transaction = db.transaction((reqId, songId, guestIds) => {
            updateRequest.run(songId, reqId);
            deleteRequestGuests.run(reqId);
            for (const guestId of guestIds) {
                insertRequestGuest.run(reqId, guestId);
            }
        });

        transaction(requestId, SongID, GuestIDs);
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
