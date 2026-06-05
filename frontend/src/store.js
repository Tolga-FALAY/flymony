/**
 * store.js — Merkezi In-Memory Veri Deposu
 *
 * Tüm Firestore koleksiyonlarını uygulama açılışında bir kez yükler.
 * CRUD işlemlerinden sonra Firestore'a tekrar okuma yapmadan bellekteki
 * veriyi günceller. Bu sayede günlük okuma sayısı dramatik ölçüde azalır.
 */
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

// ─── Özel modül-seviyesi state (dışarıdan doğrudan erişilemez) ───────────────
let _artists = [];
let _songs   = [];
let _guests  = [];
let _requests = [];
let _loaded  = false;

// ─── Yardımcı: sanatçı adlarını listeden çöz ────────────────────────────────
function _resolveArtistNames(artistIds, artistsArr) {
  return artistIds
    .map(id => artistsArr.find(a => a.ArtistID === id)?.ArtistName)
    .filter(Boolean)
    .join(', ');
}

// ─── Yardımcı: misafir adlarını listeden çöz ────────────────────────────────
function _resolveGuestNames(guestIds, guestsArr) {
  return guestIds
    .map(id => {
      const g = guestsArr.find(g => g.GuestID === id);
      return g ? `${g.FirstName} ${g.LastName}`.trim() : null;
    })
    .filter(Boolean)
    .join(', ') || '-';
}

// ─── Yardımcı: şarkı görüntüleme adını oluştur ──────────────────────────────
function _buildSongDisplay(song) {
  if (!song) return 'Bilinmeyen Şarkı';
  return song.ArtistNames && song.ArtistNames !== '-'
    ? `${song.SongTitle} (${song.ArtistNames})`
    : song.SongTitle;
}

// ─── Yardımcı: store güncellendiğini bildiren event ve localStorage önbellekleme ──
function _notify() {
  try {
    const cacheKey = 'flymony_db_cache';
    const cacheTimeKey = 'flymony_db_cache_time';
    const dataToCache = {
      artists: _artists,
      songs: _songs,
      guests: _guests,
      requests: _requests
    };
    localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
  } catch (e) {
    console.warn("LocalStorage önbelleğe kaydetme hatası:", e);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('store-updated'));
  }
}

// ─── Ana store nesnesi ───────────────────────────────────────────────────────
const store = {

  // Getter'lar — kopyalar döndürür (dışarıdan direkt mutasyon engellenir)
  get artists()  { return _artists; },
  get songs()    { return _songs; },
  get guests()   { return _guests; },
  get requests() { return _requests; },
  get isLoaded() { return _loaded; },

  // ── Tek seferlik yükleme ─────────────────────────────────────────────────
  /**
   * Tüm 4 koleksiyonu paralel olarak çeker ve bellekte saklar.
   * force=true ile zorla yeniden yükleme yapılabilir (örn: manuel "Yenile" butonu).
   */
  async load(force = false) {
    const cacheKey = 'flymony_db_cache';
    const cacheTimeKey = 'flymony_db_cache_time';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika önbellek süresi

    if (_loaded && !force) return;

    if (!force) {
      const cachedData = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(cacheTimeKey);
      if (cachedData && cachedTime && (Date.now() - Number(cachedTime) < CACHE_DURATION)) {
        try {
          const parsed = JSON.parse(cachedData);
          _artists = parsed.artists || [];
          _songs = parsed.songs || [];
          _guests = parsed.guests || [];
          _requests = parsed.requests || [];
          _loaded = true;
          _notify();
          return;
        } catch (e) {
          console.warn("Önbellekten veri okunamadı, Firestore'dan yüklenecek...", e);
        }
      }
    }

    const [artistsSnap, songsSnap, guestsSnap, requestsSnap] = await Promise.all([
      getDocs(collection(db, 'artists')),
      getDocs(collection(db, 'songs')),
      getDocs(collection(db, 'guests')),
      getDocs(collection(db, 'requests'))
    ]);

    // 1. Sanatçıları yükle
    _artists = [];
    artistsSnap.forEach(doc => {
      _artists.push({ ArtistID: Number(doc.id), ArtistName: doc.data().ArtistName });
    });

    // 2. Şarkıları yükle (sanatçı adlarını bellekte çöz)
    _songs = [];
    songsSnap.forEach(doc => {
      const data = doc.data();
      const artistIds = (data.ArtistIDs || []).map(Number);
      const artistNames = _resolveArtistNames(artistIds, _artists) || '-';
      _songs.push({
        SongID: Number(doc.id),
        SongTitle: data.SongTitle,
        Duration: data.Duration || '',
        ArtistIDs: artistIds,
        ArtistNames: artistNames
      });
    });

    // 3. Misafirleri yükle
    _guests = [];
    guestsSnap.forEach(doc => {
      const data = doc.data();
      const firstName = data.FirstName || '';
      const lastName  = data.LastName  || '';
      _guests.push({
        GuestID:        Number(doc.id),
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
    // Türkçe ada göre sırala
    _sortGuests();

    // 4. İstekleri yükle (misafir ve şarkı adlarını bellekte çöz)
    _requests = [];
    requestsSnap.forEach(doc => {
      const data    = doc.data();
      const guestIds = (data.GuestIDs || []).map(Number);
      const songId   = Number(data.SongID);
      const song     = _songs.find(s => s.SongID === songId);
      _requests.push({
        RequestID:   Number(doc.id),
        RequestDate: data.RequestDate || new Date().toISOString(),
        SongID:      songId,
        SongTitle:   _buildSongDisplay(song),
        GuestIDs:    guestIds,
        FullNames:   _resolveGuestNames(guestIds, _guests),
        Status:      data.Status || 'Kayıtlı',
        Link:        data.Link   || ''
      });
    });
    // Yeniden eskiye sırala
    _requests.sort((a, b) => new Date(b.RequestDate) - new Date(a.RequestDate));

    _loaded = true;
    _notify();
  },

  // ── Sanatçı mutasyonları ─────────────────────────────────────────────────
  addArtist(artist) {
    _artists.push(artist);
    _notify();
  },

  updateArtist(id, data) {
    const idx = _artists.findIndex(a => a.ArtistID === id);
    if (idx !== -1) {
      _artists[idx] = { ..._artists[idx], ...data };
      // Bu sanatçıyı kullanan şarkıların ArtistNames alanını güncelle
      _songs = _songs.map(s => {
        if ((s.ArtistIDs || []).includes(id)) {
          return { ...s, ArtistNames: _resolveArtistNames(s.ArtistIDs, _artists) || '-' };
        }
        return s;
      });
      // Etkilenen şarkıları kullanan isteklerin SongTitle alanını güncelle
      _requests = _requests.map(r => {
        const song = _songs.find(s => s.SongID === r.SongID);
        return song ? { ...r, SongTitle: _buildSongDisplay(song) } : r;
      });
    }
    _notify();
  },

  removeArtist(id) {
    _artists = _artists.filter(a => a.ArtistID !== id);
    _notify();
  },

  // ── Şarkı mutasyonları ───────────────────────────────────────────────────
  addSong(song) {
    // Gelen song nesnesinde ArtistNames zaten çözülmüş olmalı
    _songs.push(song);
    _songs.sort((a, b) =>
      (a.SongTitle || '').toLocaleLowerCase('tr-TR')
        .localeCompare((b.SongTitle || '').toLocaleLowerCase('tr-TR'), 'tr')
    );
    _notify();
  },

  updateSong(id, updatedSong) {
    const idx = _songs.findIndex(s => s.SongID === id);
    if (idx !== -1) {
      _songs[idx] = { ..._songs[idx], ...updatedSong };
      // Bu şarkıyı kullanan isteklerin SongTitle alanını güncelle
      _requests = _requests.map(r =>
        r.SongID === id ? { ...r, SongTitle: _buildSongDisplay(_songs[idx]) } : r
      );
    }
    _notify();
  },

  removeSong(id) {
    _songs = _songs.filter(s => s.SongID !== id);
    _notify();
  },

  // ── Misafir mutasyonları ─────────────────────────────────────────────────
  addGuest(guest) {
    _guests.push(guest);
    _sortGuests();
    _notify();
  },

  updateGuest(id, data) {
    const idx = _guests.findIndex(g => g.GuestID === id);
    if (idx !== -1) {
      _guests[idx] = { ..._guests[idx], ...data };
      _sortGuests();
      // Bu misafiri kullanan isteklerin FullNames alanını güncelle
      _requests = _requests.map(r => {
        if ((r.GuestIDs || []).includes(id)) {
          return { ...r, FullNames: _resolveGuestNames(r.GuestIDs, _guests) };
        }
        return r;
      });
    }
    _notify();
  },

  removeGuest(id) {
    _guests = _guests.filter(g => g.GuestID !== id);
    _notify();
  },

  // ── İstek mutasyonları ───────────────────────────────────────────────────
  addRequest(request) {
    _requests.unshift(request); // en yeni başa ekle
    _notify();
  },

  updateRequest(id, updatedRequest) {
    const idx = _requests.findIndex(r => r.RequestID === id);
    if (idx !== -1) {
      _requests[idx] = { ..._requests[idx], ...updatedRequest };
    }
    _notify();
  },

  removeRequest(id) {
    _requests = _requests.filter(r => r.RequestID !== id);
    _notify();
  },

  // ── Yardımcı çözümleme metodları ────────────────────────────────────────
  resolveSongDisplay(songId) {
    return _buildSongDisplay(_songs.find(s => s.SongID === songId));
  },

  resolveGuestNames(guestIds) {
    return _resolveGuestNames(guestIds, _guests);
  },

  resolveArtistNames(artistIds) {
    return _resolveArtistNames(artistIds, _artists);
  }
};

// ─── Özel yardımcı: misafir listesini Türkçe adına göre sırala ──────────────
function _sortGuests() {
  _guests.sort((a, b) => {
    const fc = (a.FirstName || '').toLocaleLowerCase('tr-TR')
      .localeCompare((b.FirstName || '').toLocaleLowerCase('tr-TR'), 'tr');
    if (fc !== 0) return fc;
    return (a.LastName || '').toLocaleLowerCase('tr-TR')
      .localeCompare((b.LastName || '').toLocaleLowerCase('tr-TR'), 'tr');
  });
}

export default store;
