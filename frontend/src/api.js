import { db } from './firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';

const notifyUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('db-update'));
  }
};

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
    notifyUpdate();
    return { ArtistID: Number(id), ArtistName: data.ArtistName };
  },
  
  updateArtist: async (id, data) => {
    await updateDoc(doc(db, "artists", String(id)), {
      ArtistName: data.ArtistName
    });
    notifyUpdate();
    return { message: 'Artist updated' };
  },
  
  deleteArtist: async (id) => {
    await deleteDoc(doc(db, "artists", String(id)));
    notifyUpdate();
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
    notifyUpdate();
    return { SongID: Number(id), message: 'Song created successfully' };
  },
  
  updateSong: async (id, data) => {
    await updateDoc(doc(db, "songs", String(id)), {
      SongTitle: data.SongTitle,
      Duration: data.Duration || "",
      ArtistIDs: (data.ArtistIDs || []).map(Number)
    });
    notifyUpdate();
    return { message: 'Song updated successfully' };
  },
  
  deleteSong: async (id) => {
    await deleteDoc(doc(db, "songs", String(id)));
    notifyUpdate();
    return { message: 'Song deleted' };
  },

  // ========================
  // GUESTS API
  // ========================
  getGuests: async () => {
    const querySnapshot = await getDocs(collection(db, "guests"));
    const list = [];
    const nowStr = new Date().toISOString();
    
    for (const docSnapshot of querySnapshot.docs) {
      const data = docSnapshot.data();
      const docId = docSnapshot.id;
      
      let needsUpdate = false;
      const updateData = {};
      
      if (!data.CreatedAt) {
        updateData.CreatedAt = nowStr;
        needsUpdate = true;
      }
      if (!data.UpdatedAt) {
        updateData.UpdatedAt = nowStr;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        updateDoc(doc(db, "guests", docId), updateData).catch(err => 
          console.error("Migration error for guest " + docId, err)
        );
      }

      const firstName = data.FirstName || "";
      const lastName = data.LastName || "";
      list.push({
        GuestID: Number(docId),
        FirstName: firstName,
        LastName: lastName,
        FullName: `${firstName} ${lastName}`.trim(),
        PhoneNumber: data.PhoneNumber || "",
        InstagramLink: data.InstagramLink || "",
        Notes: data.Notes || "",
        ProfilePicture: data.ProfilePicture || "",
        BirthDateDay: data.BirthDateDay || "",
        BirthDateMonth: data.BirthDateMonth || "",
        BirthDateYear: data.BirthDateYear || "",
        Photos: data.Photos || [],
        CreatedAt: data.CreatedAt || updateData.CreatedAt || nowStr,
        UpdatedAt: data.UpdatedAt || updateData.UpdatedAt || nowStr
      });
    }
    // Sort by FirstName and LastName ascending (Turkish locale aware)
    list.sort((a, b) => {
      const fNameCompare = a.FirstName.toLocaleLowerCase('tr-TR').localeCompare(b.FirstName.toLocaleLowerCase('tr-TR'), 'tr');
      if (fNameCompare !== 0) return fNameCompare;
      return a.LastName.toLocaleLowerCase('tr-TR').localeCompare(b.LastName.toLocaleLowerCase('tr-TR'), 'tr');
    });
    return list;
  },
  
  createGuest: async (data) => {
    const id = String(Date.now());
    const nowStr = new Date().toISOString();
    await setDoc(doc(db, "guests", id), {
      FirstName: data.FirstName,
      LastName: data.LastName,
      PhoneNumber: data.PhoneNumber || "",
      InstagramLink: data.InstagramLink || "",
      Notes: data.Notes || "",
      ProfilePicture: data.ProfilePicture || "",
      BirthDateDay: data.BirthDateDay || "",
      BirthDateMonth: data.BirthDateMonth || "",
      BirthDateYear: data.BirthDateYear || "",
      Photos: data.Photos || [],
      CreatedAt: nowStr,
      UpdatedAt: nowStr
    });
    notifyUpdate();
    return { GuestID: Number(id), message: 'Guest created successfully' };
  },
  
  updateGuest: async (id, data) => {
    const nowStr = new Date().toISOString();
    await updateDoc(doc(db, "guests", String(id)), {
      FirstName: data.FirstName,
      LastName: data.LastName,
      PhoneNumber: data.PhoneNumber || "",
      InstagramLink: data.InstagramLink || "",
      Notes: data.Notes || "",
      ProfilePicture: data.ProfilePicture || "",
      BirthDateDay: data.BirthDateDay || "",
      BirthDateMonth: data.BirthDateMonth || "",
      BirthDateYear: data.BirthDateYear || "",
      Photos: data.Photos || [],
      UpdatedAt: nowStr
    });
    notifyUpdate();
    return { message: 'Guest updated successfully' };
  },
  
  deleteGuest: async (id) => {
    await deleteDoc(doc(db, "guests", String(id)));
    notifyUpdate();
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

    // Fetch all artists to resolve names in memory
    const artistsSnapshot = await getDocs(collection(db, "artists"));
    const artistsMap = {};
    artistsSnapshot.forEach((doc) => {
      artistsMap[doc.id] = doc.data().ArtistName;
    });

    // Fetch all songs to resolve titles and artist names in memory
    const songsSnapshot = await getDocs(collection(db, "songs"));
    const songsMap = {};
    songsSnapshot.forEach((doc) => {
      const data = doc.data();
      const artistIds = data.ArtistIDs || [];
      const artistNames = artistIds.map(aid => artistsMap[String(aid)]).filter(Boolean).join(", ");
      songsMap[doc.id] = data.SongTitle + (artistNames ? ` (${artistNames})` : '');
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
        FullNames: fullNames || "-",
        Status: data.Status || "Kayıtlı",
        Link: data.Link || ""
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
      Status: data.Status || 'Kayıtlı',
      Link: data.Link || '',
      RequestDate: new Date().toISOString()
    });
    notifyUpdate();
    return { RequestID: Number(id), message: 'İstek başarıyla oluşturuldu' };
  },
  
  updateRequest: async (id, data) => {
    await updateDoc(doc(db, "requests", String(id)), {
      SongID: Number(data.SongID),
      GuestIDs: (data.GuestIDs || []).map(Number),
      Status: data.Status || 'Kayıtlı',
      Link: data.Link || ''
    });
    notifyUpdate();
    return { message: 'İstek başarıyla güncellendi' };
  },
  
  deleteRequest: async (id) => {
    await deleteDoc(doc(db, "requests", String(id)));
    notifyUpdate();
    return { message: 'Request deleted' };
  }
};
