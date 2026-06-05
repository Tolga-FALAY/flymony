import https from 'https';
import db, { initializeDB } from './database.js';

initializeDB();

function getCollection(collection) {
  return new Promise((resolve, reject) => {
    const url = `https://firestore.googleapis.com/v1/projects/flymony2026/databases/(default)/documents/${collection}?pageSize=1000`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
          } else {
            resolve(json.documents || []);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function parseValue(val) {
  if (val.stringValue !== undefined) return val.stringValue;
  if (val.integerValue !== undefined) return Number(val.integerValue);
  if (val.doubleValue !== undefined) return Number(val.doubleValue);
  if (val.booleanValue !== undefined) return val.booleanValue;
  if (val.nullValue !== undefined) return null;
  if (val.arrayValue !== undefined) {
    return (val.arrayValue.values || []).map(parseValue);
  }
  if (val.mapValue !== undefined) {
    const obj = {};
    for (const key in val.mapValue.fields) {
      obj[key] = parseValue(val.mapValue.fields[key]);
    }
    return obj;
  }
  return null;
}

function parseDoc(doc) {
  const id = doc.name.split('/').pop();
  const obj = { id };
  for (const key in doc.fields) {
    obj[key] = parseValue(doc.fields[key]);
  }
  return obj;
}

async function run() {
  console.log("Starting Firebase to SQLite migration...");

  try {
    // 1. Migrate Artists
    console.log("Fetching artists from Firestore...");
    const rawArtists = await getCollection('artists');
    const artists = rawArtists.map(parseDoc);
    console.log(`Fetched ${artists.length} artists.`);

    db.transaction(() => {
      // Clear artists table
      db.prepare('DELETE FROM Artists').run();
      const insert = db.prepare('INSERT INTO Artists (ArtistID, ArtistName) VALUES (?, ?)');
      for (const a of artists) {
        insert.run(Number(a.id), a.ArtistName);
      }
    })();
    console.log("Artists migrated.");

    // 2. Migrate Guests
    console.log("Fetching guests from Firestore...");
    const rawGuests = await getCollection('guests');
    const guests = rawGuests.map(parseDoc);
    console.log(`Fetched ${guests.length} guests.`);

    db.transaction(() => {
      db.prepare('DELETE FROM Guests').run();
      const insert = db.prepare(`
        INSERT INTO Guests (
          GuestID, FirstName, LastName, PhoneNumber, InstagramLink, Notes, 
          ProfilePicture, BirthDateDay, BirthDateMonth, BirthDateYear, Photos, CreatedAt, UpdatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const g of guests) {
        insert.run(
          Number(g.id),
          g.FirstName || "",
          g.LastName || "",
          g.PhoneNumber || "",
          g.InstagramLink || "",
          g.Notes || "",
          g.ProfilePicture || "",
          g.BirthDateDay ? Number(g.BirthDateDay) : null,
          g.BirthDateMonth ? Number(g.BirthDateMonth) : null,
          g.BirthDateYear ? Number(g.BirthDateYear) : null,
          g.Photos ? JSON.stringify(g.Photos) : '[]',
          g.CreatedAt || new Date().toISOString(),
          g.UpdatedAt || new Date().toISOString()
        );
      }
    })();
    console.log("Guests migrated.");

    // 3. Migrate Songs & Song_Artists
    console.log("Fetching songs from Firestore...");
    const rawSongs = await getCollection('songs');
    const songs = rawSongs.map(parseDoc);
    console.log(`Fetched ${songs.length} songs.`);

    db.transaction(() => {
      db.prepare('DELETE FROM Songs').run();
      db.prepare('DELETE FROM Song_Artists').run();
      const insertSong = db.prepare('INSERT INTO Songs (SongID, SongTitle, Duration) VALUES (?, ?, ?)');
      const insertSongArtist = db.prepare('INSERT INTO Song_Artists (SongID, ArtistID) VALUES (?, ?)');
      
      for (const s of songs) {
        insertSong.run(Number(s.id), s.SongTitle || "", s.Duration || "");
        const artistIds = s.ArtistIDs || [];
        for (const aid of artistIds) {
          insertSongArtist.run(Number(s.id), Number(aid));
        }
      }
    })();
    console.log("Songs migrated.");

    // 4. Migrate Requests & Request_Guests
    console.log("Fetching requests from Firestore...");
    const rawRequests = await getCollection('requests');
    const requests = rawRequests.map(parseDoc);
    console.log(`Fetched ${requests.length} requests.`);

    db.transaction(() => {
      db.prepare('DELETE FROM Requests').run();
      db.prepare('DELETE FROM Request_Guests').run();
      const insertRequest = db.prepare('INSERT INTO Requests (RequestID, SongID, RequestDate, Status, Link) VALUES (?, ?, ?, ?, ?)');
      const insertRequestGuest = db.prepare('INSERT INTO Request_Guests (RequestID, GuestID) VALUES (?, ?)');
      
      for (const r of requests) {
        const reqDate = r.RequestDate || new Date().toISOString();
        insertRequest.run(
          Number(r.id),
          Number(r.SongID),
          reqDate,
          r.Status || 'Kayıtlı',
          r.Link || ''
        );
        const guestIds = r.GuestIDs || [];
        for (const gid of guestIds) {
          insertRequestGuest.run(Number(r.id), Number(gid));
        }
      }
    })();
    console.log("Requests migrated.");

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

run();
