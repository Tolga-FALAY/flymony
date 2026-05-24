import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [songs, setSongs] = useState([]);
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    SongID: '',
    GuestID: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [requestsData, songsData, guestsData] = await Promise.all([
      api.getRequests(),
      api.getSongs(),
      api.getGuests()
    ]);
    setRequests(requestsData);
    setSongs(songsData);
    setGuests(guestsData);
  };

  const openModal = () => {
    setFormData({ SongID: '', GuestID: '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.createRequest(formData);
    closeModal();
    loadData();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu isteği silmek istediğinize emin misiniz?')) {
      await api.deleteRequest(id);
      loadData();
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2>Şarkı İstekleri</h2>
        <button className="btn btn-primary" onClick={openModal}>
          + Yeni İstek Ekle
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tarih / Saat</th>
              <th>Misafir</th>
              <th>İstenen Şarkı</th>
              <th style={{width: '100px'}}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => {
              const dateObj = new Date(req.RequestDate + 'Z'); // SQLite UTC time
              return (
                <tr key={req.RequestID}>
                  <td>{dateObj.toLocaleString('tr-TR')}</td>
                  <td>{req.FullName}</td>
                  <td>{req.SongTitle}</td>
                  <td className="action-btns">
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(req.RequestID)}>Sil</button>
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr><td colSpan="4" style={{textAlign: 'center'}}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Yeni İstek</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Misafir Seçin</label>
                <select name="GuestID" value={formData.GuestID} onChange={handleChange} required>
                  <option value="">-- Misafir --</option>
                  {guests.map(g => (
                    <option key={g.GuestID} value={g.GuestID}>{g.FullName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Şarkı Seçin</label>
                <select name="SongID" value={formData.SongID} onChange={handleChange} required>
                  <option value="">-- Şarkı --</option>
                  {songs.map(s => (
                    <option key={s.SongID} value={s.SongID}>{s.SongTitle} {s.ArtistNames ? `(${s.ArtistNames})` : ''}</option>
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
