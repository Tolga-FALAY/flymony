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

  // Default sorting configuration: Sort by RequestDate Descending
  const [sortConfig, setSortConfig] = useState({ key: 'RequestDate', direction: 'desc' });

  const [formData, setFormData] = useState({
    SongID: '',
    GuestIDs: [],
    Status: 'Kayıtlı',
    Link: '',
    Vardi: false,
    Notes: '',
    StatusChangeDate: ''
  });

  const [isStatusDateModalOpen, setIsStatusDateModalOpen] = useState(false);
  const [tempStatusDate, setTempStatusDate] = useState('');

  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [songSearch, setSongSearch] = useState('');

  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
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
        Vardi: req.Vardi ? true : false,
        Notes: req.Notes || '',
        StatusChangeDate: req.StatusChangeDate || ''
      });
      // Prepopulate search inputs so they are selected/visible
      const selectedSong = songs.find(s => s.SongID === req.SongID);
      if (selectedSong) {
        setSongSearch(selectedSong.SongTitle);
      }
      const selectedGuestList = guests.filter(g => (req.GuestIDs || []).includes(g.GuestID));
      if (selectedGuestList.length === 1) {
        setGuestSearch(selectedGuestList[0].FullName);
      } else {
        setGuestSearch('');
      }
    } else {
      setEditingRequest(null);
      setFormData({ SongID: '', GuestIDs: [], Status: 'Kayıtlı', Link: '', Vardi: false, Notes: '', StatusChangeDate: '' });
      setGuestSearch('');
      setSongSearch('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRequest(null);
    setGuestSearch('');
    setSongSearch('');
    setSelectedGuestId('');
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
        SongID: res.SongID,
        SongTitle: title,
        Duration: '',
        ArtistIDs: newSongData.ArtistIDs.map(Number),
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

  const handleOpenStatusDateModal = () => {
    if (formData.StatusChangeDate) {
      const d = new Date(formData.StatusChangeDate);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setTempStatusDate(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      setTempStatusDate('');
    }
    setIsStatusDateModalOpen(true);
  };

  const handleSaveStatusDate = () => {
    if (tempStatusDate) {
      const d = new Date(tempStatusDate);
      setFormData(prev => ({ ...prev, StatusChangeDate: d.toISOString() }));
    } else {
      setFormData(prev => ({ ...prev, StatusChangeDate: '' }));
    }
    setIsStatusDateModalOpen(false);
  };

  const handleSetStatusDateToNow = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setTempStatusDate(`${year}-${month}-${day}T${hours}:${minutes}`);
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
      Vardi: formData.Vardi ? 1 : 0,
      Notes: formData.Notes || '',
      StatusChangeDate: formData.StatusChangeDate || null
    };
    try {
      if (editingRequest) {
        await api.updateRequest(editingRequest.RequestID, dataToSend);
        // Store'u güncelle — Firestore okuma YOK
        store.updateRequest(editingRequest.RequestID, {
          ...editingRequest,
          SongID: songIdNum,
          SongTitle: store.resolveSongDisplay(songIdNum),
          GuestIDs: dataToSend.GuestIDs,
          FullNames: store.resolveGuestNames(dataToSend.GuestIDs),
          Status: dataToSend.Status,
          Link: dataToSend.Link || '',
          Vardi: formData.Vardi,
          Notes: dataToSend.Notes,
          StatusChangeDate: dataToSend.StatusChangeDate
        });
      } else {
        const result = await api.createRequest(dataToSend);
        store.addRequest({
          RequestID: result.RequestID,
          RequestDate: new Date().toISOString(),
          SongID: songIdNum,
          SongTitle: store.resolveSongDisplay(songIdNum),
          GuestIDs: dataToSend.GuestIDs,
          FullNames: store.resolveGuestNames(dataToSend.GuestIDs),
          Status: dataToSend.Status,
          Link: dataToSend.Link || '',
          Vardi: formData.Vardi,
          Notes: dataToSend.Notes,
          StatusChangeDate: dataToSend.StatusChangeDate
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
      const notesMatch = (req.Notes || '').toLocaleLowerCase('tr-TR').includes(searchLower);

      if (!guestMatch && !songTitleMatch && !artistMatch && !notesMatch) {
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
              <th style={{ width: '150px', textAlign: 'right' }}>İşlemler</th>
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
                  <td data-label="İşlemler">
                    <div className="action-btns">
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', flexShrink: 0 }}>
                        {req.Notes && req.Notes.trim() ? (
                          <span
                            style={{ cursor: 'help', fontSize: '1.1rem', lineHeight: 1 }}
                            title={req.Notes}
                          >
                            📄
                          </span>
                        ) : null}
                      </div>
                      <button className="btn btn-sm btn-outline" onClick={() => openModal(req)}>Düzenle</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(req.RequestID)}>Sil</button>
                    </div>
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
                <label>Misafirler</label>
                <div className="listbox-container" style={{ minHeight: '60px', maxHeight: '120px', overflowY: 'auto', marginBottom: '0.5rem' }}>
                  {formData.GuestIDs && formData.GuestIDs.length > 0 ? (
                    formData.GuestIDs.map(id => {
                      const g = guests.find(guestItem => guestItem.GuestID === Number(id));
                      if (!g) return null;
                      return (
                        <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', borderBottom: '1px solid var(--border)', fontSize: '0.95rem' }}>
                          <span>{g.FullName}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem', minHeight: 'auto', borderRadius: '4px' }}
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                GuestIDs: prev.GuestIDs.filter(gId => String(gId) !== String(id))
                              }));
                            }}
                          >
                            Sil
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem', textAlign: 'center' }}>
                      Henüz misafir eklenmemiş.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', width: '100%' }}>
                  <input
                    type="text"
                    placeholder="Misafir ara..."
                    value={guestSearch}
                    onChange={(e) => setGuestSearch(e.target.value)}
                    style={{ flex: '0 1 30%', minWidth: '0', margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  />
                  <select
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                    style={{ flex: '0 1 45%', minWidth: '0', margin: 0, padding: '0.5rem', fontSize: '0.9rem', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white' }}
                  >
                    <option value="">Misafir Seçin...</option>
                    {guests
                      .filter(g => {
                        if (formData.GuestIDs && formData.GuestIDs.includes(String(g.GuestID))) return false;
                        return (g.FullName || '').toLocaleLowerCase('tr-TR').includes((guestSearch || '').toLocaleLowerCase('tr-TR'));
                      })
                      .map(g => (
                        <option key={g.GuestID} value={String(g.GuestID)}>
                          {g.FullName}
                        </option>
                      ))
                    }
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: '0 0 auto', padding: '0.5rem 1rem', fontWeight: 'bold', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      if (!selectedGuestId) {
                        alert("Lütfen listeden bir misafir seçin.");
                        return;
                      }
                      setFormData(prev => ({
                        ...prev,
                        GuestIDs: [...(prev.GuestIDs || []), String(selectedGuestId)]
                      }));
                      setSelectedGuestId('');
                      setGuestSearch('');
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      window.onGuestCreated = (guestId) => {
                        setFormData(prev => ({
                          ...prev,
                          GuestIDs: [...(prev.GuestIDs || []), String(guestId)]
                        }));
                      };
                      window.dispatchEvent(new CustomEvent('open-guest-modal-from-external'));
                    }}
                    style={{ flex: '0 0 auto', padding: '0.5rem 1rem', fontWeight: 'bold', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Yeni Misafir Ekle"
                  >
                    Yeni
                  </button>
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
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: '-0.25rem', marginBottom: '1rem', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
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
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {formData.StatusChangeDate ? new Date(formData.StatusChangeDate).toLocaleString('tr-TR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={handleOpenStatusDateModal}
                    style={{ padding: '0.35rem 0.5rem', fontSize: '1rem', lineHeight: 1, borderRadius: '6px', minHeight: 'auto' }}
                    title="Durum Değişiklik Tarihini Güncelle"
                  >
                    📅
                  </button>
                </div>
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
              <div className="form-group">
                <label style={{ fontSize: '0.9rem' }}>Notlar</label>
                <textarea
                  name="Notes"
                  value={formData.Notes || ''}
                  onChange={handleChange}
                  placeholder="İstekle ilgili notlar girin..."
                  style={{ fontSize: '0.85rem', resize: 'vertical', minHeight: '60px', padding: '0.5rem 0.75rem' }}
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
      {isStatusDateModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '380px', padding: '1.5rem' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Durum Değişiklik Tarihi</h2>
              <button className="close-btn" onClick={() => setIsStatusDateModalOpen(false)}>&times;</button>
            </div>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="reactStatusChangeDateInput">Tarih ve Saat</label>
              <input
                type="datetime-local"
                id="reactStatusChangeDateInput"
                value={tempStatusDate}
                onChange={(e) => setTempStatusDate(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleSetStatusDateToNow}
              style={{ width: '100%', marginBottom: '1rem', padding: '0.6rem' }}
            >
              Tarihi ŞİMDİ ile güncelle
            </button>
            <div className="modal-actions" style={{ marginTop: '1rem', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setIsStatusDateModalOpen(false)}
                style={{ flex: 1 }}
              >
                İptal
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveStatusDate}
                style={{ flex: 1 }}
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
