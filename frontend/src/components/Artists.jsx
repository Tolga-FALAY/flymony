import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import store from '../store';

export default function Artists() {
  const [artists, setArtists] = useState([]);
  const [songs, setSongs] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState(null);
  const [artistName, setArtistName] = useState('');

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({ key: 'ArtistName', direction: 'asc' });

  // Filter State
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const syncFromStore = () => {
      setArtists([...store.artists]);
      setSongs([...store.songs]);
    };
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

  // Map song counts per artist
  const songCountMap = useMemo(() => {
    const map = new Map();
    for (const s of songs) {
      for (const aId of (s.ArtistIDs || [])) {
        const idNum = Number(aId);
        map.set(idNum, (map.get(idNum) || 0) + 1);
      }
    }
    return map;
  }, [songs]);

  const artistsWithCounts = useMemo(() => {
    return artists.map(artist => ({
      ...artist,
      SongCount: songCountMap.get(Number(artist.ArtistID)) || 0
    }));
  }, [artists, songCountMap]);

  const sortedArtists = useMemo(() => {
    return [...artistsWithCounts].sort((a, b) => {
      if (sortConfig.key === 'SongCount') {
        const aCount = a.SongCount || 0;
        const bCount = b.SongCount || 0;
        if (aCount !== bCount) {
          return sortConfig.direction === 'asc' ? aCount - bCount : bCount - aCount;
        }
        // İkincil sıralama: Sanatçı Adı
        return (a.ArtistName || '').localeCompare((b.ArtistName || ''), 'tr');
      }

      if (sortConfig.key === 'ArtistID') {
        return sortConfig.direction === 'asc' 
          ? Number(a.ArtistID) - Number(b.ArtistID) 
          : Number(b.ArtistID) - Number(a.ArtistID);
      }

      const aVal = (a.ArtistName || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.ArtistName || '').toLocaleLowerCase('tr-TR');
      const res = aVal.localeCompare(bVal, 'tr');
      return sortConfig.direction === 'asc' ? res : -res;
    });
  }, [artistsWithCounts, sortConfig]);

  const filteredArtists = useMemo(() => {
    return sortedArtists.filter(artist => {
      if (filterText) {
        const search = filterText.toLocaleLowerCase('tr-TR');
        const name = (artist.ArtistName || '').toLocaleLowerCase('tr-TR');
        if (!name.includes(search)) return false;
      }
      return true;
    });
  }, [sortedArtists, filterText]);

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
              <th onClick={() => handleSort('ArtistID')} style={{ cursor: 'pointer', userSelect: 'none', width: '120px' }}>
                ID
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'ArtistID' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('ArtistID')}
                </span>
              </th>
              <th onClick={() => handleSort('ArtistName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                SANATÇI ADI
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'ArtistName' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('ArtistName')}
                </span>
              </th>
              <th onClick={() => handleSort('SongCount')} style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', width: '160px' }}>
                KAYITLI ŞARKI
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'SongCount' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('SongCount')}
                </span>
              </th>
              <th style={{ width: '150px', textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredArtists.map(artist => (
              <tr key={artist.ArtistID}>
                <td data-label="ID">{artist.ArtistID}</td>
                <td data-label="Sanatçı Adı" style={{ fontWeight: '500' }}>{artist.ArtistName}</td>
                <td data-label="Kayıtlı Şarkı" style={{ textAlign: 'center' }}>
                  <span className="badge badge-neutral" style={{ fontWeight: '600', fontSize: '0.88rem', minWidth: '28px', display: 'inline-block' }}>
                    {artist.SongCount}
                  </span>
                </td>
                <td data-label="İşlemler" className="action-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => openModal(artist)}>Düzenle</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(artist.ArtistID)}>Sil</button>
                </td>
              </tr>
            ))}
            {filteredArtists.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
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
