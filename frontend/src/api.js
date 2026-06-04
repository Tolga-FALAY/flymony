/**
 * api.js — Firestore CRUD İşlemleri
 *
 * SADECE yazma (write) operasyonları burada yer alır.
 * Okuma (read) işlemleri store.js üzerinden yönetilir.
 *
 * Her getX() fonksiyonu artık YALNIZCA kendi koleksiyonunu okur;
 * çapraz koleksiyon okuması yapmaz. Bunlar store.load() tarafından
 * paralel olarak çağrılır.
 */
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
    const querySnapshot = await getDocs(collection(db, 'artists'));
    const list = [];
    querySnapshot.forEach((doc) => {
      list.push({ ArtistID: Number(doc.id), ArtistName: doc.data().ArtistName });
    });
    return list;
  },

  createArtist: async (data) => {
    const id = String(Date.now());
    await setDoc(doc(db, 'artists', id), { ArtistName: data.ArtistName });
    return { ArtistID: Number(id), ArtistName: data.ArtistName };
  },

  updateArtist: async (id, data) => {
    await updateDoc(doc(db, 'artists', String(id)), { ArtistName: data.ArtistName });
    return { message: 'Artist updated' };
  },

  deleteArtist: async (id) => {
    await deleteDoc(doc(db, 'artists', String(id)));
    return { message: 'Artist deleted' };
  },

  // ========================
  // SONGS API
  // ========================
  /** Sadece songs koleksiyonunu çeker — artist adları store'dan çözülür */
  getSongs: async () => {
    const snapshot = await getDocs(collection(db, 'songs'));
    const list = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        SongID: Number(doc.id),
        SongTitle: data.SongTitle,
        Duration: data.Duration || '',
        ArtistIDs: (data.ArtistIDs || []).map(Number),
        ArtistNames: '-' // store.load() tarafından doldurulur
      });
    });
    return list;
  },

  createSong: async (data) => {
    const id = String(Date.now());
    await setDoc(doc(db, 'songs', id), {
      SongTitle: data.SongTitle,
      Duration: data.Duration || '',
      ArtistIDs: (data.ArtistIDs || []).map(Number)
    });
    return { SongID: Number(id), message: 'Song created successfully' };
  },

  updateSong: async (id, data) => {
    await updateDoc(doc(db, 'songs', String(id)), {
      SongTitle: data.SongTitle,
      Duration: data.Duration || '',
      ArtistIDs: (data.ArtistIDs || []).map(Number)
    });
    return { message: 'Song updated successfully' };
  },

  deleteSong: async (id) => {
    await deleteDoc(doc(db, 'songs', String(id)));
    return { message: 'Song deleted' };
  },

  // ========================
  // GUESTS API
  // ========================
  /** Sadece guests koleksiyonunu çeker */
  getGuests: async () => {
    const querySnapshot = await getDocs(collection(db, 'guests'));
    const list = [];
    querySnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const firstName = data.FirstName || '';
      const lastName  = data.LastName  || '';
      list.push({
        GuestID:        Number(docSnapshot.id),
        FirstName:      firstName,
        LastName:       lastName,
        FullName:       `${firstName} ${lastName}`.trim(),
        PhoneNumber:    data.PhoneNumber    || '',
        InstagramLink:  data.InstagramLink  || '',
        Notes:          data.Notes          || '',
        ProfilePicture: data.ProfilePicture || '',
        BirthDateDay:   data.BirthDateDay   || '',
        BirthDateMonth: data.BirthDateMonth || '',
        BirthDateYear:  data.BirthDateYear  || '',
        Photos:         data.Photos         || [],
        CreatedAt:      data.CreatedAt      || new Date().toISOString(),
        UpdatedAt:      data.UpdatedAt      || new Date().toISOString()
      });
    });
    list.sort((a, b) => {
      const fc = a.FirstName.toLocaleLowerCase('tr-TR')
        .localeCompare(b.FirstName.toLocaleLowerCase('tr-TR'), 'tr');
      if (fc !== 0) return fc;
      return a.LastName.toLocaleLowerCase('tr-TR')
        .localeCompare(b.LastName.toLocaleLowerCase('tr-TR'), 'tr');
    });
    return list;
  },

  createGuest: async (data) => {
    const id = String(Date.now());
    const nowStr = new Date().toISOString();
    await setDoc(doc(db, 'guests', id), {
      FirstName:      data.FirstName,
      LastName:       data.LastName,
      PhoneNumber:    data.PhoneNumber    || '',
      InstagramLink:  data.InstagramLink  || '',
      Notes:          data.Notes          || '',
      ProfilePicture: data.ProfilePicture || '',
      BirthDateDay:   data.BirthDateDay   || '',
      BirthDateMonth: data.BirthDateMonth || '',
      BirthDateYear:  data.BirthDateYear  || '',
      Photos:         data.Photos         || [],
      CreatedAt: nowStr,
      UpdatedAt: nowStr
    });
    return { GuestID: Number(id), message: 'Guest created successfully' };
  },

  updateGuest: async (id, data) => {
    const nowStr = new Date().toISOString();
    await updateDoc(doc(db, 'guests', String(id)), {
      FirstName:      data.FirstName,
      LastName:       data.LastName,
      PhoneNumber:    data.PhoneNumber    || '',
      InstagramLink:  data.InstagramLink  || '',
      Notes:          data.Notes          || '',
      ProfilePicture: data.ProfilePicture || '',
      BirthDateDay:   data.BirthDateDay   || '',
      BirthDateMonth: data.BirthDateMonth || '',
      BirthDateYear:  data.BirthDateYear  || '',
      Photos:         data.Photos         || [],
      UpdatedAt: nowStr
    });
    return { message: 'Guest updated successfully' };
  },

  deleteGuest: async (id) => {
    await deleteDoc(doc(db, 'guests', String(id)));
    return { message: 'Guest deleted' };
  },

  // ========================
  // REQUESTS API
  // ========================
  /** Sadece requests koleksiyonunu çeker — isim çözümlemesi store'da yapılır */
  getRequests: async () => {
    const snapshot = await getDocs(collection(db, 'requests'));
    const list = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        RequestID:   Number(doc.id),
        RequestDate: data.RequestDate || new Date().toISOString(),
        SongID:      Number(data.SongID),
        GuestIDs:    (data.GuestIDs || []).map(Number),
        Status:      data.Status || 'Kayıtlı',
        Link:        data.Link   || ''
      });
    });
    list.sort((a, b) => new Date(b.RequestDate) - new Date(a.RequestDate));
    return list;
  },

  createRequest: async (data) => {
    const id = String(Date.now());
    await setDoc(doc(db, 'requests', id), {
      SongID:      Number(data.SongID),
      GuestIDs:    (data.GuestIDs || []).map(Number),
      Status:      data.Status || 'Kayıtlı',
      Link:        data.Link   || '',
      RequestDate: new Date().toISOString()
    });
    return { RequestID: Number(id), message: 'İstek başarıyla oluşturuldu' };
  },

  updateRequest: async (id, data) => {
    await updateDoc(doc(db, 'requests', String(id)), {
      SongID:   Number(data.SongID),
      GuestIDs: (data.GuestIDs || []).map(Number),
      Status:   data.Status || 'Kayıtlı',
      Link:     data.Link   || ''
    });
    return { message: 'İstek başarıyla güncellendi' };
  },

  deleteRequest: async (id) => {
    await deleteDoc(doc(db, 'requests', String(id)));
    return { message: 'Request deleted' };
  }
};
