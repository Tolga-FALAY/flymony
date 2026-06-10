/**
 * api.js — Express Backend REST API CRUD İşlemleri
 */

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
    const list = await request('/artists');
    return list.map(a => ({ ArtistID: Number(a.ArtistID), ArtistName: a.ArtistName }));
  },

  createArtist: async (data) => {
    const result = await request('/artists', 'POST', data);
    return { ArtistID: Number(result.id), ArtistName: result.ArtistName };
  },

  updateArtist: async (id, data) => {
    return request(`/artists/${id}`, 'PUT', data);
  },

  deleteArtist: async (id) => {
    return request(`/artists/${id}`, 'DELETE');
  },

  // ========================
  // SONGS API
  // ========================
  getSongs: async () => {
    const list = await request('/songs');
    return list.map(s => ({
      SongID: Number(s.SongID),
      SongTitle: s.SongTitle,
      Duration: s.Duration || '',
      SongYear: s.SongYear || '',
      Lyrics: s.Lyrics || '',
      AudioPath: s.AudioPath || '',
      OriginalKey: s.OriginalKey || '',
      ArtistIDs: (s.ArtistIDs || []).map(Number),
      ArtistNames: s.ArtistNames || '-'
    }));
  },

  createSong: async (data) => {
    const result = await request('/songs', 'POST', data);
    return { SongID: Number(result.id), message: result.message };
  },

  updateSong: async (id, data) => {
    return request(`/songs/${id}`, 'PUT', data);
  },

  deleteSong: async (id) => {
    return request(`/songs/${id}`, 'DELETE');
  },

  // ========================
  // GUESTS API
  // ========================
  getGuests: async () => {
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
  },

  createGuest: async (data) => {
    const result = await request('/guests', 'POST', data);
    return { GuestID: Number(result.id), message: 'Guest created successfully' };
  },

  updateGuest: async (id, data) => {
    return request(`/guests/${id}`, 'PUT', data);
  },

  deleteGuest: async (id) => {
    return request(`/guests/${id}`, 'DELETE');
  },

  // ========================
  // REQUESTS API
  // ========================
  getRequests: async () => {
    const list = await request('/requests');
    return list.map(r => ({
      RequestID:   Number(r.RequestID),
      RequestDate: r.RequestDate || '',
      SongID:      Number(r.SongID),
      GuestIDs:    (r.GuestIDs || []).map(Number),
      Status:      r.Status || 'Kayıtlı',
      Link:        r.Link || '',
      Vardi:       r.Vardi ? true : false,
      Notes:       r.Notes || '',
      StatusChangeDate: r.StatusChangeDate || ''
    }));
  },

  createRequest: async (data) => {
    const result = await request('/requests', 'POST', data);
    return { RequestID: Number(result.id), message: result.message };
  },

  updateRequest: async (id, data) => {
    return request(`/requests/${id}`, 'PUT', data);
  },

  deleteRequest: async (id) => {
    return request(`/requests/${id}`, 'DELETE');
  }
};
