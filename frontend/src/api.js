import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';

export const api = {
  // ========================
  // ARTISTS API
  // ========================
  getArtists: async () => {
    const querySnapshot = await getDocs(collection(db, "artists"));
    const list = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        ArtistID: Number(doc.id),
        ArtistName: data.ArtistName
      });
    });
    return list;
  },
  
  createArtist: async (data) => {
    const id = String(Date.now());
    await setDoc(doc(db, "artists", id), {
      ArtistName: data.ArtistName
    });
    return { ArtistID: Number(id), ArtistName: data.ArtistName };
  },
  
  updateArtist: async (id, data) => {
    await updateDoc(doc(db, "artists", String(id)), {
      ArtistName: data.ArtistName
    });
    return { message: 'Artist updated' };
  },
  
  deleteArtist: async (id) => {
    await deleteDoc(doc(db, "artists", String(id)));
    return { message: 'Artist deleted' };
  },

  // ========================
  // SONGS API
  // ========================
  getSongs: async () => {
    // Fetch all artists to resolve names in memory
    const artistsSnapshot = await getDocs(collection(db, "artists"));
    const artistsMap = {};
    artistsSnapshot.forEach((doc) => {
      artistsMap[doc.id] = doc.data().ArtistName;
    });

    const songsSnapshot = await getDocs(collection(db, "songs"));
    const list = [];
    songsSnapshot.forEach((doc) => {
      const data = doc.data();
      const artistIds = data.ArtistIDs || [];
      const artistNames = artistIds.map(aid => artistsMap[String(aid)]).filter(Boolean).join(", ");
      list.push({
        SongID: Number(doc.id),
        SongTitle: data.SongTitle,
        Duration: data.Duration || "",
        ArtistIDs: artistIds.map(Number),
        ArtistNames: artistNames || "-"
      });
    });
    return list;
  },
  
  createSong: async (data) => {
    const id = String(Date.now());
    await setDoc(doc(db, "songs", id), {
      SongTitle: data.SongTitle,
      Duration: data.Duration || "",
      ArtistIDs: (data.ArtistIDs || []).map(Number)
    });
    return { SongID: Number(id), message: 'Song created successfully' };
  },
  
  updateSong: async (id, data) => {
    await updateDoc(doc(db, "songs", String(id)), {
      SongTitle: data.SongTitle,
      Duration: data.Duration || "",
      ArtistIDs: (data.ArtistIDs || []).map(Number)
    });
    return { message: 'Song updated successfully' };
  },
  
  deleteSong: async (id) => {
    await deleteDoc(doc(db, "songs", String(id)));
    return { message: 'Song deleted' };
  },

  // ========================
  // GUESTS API
  // ========================
  getGuests: async () => {
    const querySnapshot = await getDocs(collection(db, "guests"));
    const list = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const firstName = data.FirstName || "";
      const lastName = data.LastName || "";
      list.push({
        GuestID: Number(doc.id),
        FirstName: firstName,
        LastName: lastName,
        FullName: `${firstName} ${lastName}`.trim(),
        PhoneNumber: data.PhoneNumber || "",
        InstagramLink: data.InstagramLink || ""
      });
    });
    return list;
  },
  
  createGuest: async (data) => {
    const id = String(Date.now());
    await setDoc(doc(db, "guests", id), {
      FirstName: data.FirstName,
      LastName: data.LastName,
      PhoneNumber: data.PhoneNumber || "",
      InstagramLink: data.InstagramLink || ""
    });
    return { GuestID: Number(id), message: 'Guest created successfully' };
  },
  
  updateGuest: async (id, data) => {
    await updateDoc(doc(db, "guests", String(id)), {
      FirstName: data.FirstName,
      LastName: data.LastName,
      PhoneNumber: data.PhoneNumber || "",
      InstagramLink: data.InstagramLink || ""
    });
    return { message: 'Guest updated successfully' };
  },
  
  deleteGuest: async (id) => {
    await deleteDoc(doc(db, "guests", String(id)));
    return { message: 'Guest deleted' };
  },

  // ========================
  // REQUESTS API
  // ========================
  getRequests: async () => {
    // Fetch all guests to resolve names in memory
    const guestsSnapshot = await getDocs(collection(db, "guests"));
    const guestsMap = {};
    guestsSnapshot.forEach((doc) => {
      const data = doc.data();
      guestsMap[doc.id] = `${data.FirstName} ${data.LastName}`.trim();
    });

    // Fetch all songs to resolve titles in memory
    const songsSnapshot = await getDocs(collection(db, "songs"));
    const songsMap = {};
    songsSnapshot.forEach((doc) => {
      songsMap[doc.id] = doc.data().SongTitle;
    });

    const requestsSnapshot = await getDocs(collection(db, "requests"));
    const list = [];
    requestsSnapshot.forEach((doc) => {
      const data = doc.data();
      const guestIds = data.GuestIDs || [];
      const songId = String(data.SongID);
      const fullNames = guestIds.map(gid => guestsMap[String(gid)]).filter(Boolean).join(", ");
      
      list.push({
        RequestID: Number(doc.id),
        RequestDate: data.RequestDate || new Date().toISOString(),
        SongID: Number(data.SongID),
        SongTitle: songsMap[songId] || "Bilinmeyen Şarkı",
        GuestIDs: guestIds.map(Number),
        FullNames: fullNames || "-"
      });
    });
    
    // Sort by Date descending (newest first)
    list.sort((a, b) => new Date(b.RequestDate) - new Date(a.RequestDate));
    return list;
  },
  
  createRequest: async (data) => {
    const id = String(Date.now());
    await setDoc(doc(db, "requests", id), {
      SongID: Number(data.SongID),
      GuestIDs: (data.GuestIDs || []).map(Number),
      RequestDate: new Date().toISOString()
    });
    return { RequestID: Number(id), message: 'İstek başarıyla oluşturuldu' };
  },
  
  updateRequest: async (id, data) => {
    await updateDoc(doc(db, "requests", String(id)), {
      SongID: Number(data.SongID),
      GuestIDs: (data.GuestIDs || []).map(Number)
    });
    return { message: 'İstek başarıyla güncellendi' };
  },
  
  deleteRequest: async (id) => {
    await deleteDoc(doc(db, "requests", String(id)));
    return { message: 'Request deleted' };
  }
};
