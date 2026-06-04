import React, { useState, useEffect } from 'react';
import { api } from '../api';
import store from '../store';

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState(null);
  const [artistName, setArtistName] = useState('');

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({ key: 'ArtistName', direction: 'asc' });

  // Filter State
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const syncFromStore = () => setArtists([...store.artists]);
    if (store.isLoaded) {
      syncFromStore();
    } else {
      store.load().then(syncFromStore);
    }
    window.addEventListener('store-updated', syncFromStore);
    return () => window.removeEventListener('store-updated', syncFromStore);
  }, []);

  const openModal = (artist = null) => {
    if (artist) {
      setEditingArtist(artist);
      setArtistName(artist.ArtistName);
    } else {
      setEditingArtist(null);
      setArtistName('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingArtist(null);
    setArtistName('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingArtist) {
        await api.updateArtist(editingArtist.ArtistID, { ArtistName: artistName });
        // Store'u güncelle — Firestore'a okuma yapmadan
        store.updateArtist(editingArtist.ArtistID, { ArtistName: artistName });
      } else {
        const result = await api.createArtist({ ArtistName: artistName });
        store.addArtist({ ArtistID: result.ArtistID, ArtistName: artistName });
      }
      closeModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      // Bağlantı kontrolü: Firestore okuma YOK — bellekteki store kullanılır
      const isLinked = store.songs.some(s => (s.ArtistIDs || []).includes(Number(id)));
      if (isLinked) {
        alert("Bu sanatçı bir şarkıda kayıtlı, sanatçıyı silmek için önce ilgili şarkı kaydınız silmeniz gerekir");
        return;
      }
      if (window.confirm('Bu sanatçıyı silmek istediğinize emin misiniz?')) {
        await api.deleteArtist(id);
        store.removeArtist(Number(id));
      }
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedArtists = [...artists].sort((a, b) => {
    const aVal = (a.ArtistName || '').toLocaleLowerCase('tr-TR');
    const bVal = (b.ArtistName || '').toLocaleLowerCase('tr-TR');
    const res = aVal.localeCompare(bVal, 'tr');
    return sortConfig.direction === 'asc' ? res : -res;
  });

  const filteredArtists = sortedArtists.filter(artist => {
    if (filterText) {
      const search = filterText.toLocaleLowerCase('tr-TR');
      const name = (artist.ArtistName || '').toLocaleLowerCase('tr-TR');
      if (!name.includes(search)) return false;
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
        <h2>Sanatçılar ({filteredArtists.length})</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Yeni Sanatçı
        </button>
      </div>

      <div className="filters-panel">
        <div className="filter-group-row">
          <div className="filter-item">
            <label htmlFor="filterArtistNameReact">Sanatçı Adı</label>
            <input 
              type="text" 
              id="filterArtistNameReact" 
              placeholder="Sanatçı adı ara..." 
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
          <div className="filter-item filter-actions">
            <button className="btn btn-outline btn-sm" onClick={() => setFilterText('')}>Temizle</button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th onClick={() => handleSort('ArtistName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Sanatçı Adı
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'ArtistName' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('ArtistName')}
                </span>
              </th>
              <th style={{width: '150px'}}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredArtists.map(artist => (
              <tr key={artist.ArtistID}>
                <td data-label="ID">{artist.ArtistID}</td>
                <td data-label="Sanatçı Adı">{artist.ArtistName}</td>
                <td data-label="İşlemler" className="action-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => openModal(artist)}>Düzenle</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(artist.ArtistID)}>Sil</button>
                </td>
              </tr>
            ))}
            {filteredArtists.length === 0 && (
              <tr><td colSpan="3" style={{textAlign: 'center'}}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingArtist ? 'Sanatçı Düzenle' : 'Yeni Sanatçı Ekle'}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Sanatçı Adı</label>
                <input 
                  type="text" 
                  value={artistName} 
                  onChange={e => setArtistName(e.target.value)} 
                  required 
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
    </div>
  );
}
