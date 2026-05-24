import express from 'express';
import cors from 'cors';
import db, { initializeDB } from './database.js';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

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
        const info = db.prepare('INSERT INTO Artists (ArtistName) VALUES (?)').run(ArtistName);
        res.status(201).json({ id: info.lastInsertRowid, ArtistName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/artists/:id', (req, res) => {
    try {
        const { ArtistName } = req.body;
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

    try {
        const songId = transaction(SongTitle, Duration, ArtistIDs || []);
        res.status(201).json({ id: songId, message: 'Song created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/songs/:id', (req, res) => {
    const { SongTitle, Duration, ArtistIDs } = req.body;
    const songId = req.params.id;

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

    try {
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
        const info = db.prepare('INSERT INTO Guests (FirstName, LastName, PhoneNumber, InstagramLink) VALUES (?, ?, ?, ?)').run(FirstName, LastName, PhoneNumber, InstagramLink);
        res.status(201).json({ id: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/guests/:id', (req, res) => {
    try {
        const { FirstName, LastName, PhoneNumber, InstagramLink } = req.body;
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
            SELECT r.RequestID, r.RequestDate, s.SongID, s.SongTitle, g.GuestID, g.FullName
            FROM Requests r
            JOIN Songs s ON r.SongID = s.SongID
            JOIN Guests g ON r.GuestID = g.GuestID
            ORDER BY r.RequestDate DESC
        `).all();
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/requests', (req, res) => {
    try {
        const { SongID, GuestID } = req.body;
        const info = db.prepare('INSERT INTO Requests (SongID, GuestID) VALUES (?, ?)').run(SongID, GuestID);
        res.status(201).json({ id: info.lastInsertRowid });
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
// START SERVER
// ========================
app.listen(PORT, () => {
    console.log(\`Server is running on http://localhost:\${PORT}\`);
});
