import React, { useState, useEffect } from 'react';
import { api } from '../api';

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
    Status: 'Kayıtlı'
  });

  const [guestSearch, setGuestSearch] = useState('');
  const [songSearch, setSongSearch] = useState('');
  
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);

  const [newGuestData, setNewGuestData] = useState({ FirstName: '', LastName: '', PhoneNumber: '' });
  const [newSongData, setNewSongData] = useState({ SongTitle: '', ArtistIDs: [] });
  const [songArtistSearch, setSongArtistSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [requestsData, songsData, guestsData, artistsData] = await Promise.all([
      api.getRequests(),
      api.getSongs(),
      api.getGuests(),
      api.getArtists()
    ]);
    setRequests(requestsData);
    setSongs(songsData);
    setGuests(guestsData);
    setArtists(artistsData);
  };

  const openModal = (req = null) => {
    if (req) {
      setEditingRequest(req);
      setFormData({
        SongID: String(req.SongID),
        GuestIDs: (req.GuestIDs || []).map(String),
        Status: req.Status || 'Kayıtlı'
      });
    } else {
      setEditingRequest(null);
      setFormData({ SongID: '', GuestIDs: [], Status: 'Kayıtlı' });
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
      const guestsData = await api.getGuests();
      setGuests(guestsData);
      
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
      const songsData = await api.getSongs();
      setSongs(songsData);
      
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
      Status: formData.Status
    };
    try {
      if (editingRequest) {
        await api.updateRequest(editingRequest.RequestID, dataToSend);
      } else {
        await api.createRequest(dataToSend);
      }
      closeModal();
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu isteği silmek istediğinize emin misiniz?')) {
      await api.deleteRequest(id);
      loadData();
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
              <option value="Vardı">Vardı</option>
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
              const dateObj = new Date(req.RequestDate + 'Z'); // SQLite UTC time

              // Helper to assign CSS class to request status badges
              const getStatusBadgeClass = (status) => {
                switch (status) {
                  case 'Kayıtlı': return 'status-badge status-registered';
                  case 'Denemede': return 'status-badge status-trial';
                  case 'Eklendi': return 'status-badge status-added';
                  case 'Vardı': return 'status-badge status-existed';
                  case 'İptal': return 'status-badge status-cancelled';
                  default: return 'status-badge';
                }
              };

              return (
                <tr key={req.RequestID}>
                  <td data-label="Tarih / Saat">{dateObj.toLocaleString('tr-TR')}</td>
                  <td data-label="Misafir">{req.FullNames || '-'}</td>
                  <td data-label="İstenen Şarkı">{req.SongTitle}</td>
                  <td data-label="Durum">
                    <span className={getStatusBadgeClass(req.Status)}>{req.Status}</span>
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
                <select multiple name="GuestIDs" value={formData.GuestIDs} onChange={handleGuestChange} style={{ height: '100px' }} required>
                  {guests.map(g => {
                    const isVisible = (g.FullName || '').toLocaleLowerCase('tr-TR').includes(guestSearch.toLocaleLowerCase('tr-TR'));
                    return (
                      <option 
                        key={g.GuestID} 
                        value={String(g.GuestID)}
                        style={{ display: isVisible ? 'block' : 'none' }}
                      >
                        {g.FullName}
                      </option>
                    );
                  })}
                </select>
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
                <select name="SongID" value={formData.SongID} onChange={handleChange} required>
                  <option value="">-- Şarkı Seçin --</option>
                  {sortedSongs.map(s => {
                    const isVisible = (s.SongTitle || '').toLocaleLowerCase('tr-TR').includes(songSearch.toLocaleLowerCase('tr-TR')) || 
                                      (s.ArtistNames || '').toLocaleLowerCase('tr-TR').includes(songSearch.toLocaleLowerCase('tr-TR'));
                    return (
                      <option 
                        key={s.SongID} 
                        value={String(s.SongID)}
                        style={{ display: isVisible ? 'block' : 'none' }}
                      >
                        {s.SongTitle} {s.ArtistNames && s.ArtistNames !== '-' ? `(${s.ArtistNames})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="form-group">
                <label>İstek Durumu</label>
                <select name="Status" value={formData.Status} onChange={handleChange} required>
                  <option value="Kayıtlı">Kayıtlı</option>
                  <option value="Denemede">Denemede</option>
                  <option value="Eklendi">Eklendi</option>
                  <option value="Vardı">Vardı</option>
                  <option value="İptal">İptal</option>
                </select>
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
    </div>
  );
}
