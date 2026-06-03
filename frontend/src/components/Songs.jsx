import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Songs() {
  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({ key: 'SongTitle', direction: 'asc' });

  // Filter States
  const [filterSong, setFilterSong] = useState('');
  const [filterArtist, setFilterArtist] = useState('');

  const clearAllFilters = () => {
    setFilterSong('');
    setFilterArtist('');
  };

  const [formData, setFormData] = useState({
    SongTitle: '',
    Duration: '',
    ArtistIDs: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [songsData, artistsData] = await Promise.all([
      api.getSongs(),
      api.getArtists()
    ]);
    setSongs(songsData);
    setArtists(artistsData);
  };

  const openModal = (song = null) => {
    if (song) {
      setEditingSong(song);
      setFormData({
        SongTitle: song.SongTitle,
        Duration: song.Duration || '',
        ArtistIDs: (song.ArtistIDs || []).map(String)
      });
    } else {
      setEditingSong(null);
      setFormData({ SongTitle: '', Duration: '', ArtistIDs: [] });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSong(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleArtistChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData({ ...formData, ArtistIDs: selectedOptions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Duplicate check: Same title and overlapping artists
    const isDuplicate = songs.some(s => {
      if (editingSong && s.SongID === editingSong.SongID) return false;
      const titleMatch = s.SongTitle && s.SongTitle.trim().toLowerCase() === formData.SongTitle.trim().toLowerCase();
      if (!titleMatch) return false;
      
      const existingArtistIDs = s.ArtistIDs || [];
      const newArtistIDs = formData.ArtistIDs.map(Number);
      
      if (existingArtistIDs.length === 0 && newArtistIDs.length === 0) return true;
      return newArtistIDs.some(id => existingArtistIDs.includes(id));
    });

    if (isDuplicate) {
      alert("Bu şarkı zaten kayıtlı!");
      return;
    }

    const dataToSend = {
      ...formData,
      ArtistIDs: formData.ArtistIDs.map(Number)
    };
    try {
      if (editingSong) {
        await api.updateSong(editingSong.SongID, dataToSend);
      } else {
        await api.createSong(dataToSend);
      }
      closeModal();
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu şarkıyı silmek istediğinize emin misiniz?')) {
      await api.deleteSong(id);
      loadData();
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedSongs = [...songs].sort((a, b) => {
    let res = 0;
    if (sortConfig.key === 'SongTitle') {
      const aVal = (a.SongTitle || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.SongTitle || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    } else if (sortConfig.key === 'ArtistNames') {
      const aVal = (a.ArtistNames || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.ArtistNames || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    }
    return sortConfig.direction === 'asc' ? res : -res;
  });

  const filteredSongs = sortedSongs.filter(song => {
    if (filterSong) {
      const searchSong = filterSong.toLocaleLowerCase('tr-TR');
      const title = (song.SongTitle || '').toLocaleLowerCase('tr-TR');
      if (!title.includes(searchSong)) return false;
    }
    if (filterArtist) {
      const searchArtist = filterArtist.toLocaleLowerCase('tr-TR');
      const artistsVal = (song.ArtistNames || '').toLocaleLowerCase('tr-TR');
      if (!artistsVal.includes(searchArtist)) return false;
    }
    return true;
  });

  const renderSortArrow = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    }
    return ' ⇅';
  };

  return (
    <div>
      <div className="section-header">
        <h2>Şarkılar ({filteredSongs.length})</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Yeni Şarkı
        </button>
      </div>

      <div className="filters-panel">
        <div className="filter-group-row">
          <div className="filter-item">
            <label htmlFor="filterSongTitleReact">Şarkı Adı</label>
            <input 
              type="text" 
              id="filterSongTitleReact" 
              placeholder="Şarkı adı ara..." 
              value={filterSong}
              onChange={(e) => setFilterSong(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label htmlFor="filterSongArtistReact">Sanatçı</label>
            <input 
              type="text" 
              id="filterSongArtistReact" 
              placeholder="Sanatçı adı ara..." 
              value={filterArtist}
              onChange={(e) => setFilterArtist(e.target.value)}
            />
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
              <th onClick={() => handleSort('SongTitle')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Şarkı Adı
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'SongTitle' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('SongTitle')}
                </span>
              </th>
              <th onClick={() => handleSort('ArtistNames')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Sanatçılar
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'ArtistNames' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('ArtistNames')}
                </span>
              </th>
              <th>Süre</th>
              <th style={{ width: '150px' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredSongs.map(song => (
              <tr key={song.SongID}>
                <td data-label="Şarkı Adı">{song.SongTitle}</td>
                <td data-label="Sanatçılar">{song.ArtistNames || '-'}</td>
                <td data-label="Süre">{song.Duration || '-'}</td>
                <td data-label="İşlemler" className="action-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => openModal(song)}>Düzenle</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(song.SongID)}>Sil</button>
                </td>
              </tr>
            ))}
            {filteredSongs.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingSong ? 'Şarkı Düzenle' : 'Yeni Şarkı Ekle'}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Şarkı Adı</label>
                <input type="text" name="SongTitle" value={formData.SongTitle} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Süre (örn: 3:45)</label>
                <input type="text" name="Duration" value={formData.Duration} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Sanatçılar (Birden fazla seçmek için CTRL/CMD basılı tutun)</label>
                <select multiple name="ArtistIDs" value={formData.ArtistIDs} onChange={handleArtistChange} style={{ height: '100px' }}>
                  {artists.map(artist => (
                    <option key={artist.ArtistID} value={String(artist.ArtistID)}>{artist.ArtistName}</option>
                  ))}
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
