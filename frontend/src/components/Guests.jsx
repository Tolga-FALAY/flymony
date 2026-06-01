import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Guests() {
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  
  const [formData, setFormData] = useState({
    FirstName: '',
    LastName: '',
    PhoneNumber: '',
    InstagramLink: ''
  });

  useEffect(() => {
    loadGuests();
  }, []);

  const loadGuests = async () => {
    const data = await api.getGuests();
    setGuests(data);
  };

  const openModal = (guest = null) => {
    if (guest) {
      setEditingGuest(guest);
      setFormData({
        FirstName: guest.FirstName,
        LastName: guest.LastName,
        PhoneNumber: guest.PhoneNumber || '',
        InstagramLink: guest.InstagramLink || ''
      });
    } else {
      setEditingGuest(null);
      setFormData({ FirstName: '', LastName: '', PhoneNumber: '', InstagramLink: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGuest(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGuest) {
        await api.updateGuest(editingGuest.GuestID, formData);
      } else {
        await api.createGuest(formData);
      }
      closeModal();
      loadGuests();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu misafiri silmek istediğinize emin misiniz?')) {
      await api.deleteGuest(id);
      loadGuests();
    }
  };

  return (
    <div>
      <div className="section-header">
        <h2>Misafirler</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Yeni Misafir
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>Telefon</th>
              <th>Instagram</th>
              <th style={{width: '150px'}}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {guests.map(guest => (
              <tr key={guest.GuestID}>
                <td data-label="Ad Soyad">{guest.FullName}</td>
                <td data-label="Telefon">{guest.PhoneNumber || '-'}</td>
                <td data-label="Instagram">
                  {guest.InstagramLink ? (
                    <a href={guest.InstagramLink} target="_blank" rel="noreferrer">Profil</a>
                  ) : '-'}
                </td>
                <td data-label="İşlemler" className="action-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => openModal(guest)}>Düzenle</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(guest.GuestID)}>Sil</button>
                </td>
              </tr>
            ))}
            {guests.length === 0 && (
              <tr><td colSpan="4" style={{textAlign: 'center'}}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingGuest ? 'Misafir Düzenle' : 'Yeni Misafir Ekle'}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Ad</label>
                <input type="text" name="FirstName" value={formData.FirstName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Soyad</label>
                <input type="text" name="LastName" value={formData.LastName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Telefon Numarası</label>
                <input type="text" name="PhoneNumber" value={formData.PhoneNumber} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Instagram Linki</label>
                <input type="url" name="InstagramLink" value={formData.InstagramLink} onChange={handleChange} placeholder="https://instagram.com/..." />
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
