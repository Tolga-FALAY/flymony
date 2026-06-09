import React, { useState, useEffect } from 'react';
import { api } from '../api';
import store from '../store';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [songs, setSongs] = useState([]);
  const [guests, setGuests] = useState([]);
  const [artists, setArtists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);

  // Filter States
  const [filterGuest, setFilterGuest] = useState('');
  const [filterSong, setFilterSong] = useState('');
  const [filterArtist, setFilterArtist] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Default sorting configuration: Sort by SongTitle Ascending
  const [sortConfig, setSortConfig] = useState({ key: 'SongTitle', direction: 'asc' });

  const [formData, setFormData] = useState({
    SongID: '',
    GuestIDs: [],
    Status: 'Kayıtlı',
    Link: '',
    Vardi: false
  });

  const [guestSearch, setGuestSearch] = useState('');
  const [songSearch, setSongSearch] = useState('');
  
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);

  const [newGuestData, setNewGuestData] = useState({ FirstName: '', LastName: '', PhoneNumber: '' });
  const [newSongData, setNewSongData] = useState({ SongTitle: '', ArtistIDs: [] });
  const [songArtistSearch, setSongArtistSearch] = useState('');

  useEffect(() => {
    const syncFromStore = () => {
      setRequests([...store.requests]);
      setSongs([...store.songs]);
      setGuests([...store.guests]);
      setArtists([...store.artists]);
    };
    if (store.isLoaded) {
      syncFromStore();
    } else {
      store.load().then(syncFromStore);
    }
    window.addEventListener('store-updated', syncFromStore);
    return () => window.removeEventListener('store-updated', syncFromStore);
  }, []);

  const openModal = (req = null) => {
    if (req) {
      setEditingRequest(req);
      setFormData({
        SongID: String(req.SongID),
        GuestIDs: (req.GuestIDs || []).map(String),
        Status: req.Status || 'Kayıtlı',
        Link: req.Link || '',
        Vardi: req.Vardi ? true : false
      });
    } else {
      setEditingRequest(null);
      setFormData({ SongID: '', GuestIDs: [], Status: 'Kayıtlı', Link: '', Vardi: false });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRequest(null);
    setGuestSearch('');
    setSongSearch('');
  };

  const handleCreateGuestInline = async (e) => {
    e.preventDefault();
    const fName = newGuestData.FirstName.trim();
    const lName = newGuestData.LastName.trim();
    if (!fName || !lName) {
      alert("Ad ve Soyad alanları boş bırakılamaz!");
      return;
    }

    const isDuplicate = guests.some(g => 
      g.FirstName.trim().toLowerCase() === fName.toLowerCase() && 
      g.LastName.trim().toLowerCase() === lName.toLowerCase()
    );
    if (isDuplicate) {
      alert("Bu isimde bir misafir zaten kayıtlı!");
      return;
    }

    try {
      const res = await api.createGuest({
        FirstName: fName,
        LastName: lName,
        PhoneNumber: newGuestData.PhoneNumber
      });
      // Firestore okuma YOK — store'a ekle, event ile lokal state güncellenir
      store.addGuest({
        GuestID:     res.GuestID,
        FirstName:   fName,
        LastName:    lName,
        FullName:    `${fName} ${lName}`.trim(),
        PhoneNumber: newGuestData.PhoneNumber || ''
      });

      setFormData(prev => ({
        ...prev,
        GuestIDs: [...prev.GuestIDs, String(res.GuestID)]
      }));

      setNewGuestData({ FirstName: '', LastName: '', PhoneNumber: '' });
      setGuestSearch('');
      setIsGuestModalOpen(false);
    } catch (err) {
      alert("Misafir ekleme hatası: " + err.message);
    }
  };

  const handleCreateSongInline = async (e) => {
    e.preventDefault();
    const title = newSongData.SongTitle.trim();
    if (!title) {
      alert("Şarkı adı boş olamaz!");
      return;
    }

    const isDuplicate = songs.some(s => {
      const titleMatch = s.SongTitle && s.SongTitle.trim().toLowerCase() === title.toLowerCase();
      if (!titleMatch) return false;
      const existingArtistIDs = s.ArtistIDs || [];
      const newArtistIDs = newSongData.ArtistIDs.map(Number);
      if (existingArtistIDs.length === 0 && newArtistIDs.length === 0) return true;
      return newArtistIDs.some(id => existingArtistIDs.includes(id));
    });

    if (isDuplicate) {
      alert("Bu şarkı zaten kayıtlı!");
      return;
    }

    try {
      const res = await api.createSong({
        SongTitle: title,
        ArtistIDs: newSongData.ArtistIDs.map(Number)
      });
      // Firestore okuma YOK — store'a ekle, event ile lokal state güncellenir
      const artistNames = store.resolveArtistNames(newSongData.ArtistIDs.map(Number)) || '-';
      store.addSong({
        SongID:      res.SongID,
        SongTitle:   title,
        Duration:    '',
        ArtistIDs:   newSongData.ArtistIDs.map(Number),
        ArtistNames: artistNames
      });

      setFormData(prev => ({
        ...prev,
        SongID: String(res.SongID)
      }));

      setNewSongData({ SongTitle: '', ArtistIDs: [] });
      setSongSearch('');
      setSongArtistSearch('');
      setIsSongModalOpen(false);
    } catch (err) {
      alert("Şarkı ekleme hatası: " + err.message);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGuestChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData({ ...formData, GuestIDs: selectedOptions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.GuestIDs.length === 0) {
      alert("Lütfen en az bir misafir seçin.");
      return;
    }
    if (!formData.SongID) {
      alert("Lütfen bir şarkı seçin.");
      return;
    }

    const songIdNum = Number(formData.SongID);

    // Duplicate check: check if SongID already exists in requests
    if (!editingRequest) {
      const existingReq = requests.find(r => r.SongID === songIdNum);
      if (existingReq) {
        alert("Bu istek zaten kayıtlı...");
        const goToExisting = window.confirm(
          "İlgili kayda gitmek ister misiniz?"
        );
        if (goToExisting) {
          openModal(existingReq);
        } else {
          closeModal();
        }
        return;
      }
    }

    const dataToSend = {
      SongID: songIdNum,
      GuestIDs: formData.GuestIDs.map(Number),
      Status: formData.Status,
      Link: formData.Link || '',
      Vardi: formData.Vardi ? 1 : 0
    };
    try {
      if (editingRequest) {
        await api.updateRequest(editingRequest.RequestID, dataToSend);
        // Store'u güncelle — Firestore okuma YOK
        store.updateRequest(editingRequest.RequestID, {
          ...editingRequest,
          SongID:    songIdNum,
          SongTitle: store.resolveSongDisplay(songIdNum),
          GuestIDs:  dataToSend.GuestIDs,
          FullNames: store.resolveGuestNames(dataToSend.GuestIDs),
          Status:    dataToSend.Status,
          Link:      dataToSend.Link || '',
          Vardi:     formData.Vardi
        });
      } else {
        const result = await api.createRequest(dataToSend);
        store.addRequest({
          RequestID:   result.RequestID,
          RequestDate: new Date().toISOString(),
          SongID:      songIdNum,
          SongTitle:   store.resolveSongDisplay(songIdNum),
          GuestIDs:    dataToSend.GuestIDs,
          FullNames:   store.resolveGuestNames(dataToSend.GuestIDs),
          Status:      dataToSend.Status,
          Link:        dataToSend.Link || '',
          Vardi:       formData.Vardi
        });
      }
      closeModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu isteği silmek istediğinize emin misiniz?')) {
      await api.deleteRequest(id);
      store.removeRequest(id);
    }
  };

  // Handle header sorting
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sort Requests dynamically based on sortConfig
  const sortedRequests = [...requests].sort((a, b) => {
    let res = 0;
    if (sortConfig.key === 'RequestDate') {
      res = new Date(a.RequestDate) - new Date(b.RequestDate);
    } else if (sortConfig.key === 'FullNames') {
      const aVal = (a.FullNames || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.FullNames || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    } else if (sortConfig.key === 'SongTitle') {
      const aVal = (a.SongTitle || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.SongTitle || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    } else if (sortConfig.key === 'Status') {
      const aVal = (a.Status || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.Status || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    }
    return sortConfig.direction === 'asc' ? res : -res;
  });

  // Filter Requests dynamically based on filter states
  const filteredRequests = sortedRequests.filter(req => {
    // 1. Guest filter
    if (filterGuest && !req.GuestIDs.includes(Number(filterGuest))) {
      return false;
    }
    
    // Get the song details for this request to match Song/Artist
    const song = songs.find(s => s.SongID === req.SongID);
    
    // 2. Song filter
    if (filterSong && req.SongID !== Number(filterSong)) {
      return false;
    }
    
    // 3. Artist filter
    if (filterArtist) {
      if (!song || !song.ArtistIDs.includes(Number(filterArtist))) {
        return false;
      }
    }
    
    // 4. Status filter
    const statusVal = req.Status || 'Kayıtlı';
    if (filterStatus && statusVal !== filterStatus) {
      return false;
    }
    
    // 5. Search query (Free text)
    if (filterSearch) {
      const searchLower = filterSearch.toLocaleLowerCase('tr-TR');
      const guestMatch = (req.FullNames || '').toLocaleLowerCase('tr-TR').includes(searchLower);
      const songTitleMatch = song ? song.SongTitle.toLocaleLowerCase('tr-TR').includes(searchLower) : false;
      const artistMatch = song ? song.ArtistNames.toLocaleLowerCase('tr-TR').includes(searchLower) : false;
      
      if (!guestMatch && !songTitleMatch && !artistMatch) {
        return false;
      }
    }
    
    return true;
  });

  const clearAllFilters = () => {
    setFilterSearch('');
    setFilterGuest('');
    setFilterSong('');
    setFilterArtist('');
    setFilterStatus('');
  };

  // Render sorting arrows next to headers
  const renderSortArrow = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return ' ⇅';
  };

  // Sort songs list ascending by title for the modal dropdown
  const sortedSongs = [...songs].sort((a, b) => {
    const aTitle = (a.SongTitle || '').toLocaleLowerCase('tr-TR');
    const bTitle = (b.SongTitle || '').toLocaleLowerCase('tr-TR');
    return aTitle.localeCompare(bTitle, 'tr');
  });

  // Sort lists for filters
  const sortedFilterGuests = [...guests].sort((a, b) => {
    return (a.FullName || '').toLocaleLowerCase('tr-TR').localeCompare((b.FullName || '').toLocaleLowerCase('tr-TR'), 'tr');
  });

  const sortedFilterArtists = [...artists].sort((a, b) => {
    return (a.ArtistName || '').toLocaleLowerCase('tr-TR').localeCompare((b.ArtistName || '').toLocaleLowerCase('tr-TR'), 'tr');
  });

  return (
    <div>
      <div className="section-header">
        <h2>Şarkı İstekleri ({filteredRequests.length})</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Yeni İstek Ekle
        </button>
      </div>

      <div className="filters-panel">
        <div className="filter-group-row">
          <div className="filter-item search-box">
            <label htmlFor="filterSearchReact">Serbest Arama</label>
            <input 
              type="text" 
              id="filterSearchReact" 
              placeholder="Misafir, şarkı veya sanatçı..." 
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label htmlFor="filterGuestReact">Misafir</label>
            <select 
              id="filterGuestReact"
              value={filterGuest}
              onChange={(e) => setFilterGuest(e.target.value)}
            >
              <option value="">Tüm Misafirler</option>
              {sortedFilterGuests.map(g => (
                <option key={g.GuestID} value={String(g.GuestID)}>{g.FullName}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label htmlFor="filterSongReact">Şarkı</label>
            <select 
              id="filterSongReact"
              value={filterSong}
              onChange={(e) => setFilterSong(e.target.value)}
            >
              <option value="">Tüm Şarkılar</option>
              {sortedSongs.map(s => (
                <option key={s.SongID} value={String(s.SongID)}>{s.SongTitle}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label htmlFor="filterArtistReact">Sanatçı</label>
            <select 
              id="filterArtistReact"
              value={filterArtist}
              onChange={(e) => setFilterArtist(e.target.value)}
            >
              <option value="">Tüm Sanatçılar</option>
              {sortedFilterArtists.map(a => (
                <option key={a.ArtistID} value={String(a.ArtistID)}>{a.ArtistName}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label htmlFor="filterStatusReact">Durum</label>
            <select 
              id="filterStatusReact"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">Tüm Durumlar</option>
              <option value="Kayıtlı">Kayıtlı</option>
              <option value="Denemede">Denemede</option>
              <option value="Eklendi">Eklendi</option>
              <option value="Bakalım">Bakalım</option>
              <option value="İptal">İptal</option>
            </select>
          </div>
          <div className="filter-item filter-actions">
            <button className="btn btn-outline btn-sm" onClick={clearAllFilters}>Temizle</button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('RequestDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Tarih / Saat
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'RequestDate' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('RequestDate')}
                </span>
              </th>
              <th onClick={() => handleSort('FullNames')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Misafir
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'FullNames' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('FullNames')}
                </span>
              </th>
              <th onClick={() => handleSort('SongTitle')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                İstenen Şarkı
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'SongTitle' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('SongTitle')}
                </span>
              </th>
              <th onClick={() => handleSort('Status')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Durum
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'Status' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('Status')}
                </span>
              </th>
              <th style={{ width: '150px' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map(req => {
              const rawDate = req.RequestDate || '';
              const dateObj = new Date(rawDate.endsWith('Z') ? rawDate : (rawDate ? rawDate + 'Z' : Date.now()));

              // Helper to assign CSS class to request status badges
              const getStatusBadgeClass = (status) => {
                switch (status) {
                  case 'Kayıtlı': return 'status-badge status-registered';
                  case 'Denemede': return 'status-badge status-trial';
                  case 'Eklendi': return 'status-badge status-added';
                  case 'Bakalım': return 'status-badge status-existed';
                  case 'İptal': return 'status-badge status-cancelled';
                  default: return 'status-badge';
                }
              };

              return (
                <tr key={req.RequestID}>
                  <td data-label="Tarih / Saat">{dateObj.toLocaleString('tr-TR')}</td>
                  <td data-label="Misafir">{req.FullNames || '-'}</td>
                  <td data-label="İstenen Şarkı">
                    <span className="song-title-wrapper">
                      <span>{req.SongTitle}</span>
                      {req.Link && (
                        <a 
                          href={req.Link} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="song-link-icon" 
                          title="Şarkı Bağlantısı"
                        >
                          🔗
                        </a>
                      )}
                    </span>
                  </td>
                  <td data-label="Durum">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span className={getStatusBadgeClass(req.Status)}>{req.Status}</span>
                      {req.Vardi && <span style={{ color: '#059669', fontWeight: 'bold', fontSize: '1.2rem', lineHeight: 1 }} title="Vardı">✓</span>}
                    </div>
                  </td>
                  <td data-label="İşlemler" className="action-btns">
                    <button className="btn btn-sm btn-outline" onClick={() => openModal(req)}>Düzenle</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(req.RequestID)}>Sil</button>
                  </td>
                </tr>
              );
            })}
            {filteredRequests.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingRequest ? 'İstek Düzenle' : 'Yeni İstek'}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Misafirler (Birden fazla seçmek için CTRL/CMD basılı tutun)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Misafir ara..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setIsGuestModalOpen(true)}
                    style={{ padding: '0.5rem 1rem', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: 1 }}
                  >
                    +
                  </button>
                </div>
                <div className="listbox-container" style={{ height: '115px', maxHeight: '115px', overflowY: 'auto' }}>
                  {guests
                    .filter(g => (g.FullName || '').toLocaleLowerCase('tr-TR').includes((guestSearch || '').toLocaleLowerCase('tr-TR')))
                    .map(g => {
                      const isSelected = formData.GuestIDs.includes(String(g.GuestID));
                      return (
                        <div 
                          key={g.GuestID} 
                          className={`listbox-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setFormData(prev => {
                              const guestIdStr = String(g.GuestID);
                              const isAlreadySelected = prev.GuestIDs.includes(guestIdStr);
                              const newGuestIDs = isAlreadySelected
                                ? prev.GuestIDs.filter(id => id !== guestIdStr)
                                : [...prev.GuestIDs, guestIdStr];
                              return { ...prev, GuestIDs: newGuestIDs };
                            });
                          }}
                        >
                          <span>{g.FullName}</span>
                          {isSelected && <span style={{ fontSize: '0.8rem' }}>✓</span>}
                        </div>
                      );
                    })
                  }
                  {guests.filter(g => (g.FullName || '').toLocaleLowerCase('tr-TR').includes((guestSearch || '').toLocaleLowerCase('tr-TR'))).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem' }}>Misafir bulunamadı.</div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Şarkı Seçin</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Şarkı ara..."
                    value={songSearch}
                    onChange={(e) => setSongSearch(e.target.value)}
                    style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setIsSongModalOpen(true)}
                    style={{ padding: '0.5rem 1rem', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: 1 }}
                  >
                    +
                  </button>
                </div>
                <div className="listbox-container" style={{ height: '115px', maxHeight: '115px', overflowY: 'auto' }}>
                  {sortedSongs
                    .filter(s => {
                      const searchLower = (songSearch || '').toLocaleLowerCase('tr-TR');
                      return (s.SongTitle || '').toLocaleLowerCase('tr-TR').includes(searchLower) ||
                             (s.ArtistNames || '').toLocaleLowerCase('tr-TR').includes(searchLower);
                    })
                    .map(s => {
                      const isSelected = formData.SongID === String(s.SongID);
                      return (
                        <div 
                          key={s.SongID}
                          className={`listbox-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setFormData(prev => ({ ...prev, SongID: String(s.SongID) }));
                          }}
                        >
                          <span>{s.SongTitle}</span>
                          <span style={{ fontSize: '0.8rem', opacity: isSelected ? 1 : 0.7 }}>{s.ArtistNames && s.ArtistNames !== '-' ? `(${s.ArtistNames})` : ''}</span>
                        </div>
                      );
                    })
                  }
                  {sortedSongs.filter(s => {
                    const searchLower = (songSearch || '').toLocaleLowerCase('tr-TR');
                    return (s.SongTitle || '').toLocaleLowerCase('tr-TR').includes(searchLower) ||
                           (s.ArtistNames || '').toLocaleLowerCase('tr-TR').includes(searchLower);
                  }).length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem' }}>Şarkı bulunamadı.</div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>İstek Durumu</label>
                <select name="Status" value={formData.Status} onChange={handleChange} required>
                  <option value="Kayıtlı">Kayıtlı</option>
                  <option value="Denemede">Denemede</option>
                  <option value="Eklendi">Eklendi</option>
                  <option value="Bakalım">Bakalım</option>
                  <option value="İptal">İptal</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '-0.25rem', marginBottom: '1rem' }}>
                <input 
                  type="checkbox" 
                  id="reqVardi" 
                  name="Vardi" 
                  checked={formData.Vardi} 
                  onChange={(e) => setFormData(prev => ({ ...prev, Vardi: e.target.checked }))}
                  style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                />
                <label htmlFor="reqVardi" style={{ margin: 0, cursor: 'pointer', fontWeight: 600 }}>Vardı</label>
              </div>
              <div className="form-group">
                <label>Link (YouTube, Spotify vb. - Opsiyonel)</label>
                <input 
                  type="url" 
                  name="Link" 
                  value={formData.Link} 
                  onChange={handleChange} 
                  placeholder="https://..." 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isGuestModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Yeni Misafir Ekle</h2>
              <button className="close-btn" onClick={() => setIsGuestModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateGuestInline}>
              <div className="form-group">
                <label>Ad</label>
                <input 
                  type="text" 
                  value={newGuestData.FirstName} 
                  onChange={e => setNewGuestData({ ...newGuestData, FirstName: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Soyad</label>
                <input 
                  type="text" 
                  value={newGuestData.LastName} 
                  onChange={e => setNewGuestData({ ...newGuestData, LastName: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Telefon</label>
                <input 
                  type="text" 
                  value={newGuestData.PhoneNumber} 
                  onChange={e => setNewGuestData({ ...newGuestData, PhoneNumber: e.target.value })} 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setIsGuestModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSongModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Yeni Şarkı Ekle</h2>
              <button className="close-btn" onClick={() => setIsSongModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateSongInline}>
              <div className="form-group">
                <label>Şarkı Adı</label>
                <input 
                  type="text" 
                  value={newSongData.SongTitle} 
                  onChange={e => setNewSongData({ ...newSongData, SongTitle: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Sanatçılar (CTRL/CMD ile çoklu seçim, arama filtresi yapılabilir)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Sanatçı ara..."
                    value={songArtistSearch}
                    onChange={(e) => setSongArtistSearch(e.target.value)}
                    style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  />
                </div>
                <select 
                  multiple 
                  value={newSongData.ArtistIDs} 
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setNewSongData({ ...newSongData, ArtistIDs: selected });
                  }} 
                  style={{ height: '100px' }}
                >
                  {artists.map(artist => {
                    const isVisible = (artist.ArtistName || '').toLocaleLowerCase('tr-TR').includes(songArtistSearch.toLocaleLowerCase('tr-TR'));
                    return (
                      <option 
                        key={artist.ArtistID} 
                        value={String(artist.ArtistID)}
                        style={{ display: isVisible ? 'block' : 'none' }}
                      >
                        {artist.ArtistName}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setIsSongModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
