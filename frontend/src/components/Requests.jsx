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
                <select multiple name="GuestIDs" value={formData.GuestIDs} onChange={handleGuestChange} style={{ height: '100px' }} required>
                  {guests.map(g => (
                    <option key={g.GuestID} value={String(g.GuestID)}>{g.FullName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Şarkı Seçin</label>
                <select name="SongID" value={formData.SongID} onChange={handleChange} required>
                  <option value="">-- Şarkı --</option>
                  {sortedSongs.map(s => (
                    <option key={s.SongID} value={String(s.SongID)}>
                      {s.SongTitle} {s.ArtistNames && s.ArtistNames !== '-' ? `(${s.ArtistNames})` : ''}
                    </option>
                  ))}
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
    </div>
  );
}
