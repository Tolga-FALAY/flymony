import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import store from '../store';
import { hasLyricsContent } from '../utils/chordUtils';

export default function Gigs() {
  const [gigs, setGigs] = useState([]);
  const [songs, setSongs] = useState([]);
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGig, setEditingGig] = useState(null);

  // Filter States
  const [filterSearch, setFilterSearch] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Gig Editor Form State
  const [formData, setFormData] = useState({
    VenueName: '',
    GigDate: '',
    Notes: '',
    Photos: [],
    Videos: [],
    Songs: [], // { SongID, SortOrder, IsPlayed, IsRequest }
    Guests: [] // { GuestID, TableName }
  });

  // Editor Autocomplete & Add lists search
  const [songSearchText, setSongSearchText] = useState('');
  const [guestSearchText, setGuestSearchText] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  
  // Selection states for Grouping / Relationship inside tables
  const [selectedGroupGuests, setSelectedGroupGuests] = useState({}); // { table_name: Set(GuestIDs) }

  // Active Performance ("Sahnem") State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveGig, setLiveGig] = useState(null);
  const [liveSongIndex, setLiveSongIndex] = useState(-1);
  const [liveFontSize, setLiveFontSize] = useState(1.1);
  const [liveTheme, setLiveTheme] = useState('dark');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState([]);

  // Touch Swipe for Chord Slider
  const touchStartX = useRef(null);
  const touchEndX = useRef(null);

  useEffect(() => {
    const syncFromStore = () => {
      setGigs([...store.gigs]);
      setSongs([...store.songs]);
      setGuests([...store.guests]);
    };
    if (store.isLoaded) {
      syncFromStore();
    } else {
      store.load().then(syncFromStore);
    }
    window.addEventListener('store-updated', syncFromStore);
    return () => window.removeEventListener('store-updated', syncFromStore);
  }, []);

  // HTML5 Canvas client-side image compression
  const compressImage = (file, maxWidth, maxHeight, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(file.type || 'image/jpeg', quality));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const promises = files.map(file => compressImage(file, 800, 800, 0.75));
    const compressedImages = await Promise.all(promises);
    setFormData(prev => ({
      ...prev,
      Photos: [...prev.Photos, ...compressedImages]
    }));
    e.target.value = '';
  };

  const removePhoto = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      Photos: prev.Photos.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const addVideoLink = () => {
    if (!newVideoUrl.trim()) return;
    setFormData(prev => ({
      ...prev,
      Videos: [...prev.Videos, newVideoUrl.trim()]
    }));
    setNewVideoUrl('');
  };

  const removeVideo = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      Videos: prev.Videos.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleEdit = (gig) => {
    setEditingGig(gig);
    setFormData({
      VenueName: gig.VenueName,
      GigDate: gig.GigDate,
      Notes: gig.Notes || '',
      Photos: gig.Photos || [],
      Videos: gig.Videos || [],
      Songs: gig.Songs ? gig.Songs.map(s => ({
        SongID: Number(s.SongID),
        SortOrder: Number(s.SortOrder),
        IsPlayed: Number(s.IsPlayed),
        IsRequest: Number(s.IsRequest)
      })) : [],
      Guests: gig.Guests ? gig.Guests.map(g => ({
        GuestID: Number(g.GuestID),
        TableName: g.TableName || ''
      })) : []
    });
    setSongSearchText('');
    setGuestSearchText('');
    setSelectedGroupGuests({});
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setEditingGig(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      VenueName: '',
      GigDate: today,
      Notes: '',
      Photos: [],
      Videos: [],
      Songs: [],
      Guests: []
    });
    setSongSearchText('');
    setGuestSearchText('');
    setSelectedGroupGuests({});
    setIsModalOpen(true);
  };

  const handleDelete = async (gigId) => {
    if (!confirm('Bu sahne gecesi kaydını tamamen silmek istediğinizden emin misiniz?')) return;
    try {
      await api.deleteGig(gigId);
      store.removeGig(gigId);
    } catch (err) {
      alert('Silme hatası: ' + err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.VenueName.trim() || !formData.GigDate) {
      alert('Lütfen mekân ve tarih bilgilerini doldurun.');
      return;
    }

    try {
      if (editingGig) {
        await api.updateGig(editingGig.GigID, formData);
        // Refresh local store
        const refreshed = await api.getGigs();
        const updated = refreshed.find(g => g.GigID === editingGig.GigID);
        if (updated) {
          store.updateGig(editingGig.GigID, updated);
        }
      } else {
        const result = await api.createGig(formData);
        const refreshed = await api.getGigs();
        const created = refreshed.find(g => g.GigID === result.GigID);
        if (created) {
          store.addGig(created);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Kaydetme hatası: ' + err.message);
    }
  };

  // --- Song management inside Gig Editor ---
  const addSongToGig = (song) => {
    if (formData.Songs.some(s => s.SongID === song.SongID)) {
      alert('Bu şarkı repertuvarda zaten ekli.');
      return;
    }
    const newSongEntry = {
      SongID: song.SongID,
      SortOrder: formData.Songs.length + 1,
      IsPlayed: 0,
      IsRequest: 0
    };
    setFormData(prev => ({
      ...prev,
      Songs: [...prev.Songs, newSongEntry]
    }));
    setSongSearchText('');
  };

  const removeSongFromGig = (songId) => {
    const filtered = formData.Songs.filter(s => s.SongID !== songId);
    // Recalculate SortOrders
    const recalculated = filtered.map((s, idx) => ({ ...s, SortOrder: idx + 1 }));
    setFormData(prev => ({
      ...prev,
      Songs: recalculated
    }));
  };

  const swapSongs = (idxA, idxB) => {
    if (idxA < 0 || idxA >= formData.Songs.length || idxB < 0 || idxB >= formData.Songs.length) return;
    const list = [...formData.Songs];
    const temp = list[idxA];
    list[idxA] = list[idxB];
    list[idxB] = temp;
    const recalculated = list.map((s, idx) => ({ ...s, SortOrder: idx + 1 }));
    setFormData(prev => ({
      ...prev,
      Songs: recalculated
    }));
  };

  const moveSongToOrder = (currentIndex, targetOrderVal) => {
    const targetOrder = parseInt(targetOrderVal);
    if (isNaN(targetOrder) || targetOrder < 1 || targetOrder > formData.Songs.length) return;
    const targetIdx = targetOrder - 1;
    if (currentIndex === targetIdx) return;

    const list = [...formData.Songs];
    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIdx, 0, moved);

    const recalculated = list.map((s, idx) => ({ ...s, SortOrder: idx + 1 }));
    setFormData(prev => ({
      ...prev,
      Songs: recalculated
    }));
  };

  // --- Guest & Table management inside Gig Editor ---
  const addGuestToGig = (guest) => {
    if (formData.Guests.some(g => g.GuestID === guest.GuestID)) {
      alert('Bu misafir zaten ekli.');
      return;
    }
    const newGuestEntry = {
      GuestID: guest.GuestID,
      TableName: 'Masa 1' // Default table name
    };
    setFormData(prev => ({
      ...prev,
      Guests: [...prev.Guests, newGuestEntry]
    }));
    setGuestSearchText('');
  };

  const removeGuestFromGig = (guestId) => {
    setFormData(prev => ({
      ...prev,
      Guests: prev.Guests.filter(g => g.GuestID !== guestId)
    }));
  };

  const updateGuestTable = (guestId, tableName) => {
    setFormData(prev => ({
      ...prev,
      Guests: prev.Guests.map(g => g.GuestID === guestId ? { ...g, TableName: tableName } : g)
    }));
  };

  const toggleGroupGuestSelect = (tableName, guestId) => {
    setSelectedGroupGuests(prev => {
      const currentSet = new Set(prev[tableName] || []);
      if (currentSet.has(guestId)) {
        currentSet.delete(guestId);
      } else {
        currentSet.add(guestId);
      }
      return { ...prev, [tableName]: currentSet };
    });
  };

  const makeSelectedGuestsRelated = async (tableName) => {
    const selectedIds = Array.from(selectedGroupGuests[tableName] || []);
    if (selectedIds.length < 2) {
      alert('Lütfen ilişkilendirmek için aynı masadan en az 2 kişi seçin.');
      return;
    }

    try {
      // Loop over each selected guest and update their relationships with all others
      for (const currentId of selectedIds) {
        const guestObj = guests.find(g => g.GuestID === currentId);
        if (!guestObj) continue;
        const otherIds = selectedIds.filter(id => id !== currentId);
        const existingRels = guestObj.RelatedGuestIDs || [];
        // Merge without duplicates
        const newRels = Array.from(new Set([...existingRels, ...otherIds]));
        
        await api.updateGuest(currentId, {
          FirstName: guestObj.FirstName,
          LastName: guestObj.LastName,
          PhoneNumber: guestObj.PhoneNumber,
          InstagramLink: guestObj.InstagramLink,
          Notes: guestObj.Notes,
          ProfilePicture: guestObj.ProfilePicture,
          BirthDateDay: guestObj.BirthDateDay,
          BirthDateMonth: guestObj.BirthDateMonth,
          BirthDateYear: guestObj.BirthDateYear,
          Photos: guestObj.Photos,
          RelatedGuestIDs: newRels,
          IsMusician: guestObj.IsMusician
        });
      }
      
      // Reload core data from API to refresh global store relationships
      await store.load(true);
      alert('Seçilen misafirler birbiriyle kalıcı olarak ilişkilendirildi.');
      setSelectedGroupGuests(prev => ({ ...prev, [tableName]: new Set() }));
    } catch (err) {
      alert('İlişkilendirme hatası: ' + err.message);
    }
  };

  // --- Active Gig Performance ("Sahnem") Mode ---
  const startLiveMode = (gig) => {
    setLiveGig(gig);
    setLiveSongIndex(gig.Songs && gig.Songs.length > 0 ? 0 : -1);
    setIsLiveMode(true);
    setLiveFontSize(1.1);
    setLiveTheme('dark');
    setLiveSearchQuery('');
    setLiveSearchResults([]);
  };

  const closeLiveMode = async () => {
    setIsLiveMode(false);
    setLiveGig(null);
    setLiveSongIndex(-1);
    // Force store reload to keep database status synced
    await store.load(true);
  };

  const goToNextSong = () => {
    if (!liveGig || !liveGig.Songs || liveGig.Songs.length === 0) return;
    setLiveSongIndex(prev => (prev + 1) % liveGig.Songs.length);
  };

  const goToPrevSong = () => {
    if (!liveGig || !liveGig.Songs || liveGig.Songs.length === 0) return;
    setLiveSongIndex(prev => (prev - 1 + liveGig.Songs.length) % liveGig.Songs.length);
  };

  const toggleSongPlayed = async (songIndex) => {
    if (!liveGig || !liveGig.Songs || !liveGig.Songs[songIndex]) return;
    
    const updatedSongs = [...liveGig.Songs];
    const targetSong = updatedSongs[songIndex];
    targetSong.IsPlayed = targetSong.IsPlayed ? 0 : 1;

    const payload = {
      VenueName: liveGig.VenueName,
      GigDate: liveGig.GigDate,
      Notes: liveGig.Notes,
      Photos: liveGig.Photos,
      Videos: liveGig.Videos,
      Songs: updatedSongs,
      Guests: liveGig.Guests
    };

    try {
      await api.updateGig(liveGig.GigID, payload);
      setLiveGig(prev => ({ ...prev, Songs: updatedSongs }));
    } catch (err) {
      alert('İşaretleme hatası: ' + err.message);
    }
  };

  const searchLiveRequests = (text) => {
    setLiveSearchQuery(text);
    if (!text.trim()) {
      setLiveSearchResults([]);
      return;
    }
    const term = text.toLocaleLowerCase('tr-TR');
    const matched = songs.filter(s => 
      s.SongTitle.toLocaleLowerCase('tr-TR').includes(term) ||
      (s.ArtistNames && s.ArtistNames.toLocaleLowerCase('tr-TR').includes(term))
    );
    setLiveSearchResults(matched.slice(0, 10));
  };

  const playRequestSongDirect = async (song) => {
    if (!liveGig) return;
    
    // Check if song is already in the list
    let existingIdx = liveGig.Songs.findIndex(s => s.SongID === song.SongID);
    
    if (existingIdx !== -1) {
      // Switch to this song index
      setLiveSongIndex(existingIdx);
    } else {
      // Add as played request at the end of the list
      const newOrder = liveGig.Songs.length + 1;
      const newLiveSong = {
        SongID: song.SongID,
        SortOrder: newOrder,
        IsPlayed: 1,
        IsRequest: 1,
        SongTitle: song.SongTitle,
        ArtistNames: song.ArtistNames
      };
      
      const newSongsList = [...liveGig.Songs, newLiveSong];
      const payload = {
        VenueName: liveGig.VenueName,
        GigDate: liveGig.GigDate,
        Notes: liveGig.Notes,
        Photos: liveGig.Photos,
        Videos: liveGig.Videos,
        Songs: newSongsList,
        Guests: liveGig.Guests
      };

      try {
        await api.updateGig(liveGig.GigID, payload);
        setLiveGig(prev => ({ ...prev, Songs: newSongsList }));
        setLiveSongIndex(newSongsList.length - 1);
      } catch (err) {
        alert('İstek ekleme hatası: ' + err.message);
      }
    }
    
    // Clear request search box
    setLiveSearchQuery('');
    setLiveSearchResults([]);
  };

  // Swiping Gesture implementation
  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipe = 60; // Min px swipe threshold
    if (diff > minSwipe) {
      goToNextSong();
    } else if (diff < -minSwipe) {
      goToPrevSong();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  // --- Filtering Gigs ---
  const filteredGigs = gigs.filter(gig => {
    // 1. Serbest Arama (Mekân, Notlar, vb.)
    if (filterSearch) {
      const query = filterSearch.toLocaleLowerCase('tr-TR');
      const venueMatch = (gig.VenueName || '').toLocaleLowerCase('tr-TR').includes(query);
      const notesMatch = (gig.Notes || '').toLocaleLowerCase('tr-TR').includes(query);
      if (!venueMatch && !notesMatch) return false;
    }

    // 2. Mekân Filtresi
    if (filterVenue && gig.VenueName !== filterVenue) {
      return false;
    }

    // 3. Tarih Aralığı Filtresi
    if (filterStartDate && gig.GigDate < filterStartDate) return false;
    if (filterEndDate && gig.GigDate > filterEndDate) return false;

    return true;
  });

  // Unique venues list for dropdown filter
  const uniqueVenues = Array.from(new Set(gigs.map(g => g.VenueName).filter(Boolean))).sort((a, b) =>
    a.toLocaleLowerCase('tr-TR').localeCompare(b.toLocaleLowerCase('tr-TR'), 'tr')
  );

  // Grouping guests inside the editor by table
  const guestsByTable = {};
  formData.Guests.forEach(gEntry => {
    const guestObj = guests.find(g => g.GuestID === gEntry.GuestID);
    if (!guestObj) return;
    const tName = gEntry.TableName || 'Masasız';
    if (!guestsByTable[tName]) guestsByTable[tName] = [];
    guestsByTable[tName].push({
      ...gEntry,
      FullName: guestObj.FullName
    });
  });

  return (
    <section id="gigs" className="tab-content active">
      <div className="section-header">
        <h2>Sahnelerim ({filteredGigs.length})</h2>
        <button className="btn btn-primary" onClick={handleCreateNew}>+ Yeni Sahne</button>
      </div>

      {/* FILTER PANEL */}
      <div className="filters-panel">
        <div className="filter-group-row">
          <div className="filter-item search-box">
            <label>Serbest Arama</label>
            <input 
              type="text" 
              placeholder="Mekân veya notlar..." 
              value={filterSearch} 
              onChange={e => setFilterSearch(e.target.value)} 
            />
          </div>
          <div className="filter-item">
            <label>Mekân</label>
            <select value={filterVenue} onChange={e => setFilterVenue(e.target.value)}>
              <option value="">Tüm Mekânlar</option>
              {uniqueVenues.map(venueName => (
                <option key={venueName} value={venueName}>{venueName}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Başlangıç Tarihi</label>
            <input 
              type="date" 
              value={filterStartDate} 
              onChange={e => setFilterStartDate(e.target.value)} 
            />
          </div>
          <div className="filter-item">
            <label>Bitiş Tarihi</label>
            <input 
              type="date" 
              value={filterEndDate} 
              onChange={e => setFilterEndDate(e.target.value)} 
            />
          </div>
          <div className="filter-item filter-actions">
            <button className="btn btn-outline btn-sm" onClick={() => {
              setFilterSearch('');
              setFilterVenue('');
              setFilterStartDate('');
              setFilterEndDate('');
            }}>Temizle</button>
          </div>
        </div>
      </div>

      {/* GIGS LIST TABLE */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Mekân</th>
              <th style={{ textAlign: 'center' }}>Şarkı Sayısı</th>
              <th style={{ textAlign: 'center' }}>Misafir Sayısı</th>
              <th>Geceye Dair Notlar</th>
              <th style={{ width: '300px', textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredGigs.map(gig => {
              const formattedDate = new Date(gig.GigDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
              const songsCount = gig.Songs ? gig.Songs.length : 0;
              const playedCount = gig.Songs ? gig.Songs.filter(s => s.IsPlayed).length : 0;
              const guestsCount = gig.Guests ? gig.Guests.length : 0;

              return (
                <tr key={gig.GigID}>
                  <td data-label="Tarih">{formattedDate}</td>
                  <td data-label="Mekân">{gig.VenueName}</td>
                  <td data-label="Şarkı Sayısı" style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: '600' }}>{playedCount}</span> / {songsCount}
                  </td>
                  <td data-label="Misafir Sayısı" style={{ textAlign: 'center' }}>{guestsCount}</td>
                  <td data-label="Notlar" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{gig.Notes || '-'}</td>
                  <td data-label="İşlemler">
                    <div className="action-btns">
                      <button className="btn btn-sm btn-outline btn-added-style" onClick={() => startLiveMode(gig)}>Sahnem 🎤</button>
                      <button className="btn btn-sm btn-outline" onClick={() => handleEdit(gig)}>Düzenle</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(gig.GigID)}>Sil</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredGigs.length === 0 && (
              <tr><td colSpan="6" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EDITOR GIG MODAL */}
      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{editingGig ? 'Sahne Gecesi Düzenle' : 'Yeni Sahne Gecesi Ekle'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="filter-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Sahne Alınan Mekân (Mekân)</label>
                  <input 
                    type="text" 
                    value={formData.VenueName} 
                    onChange={e => setFormData({ ...formData, VenueName: e.target.value })} 
                    placeholder="Örn: Akustik Sahne, Kadıköy" 
                    required 
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Sahne Tarihi</label>
                  <input 
                    type="date" 
                    value={formData.GigDate} 
                    onChange={e => setFormData({ ...formData, GigDate: e.target.value })} 
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Geceye Dair Notlar (Küçük Punto)</label>
                <textarea 
                  value={formData.Notes} 
                  onChange={e => setFormData({ ...formData, Notes: e.target.value })} 
                  placeholder="Geceden kalan notlar, gözlemler, sahne atmosferi..."
                  style={{ fontSize: '0.85rem', height: '80px', resize: 'vertical' }}
                />
              </div>

              {/* TABS CONTAINER FOR SONGS AND GUESTS IN MODAL */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                
                {/* SONGS SECTION */}
                <div style={{ borderRight: '1px solid var(--border)', paddingRight: '1.5rem' }}>
                  <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-main)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🎵 Şarkı Listesi ({formData.Songs.length})</span>
                  </h3>
                  
                  {/* Add song dropdown search */}
                  <div className="form-group" style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="Şarkı ara ve listeye ekle..." 
                      value={songSearchText}
                      onChange={e => setSongSearchText(e.target.value)} 
                    />
                    {songSearchText.trim() && (
                      <div className="listbox-container" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        {songs
                          .filter(s => s.SongTitle.toLocaleLowerCase('tr-TR').includes(songSearchText.toLocaleLowerCase('tr-TR')))
                          .map(s => (
                            <div 
                              key={s.SongID} 
                              onClick={() => addSongToGig(s)}
                              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}
                              className="autocomplete-item-hover"
                            >
                              {s.SongTitle} ({s.ArtistNames})
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>

                  {/* List of gig songs */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
                    {formData.Songs.map((gSong, idx) => {
                      const songObj = songs.find(s => s.SongID === gSong.SongID);
                      if (!songObj) return null;
                      return (
                        <div key={gSong.SongID} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', width: '20px' }}>{gSong.SortOrder}.</span>
                            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={songObj.SongTitle}>
                              {songObj.SongTitle}
                            </span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            {/* Sequence shift input */}
                            <input 
                              type="number" 
                              min="1" 
                              max={formData.Songs.length} 
                              value={gSong.SortOrder}
                              onChange={e => moveSongToOrder(idx, e.target.value)}
                              style={{ width: '45px', padding: '2px 4px', textAlign: 'center', fontSize: '0.8rem', height: '24px', margin: 0 }}
                            />
                            <button type="button" className="btn btn-outline" style={{ padding: '2px 6px', fontSize: '0.75rem', height: '24px' }} onClick={() => swapSongs(idx, idx - 1)} disabled={idx === 0}>▲</button>
                            <button type="button" className="btn btn-outline" style={{ padding: '2px 6px', fontSize: '0.75rem', height: '24px' }} onClick={() => swapSongs(idx, idx + 1)} disabled={idx === formData.Songs.length - 1}>▼</button>
                            <button type="button" className="btn btn-sm btn-danger" style={{ padding: '2px 6px', fontSize: '0.75rem', height: '24px', borderRadius: '4px' }} onClick={() => removeSongFromGig(gSong.SongID)}>&times;</button>
                          </div>
                        </div>
                      );
                    })}
                    {formData.Songs.length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Henüz şarkı eklenmedi.</div>
                    )}
                  </div>
                </div>

                {/* GUESTS SECTION */}
                <div>
                  <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-main)' }}>👥 Ağırlanan Misafirler ({formData.Guests.length})</h3>
                  
                  {/* Add guest dropdown search */}
                  <div className="form-group" style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="Misafir ara ve listeye ekle..." 
                      value={guestSearchText}
                      onChange={e => setGuestSearchText(e.target.value)} 
                    />
                    {guestSearchText.trim() && (
                      <div className="listbox-container" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        {guests
                          .filter(g => g.FullName.toLocaleLowerCase('tr-TR').includes(guestSearchText.toLocaleLowerCase('tr-TR')))
                          .map(g => (
                            <div 
                              key={g.GuestID} 
                              onClick={() => addGuestToGig(g)}
                              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}
                              className="autocomplete-item-hover"
                            >
                              {g.FullName}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>

                  {/* List of gig guests grouped by Table */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
                    {Object.keys(guestsByTable).map(tName => (
                      <div key={tName} style={{ marginBottom: '1rem', border: '1px solid var(--border-soft)', borderRadius: '6px', padding: '0.5rem', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', marginBottom: '0.4rem' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>📍 {tName}</span>
                          <button 
                            type="button" 
                            className="btn btn-outline" 
                            style={{ padding: '2px 6px', fontSize: '0.75rem', height: '22px' }}
                            onClick={() => makeSelectedGuestsRelated(tName)}
                          >
                            🔗 Seçilenleri İlişkilendir
                          </button>
                        </div>
                        {guestsByTable[tName].map(gEntry => (
                          <div key={gEntry.GuestID} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <input 
                                type="checkbox" 
                                checked={!!(selectedGroupGuests[tName] && selectedGroupGuests[tName].has(gEntry.GuestID))}
                                onChange={() => toggleGroupGuestSelect(tName, gEntry.GuestID)}
                                style={{ margin: 0 }}
                              />
                              <span>{gEntry.FullName}</span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {/* Table Name Input */}
                              <input 
                                type="text" 
                                value={gEntry.TableName} 
                                onChange={e => updateGuestTable(gEntry.GuestID, e.target.value)}
                                placeholder="Masa adını değiştir..."
                                style={{ width: '90px', padding: '2px 4px', fontSize: '0.78rem', height: '22px', margin: 0 }}
                              />
                              <button type="button" className="btn btn-sm btn-danger" style={{ padding: '1px 5px', fontSize: '0.7rem', height: '20px' }} onClick={() => removeGuestFromGig(gEntry.GuestID)}>&times;</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    {formData.Guests.length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Henüz misafir eklenmedi.</div>
                    )}
                  </div>
                </div>

              </div>

              {/* MEDIA GALLERY SECTION */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-main)' }}>📸 Sahne Görselleri ve Videoları</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  {/* Photo upload and gallery */}
                  <div>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px dashed var(--primary)', borderRadius: '8px', cursor: 'pointer', color: 'var(--primary)', fontWeight: '600', fontSize: '0.85rem' }}>
                      🖼️ Fotoğraf Ekle (Çoklu Seçilebilir)
                      <input type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                      {formData.Photos.map((photo, index) => (
                        <div key={index} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                          <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button type="button" className="profile-img-delete-badge" style={{ padding: 0, fontSize: '0.9rem', width: '16px', height: '16px' }} onClick={() => removePhoto(index)}>&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Video URL upload and list */}
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="Video URL'si ekle (YouTube, Drive...)" 
                        value={newVideoUrl} 
                        onChange={e => setNewVideoUrl(e.target.value)} 
                        style={{ margin: 0, flex: 1 }}
                      />
                      <button type="button" className="btn btn-outline" onClick={addVideoLink}>Ekle</button>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {formData.Videos.map((video, index) => (
                        <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f1f5f9', padding: '0.35rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                          <a href={video} target="_blank" rel="noreferrer" style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '85%' }}>🔗 {video}</a>
                          <button type="button" style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }} onClick={() => removeVideo(index)}>&times;</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ACTIVE LIVE GIG MODE ("SAHNEM" fullscreen chord swiper) */}
      {isLiveMode && liveGig && createPortal(
        <div className="chord-fullscreen-overlay" style={{ background: liveTheme === 'dark' ? '#0f172a' : '#f8fafc', color: liveTheme === 'dark' ? '#f1f5f9' : '#0f2742', zIndex: 2100 }}>
          
          {/* HEADER */}
          <div className="chord-fullscreen-header" style={{ borderBottom: `1px solid ${liveTheme === 'dark' ? '#334155' : '#cbd5e1'}`, padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'bold' }}>🎙️ Sahnem: {liveGig.VenueName}</h2>
              <span style={{ fontSize: '0.8rem', color: liveTheme === 'dark' ? '#94a3b8' : '#64748b' }}>{new Date(liveGig.GigDate).toLocaleDateString('tr-TR')}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {/* Font controls */}
              <button className="chord-action-btn" onClick={() => setLiveFontSize(prev => Math.max(0.6, prev - 0.1))}>A-</button>
              <button className="chord-action-btn" onClick={() => setLiveFontSize(prev => Math.min(2.5, prev + 0.1))}>A+</button>
              {/* Theme toggle */}
              <button className="chord-action-btn" onClick={() => setLiveTheme(prev => prev === 'dark' ? 'light' : 'dark')}>
                {liveTheme === 'dark' ? 'Aydınlık' : 'Karanlık'}
              </button>
              {/* Close Button */}
              <button className="chord-action-btn btn-close-toggle" style={{ background: '#ef4444', color: 'white' }} onClick={closeLiveMode}>&times;</button>
            </div>
          </div>

          {/* INNER PERFORMANCE CONTAINER */}
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, overflow: 'hidden' }}>
            
            {/* SIDEBAR - GIG PLAYLIST */}
            <div style={{ borderRight: `1px solid ${liveTheme === 'dark' ? '#334155' : '#cbd5e1'}`, display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
              <div style={{ padding: '0.75rem', fontWeight: 'bold', borderBottom: `1px solid ${liveTheme === 'dark' ? '#1e293b' : '#e2eaf3'}`, fontSize: '0.85rem' }}>REPERTUVAR SIRASI</div>
              
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {liveGig.Songs && liveGig.Songs.map((gSong, idx) => (
                  <div 
                    key={gSong.GigSongID || gSong.SongID}
                    onClick={() => setLiveSongIndex(idx)}
                    style={{ 
                      padding: '0.6rem 0.75rem', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      background: idx === liveSongIndex ? (liveTheme === 'dark' ? '#1e293b' : '#e3f2fd') : 'transparent',
                      borderBottom: `1px solid ${liveTheme === 'dark' ? '#1e293b' : '#e2eaf3'}`,
                      fontSize: '0.82rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <span style={{ fontWeight: 'bold', color: liveTheme === 'dark' ? '#94a3b8' : '#64748b' }}>{gSong.SortOrder}.</span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', textDecoration: gSong.IsPlayed ? 'line-through' : 'none', color: gSong.IsPlayed ? '#059669' : 'inherit' }}>
                        {gSong.SongTitle}
                      </span>
                    </div>
                    {gSong.IsRequest === 1 && (
                      <span style={{ fontSize: '0.7rem', padding: '1px 4px', background: '#38bdf8', color: 'white', borderRadius: '3px', fontWeight: 'bold' }}>İst.</span>
                    )}
                  </div>
                ))}
              </div>
              
              {/* LIVE REQUESTS CONTAINER */}
              <div style={{ padding: '0.75rem', borderTop: `1px solid ${liveTheme === 'dark' ? '#334155' : '#cbd5e1'}`, position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="İstek bul ve hemen aç..." 
                  value={liveSearchQuery} 
                  onChange={e => searchLiveRequests(e.target.value)}
                  style={{ 
                    fontSize: '0.8rem', 
                    padding: '0.4rem', 
                    margin: 0, 
                    background: liveTheme === 'dark' ? '#1e293b' : 'white', 
                    color: liveTheme === 'dark' ? 'white' : 'black',
                    border: `1px solid ${liveTheme === 'dark' ? '#475569' : '#cbd5e1'}`
                  }}
                />
                {liveSearchResults.length > 0 && (
                  <div style={{ position: 'absolute', bottom: '100%', left: '0.75rem', right: '0.75rem', background: liveTheme === 'dark' ? '#1e293b' : 'white', border: `1px solid ${liveTheme === 'dark' ? '#475569' : '#cbd5e1'}`, borderRadius: '6px', maxHeight: '160px', overflowY: 'auto', zIndex: 10 }}>
                    {liveSearchResults.map(s => (
                      <div 
                        key={s.SongID} 
                        onClick={() => playRequestSongDirect(s)}
                        style={{ padding: '0.4rem 0.6rem', cursor: 'pointer', borderBottom: `1px solid ${liveTheme === 'dark' ? '#334155' : '#e2eaf3'}`, fontSize: '0.78rem' }}
                        className="autocomplete-item-hover"
                      >
                        {s.SongTitle} ({s.ArtistNames})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* MAIN PORT - FULLSCREEN CHORD SLIDER */}
            <div 
              style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {liveSongIndex !== -1 && liveGig.Songs[liveSongIndex] ? (() => {
                const gigSong = liveGig.Songs[liveSongIndex];
                const fullSongObj = songs.find(s => s.SongID === gigSong.SongID);
                return (
                  <>
                    {/* Song Toolbar */}
                    <div style={{ padding: '0.6rem 1.5rem', background: liveTheme === 'dark' ? '#1e293b' : '#f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${liveTheme === 'dark' ? '#334155' : '#cbd5e1'}` }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>{gigSong.SongTitle}</h3>
                        <span style={{ fontSize: '0.8rem', color: liveTheme === 'dark' ? '#94a3b8' : '#64748b' }}>{gigSong.ArtistNames || '-'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {/* Played Switch */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          <input 
                            type="checkbox" 
                            checked={!!gigSong.IsPlayed}
                            onChange={() => toggleSongPlayed(liveSongIndex)}
                          />
                          <span style={{ color: gigSong.IsPlayed ? '#059669' : 'inherit' }}>
                            {gigSong.IsPlayed ? '✓ Çalındı' : 'Çalınmadı'}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Chord Viewer Area */}
                    <div 
                      className="chord-lyrics-display-area" 
                      style={{ 
                        flex: 1, 
                        overflowY: 'auto', 
                        padding: '1.5rem 2rem', 
                        fontFamily: 'monospace', 
                        fontSize: `${liveFontSize}rem`,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        background: liveTheme === 'dark' ? '#0f172a' : '#ffffff',
                        color: liveTheme === 'dark' ? '#cbd5e1' : '#1e293b'
                      }}
                    >
                      {fullSongObj && hasLyricsContent(fullSongObj.Lyrics) ? (
                        <div dangerouslySetInnerHTML={{ __html: fullSongObj.Lyrics }} />
                      ) : (
                        <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--text-muted)' }}>
                          {fullSongObj && fullSongObj.ChordImagePath ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                              <span>Bu şarkının akor görseli mevcuttur. Performans modunda sadece transpoze metin akorları görüntülenebilir.</span>
                              <img src={fullSongObj.ChordImagePath} alt="Akor Görseli" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
                            </div>
                          ) : (
                            'Bu şarkının akor/transpoze bilgisi bulunmamaktadır.'
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Navigation footer */}
                    <div style={{ padding: '0.6rem 1.5rem', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${liveTheme === 'dark' ? '#334155' : '#cbd5e1'}`, background: liveTheme === 'dark' ? '#1e293b' : '#f1f5f9' }}>
                      <button className="btn btn-outline" onClick={goToPrevSong}>◀ Önceki</button>
                      <span style={{ fontSize: '0.9rem', alignSelf: 'center', fontWeight: 'bold' }}>
                        {liveSongIndex + 1} / {liveGig.Songs.length}
                      </span>
                      <button className="btn btn-outline" onClick={goToNextSong}>Sonraki ▶</button>
                    </div>
                  </>
                );
              })() : (
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Sahne listenizde henüz şarkı bulunmuyor veya şarkı seçilmedi.
                </div>
              )}
            </div>

          </div>

        </div>,
        document.body
      )}

    </section>
  );
}
