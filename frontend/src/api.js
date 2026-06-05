/**
 * api.js — Firestore & REST API CRUD İşlemleri
 *
 * BACKEND_MODE = 'rest' olduğunda Express backend REST API'yi çağırır.
 * BACKEND_MODE = 'firebase' olduğunda doğrudan Firestore'u çağırır.
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

export const BACKEND_MODE = 'rest'; // 'firebase' veya 'rest'

const API_BASE_URL = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:5000/api'
  : '/api';

async function request(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP hata kodu! Durum: ${response.status}`);
  }
  return response.json();
}

export const api = {
  // ========================
  // ARTISTS API
  // ========================
  getArtists: async () => {
    if (BACKEND_MODE === 'firebase') {
      const querySnapshot = await getDocs(collection(db, 'artists'));
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ ArtistID: Number(doc.id), ArtistName: doc.data().ArtistName });
      });
      return list;
    } else {
      const list = await request('/artists');
      return list.map(a => ({ ArtistID: Number(a.ArtistID), ArtistName: a.ArtistName }));
    }
  },

  createArtist: async (data) => {
    if (BACKEND_MODE === 'firebase') {
      const id = String(Date.now());
      await setDoc(doc(db, 'artists', id), { ArtistName: data.ArtistName });
      return { ArtistID: Number(id), ArtistName: data.ArtistName };
    } else {
      const result = await request('/artists', 'POST', data);
      return { ArtistID: Number(result.id), ArtistName: result.ArtistName };
    }
  },

  updateArtist: async (id, data) => {
    if (BACKEND_MODE === 'firebase') {
      await updateDoc(doc(db, 'artists', String(id)), { ArtistName: data.ArtistName });
      return { message: 'Artist updated' };
    } else {
      return request(`/artists/${id}`, 'PUT', data);
    }
  },

  deleteArtist: async (id) => {
    if (BACKEND_MODE === 'firebase') {
      await deleteDoc(doc(db, 'artists', String(id)));
      return { message: 'Artist deleted' };
    } else {
      return request(`/artists/${id}`, 'DELETE');
    }
  },

  // ========================
  // SONGS API
  // ========================
  getSongs: async () => {
    if (BACKEND_MODE === 'firebase') {
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
    } else {
      const list = await request('/songs');
      return list.map(s => ({
        SongID: Number(s.SongID),
        SongTitle: s.SongTitle,
        Duration: s.Duration || '',
        ArtistIDs: (s.ArtistIDs || []).map(Number),
        ArtistNames: s.ArtistNames || '-'
      }));
    }
  },

  createSong: async (data) => {
    if (BACKEND_MODE === 'firebase') {
      const id = String(Date.now());
      await setDoc(doc(db, 'songs', id), {
        SongTitle: data.SongTitle,
        Duration: data.Duration || '',
        ArtistIDs: (data.ArtistIDs || []).map(Number)
      });
      return { SongID: Number(id), message: 'Song created successfully' };
    } else {
      const result = await request('/songs', 'POST', data);
      return { SongID: Number(result.id), message: result.message };
    }
  },

  updateSong: async (id, data) => {
    if (BACKEND_MODE === 'firebase') {
      await updateDoc(doc(db, 'songs', String(id)), {
        SongTitle: data.SongTitle,
        Duration: data.Duration || '',
        ArtistIDs: (data.ArtistIDs || []).map(Number)
      });
      return { message: 'Song updated successfully' };
    } else {
      return request(`/songs/${id}`, 'PUT', data);
    }
  },

  deleteSong: async (id) => {
    if (BACKEND_MODE === 'firebase') {
      await deleteDoc(doc(db, 'songs', String(id)));
      return { message: 'Song deleted' };
    } else {
      return request(`/songs/${id}`, 'DELETE');
    }
  },

  // ========================
  // GUESTS API
  // ========================
  getGuests: async () => {
    if (BACKEND_MODE === 'firebase') {
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
    } else {
      const list = await request('/guests');
      return list.map(g => ({
        GuestID:        Number(g.GuestID),
        FirstName:      g.FirstName || '',
        LastName:       g.LastName || '',
        FullName:       (g.FullName || `${g.FirstName || ""} ${g.LastName || ""}`).trim(),
        PhoneNumber:    g.PhoneNumber || '',
        InstagramLink:  g.InstagramLink || '',
        Notes:          g.Notes || '',
        ProfilePicture: g.ProfilePicture || '',
        BirthDateDay:   g.BirthDateDay || '',
        BirthDateMonth: g.BirthDateMonth || '',
        BirthDateYear:  g.BirthDateYear || '',
        Photos:         g.Photos || [],
        CreatedAt:      g.CreatedAt || '',
        UpdatedAt:      g.UpdatedAt || ''
      }));
    }
  },

  createGuest: async (data) => {
    if (BACKEND_MODE === 'firebase') {
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
    } else {
      const result = await request('/guests', 'POST', data);
      return { GuestID: Number(result.id), message: 'Guest created successfully' };
    }
  },

  updateGuest: async (id, data) => {
    if (BACKEND_MODE === 'firebase') {
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
    } else {
      return request(`/guests/${id}`, 'PUT', data);
    }
  },

  deleteGuest: async (id) => {
    if (BACKEND_MODE === 'firebase') {
      await deleteDoc(doc(db, 'guests', String(id)));
      return { message: 'Guest deleted' };
    } else {
      return request(`/guests/${id}`, 'DELETE');
    }
  },

  // ========================
  // REQUESTS API
  // ========================
  getRequests: async () => {
    if (BACKEND_MODE === 'firebase') {
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
    } else {
      const list = await request('/requests');
      return list.map(r => ({
        RequestID:   Number(r.RequestID),
        RequestDate: r.RequestDate || '',
        SongID:      Number(r.SongID),
        GuestIDs:    (r.GuestIDs || []).map(Number),
        Status:      r.Status || 'Kayıtlı',
        Link:        r.Link || ''
      }));
    }
  },

  createRequest: async (data) => {
    if (BACKEND_MODE === 'firebase') {
      const id = String(Date.now());
      await setDoc(doc(db, 'requests', id), {
        SongID:      Number(data.SongID),
        GuestIDs:    (data.GuestIDs || []).map(Number),
        Status:      data.Status || 'Kayıtlı',
        Link:        data.Link   || '',
        RequestDate: new Date().toISOString()
      });
      return { RequestID: Number(id), message: 'İstek başarıyla oluşturuldu' };
    } else {
      const result = await request('/requests', 'POST', data);
      return { RequestID: Number(result.id), message: result.message };
    }
  },

  updateRequest: async (id, data) => {
    if (BACKEND_MODE === 'firebase') {
      await updateDoc(doc(db, 'requests', String(id)), {
        SongID:   Number(data.SongID),
        GuestIDs: (data.GuestIDs || []).map(Number),
        Status:   data.Status || 'Kayıtlı',
        Link:     data.Link   || ''
      });
      return { message: 'İstek başarıyla güncellendi' };
    } else {
      return request(`/requests/${id}`, 'PUT', data);
    }
  },

  deleteRequest: async (id) => {
    if (BACKEND_MODE === 'firebase') {
      await deleteDoc(doc(db, 'requests', String(id)));
      return { message: 'Request deleted' };
    } else {
      return request(`/requests/${id}`, 'DELETE');
    }
  }
};
