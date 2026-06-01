import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

export default function Guests() {
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({ key: 'FullName', direction: 'asc' });
  
  const [formData, setFormData] = useState({
    FirstName: '',
    LastName: '',
    PhoneNumber: '',
    InstagramLink: '',
    Notes: '',
    ProfilePicture: '',
    BirthDateDay: '',
    BirthDateMonth: '',
    BirthDateYear: '',
    Photos: []
  });

  const profileCameraInputRef = useRef(null);
  const profileBrowseInputRef = useRef(null);
  const galleryCameraInputRef = useRef(null);
  const galleryBrowseInputRef = useRef(null);

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
        InstagramLink: guest.InstagramLink || '',
        Notes: guest.Notes || '',
        ProfilePicture: guest.ProfilePicture || '',
        BirthDateDay: guest.BirthDateDay || '',
        BirthDateMonth: guest.BirthDateMonth || '',
        BirthDateYear: guest.BirthDateYear || '',
        Photos: guest.Photos || []
      });
    } else {
      setEditingGuest(null);
      setFormData({
        FirstName: '',
        LastName: '',
        PhoneNumber: '',
        InstagramLink: '',
        Notes: '',
        ProfilePicture: '',
        BirthDateDay: '',
        BirthDateMonth: '',
        BirthDateYear: '',
        Photos: []
      });
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

  // HTML5 Canvas client-side image compression
  const compressImage = (file, maxWidth, maxHeight, quality = 0.7) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
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
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  // Profile Picture Handlers
  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // Compress to 250x250px for circular avatars
      const compressedBase64 = await compressImage(file, 250, 250, 0.75);
      setFormData(prev => ({ ...prev, ProfilePicture: compressedBase64 }));
    } catch (err) {
      alert("Profil resmi işlenirken hata oluştu: " + err.message);
    }
  };

  const removeProfilePicture = () => {
    setFormData(prev => ({ ...prev, ProfilePicture: '' }));
  };

  // Multi-photo Gallery Handlers
  const handleGalleryPhotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    try {
      const uploadPromises = files.map(file => compressImage(file, 800, 800, 0.7));
      const compressedImages = await Promise.all(uploadPromises);
      setFormData(prev => ({
        ...prev,
        Photos: [...prev.Photos, ...compressedImages]
      }));
    } catch (err) {
      alert("Galeri resimleri işlenirken hata oluştu: " + err.message);
    }
  };

  const removeGalleryPhoto = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      Photos: prev.Photos.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation for optional date of birth:
    // If any date field is selected, Day and Month are mandatory, Year is optional.
    const { BirthDateDay, BirthDateMonth, BirthDateYear } = formData;
    if (BirthDateDay || BirthDateMonth || BirthDateYear) {
      if (!BirthDateDay || !BirthDateMonth) {
        alert("Doğum tarihi giriliyorsa Gün ve Ay alanları zorunludur!");
        return;
      }
    }

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

  // Helpers
  const getInitials = (first, last) => {
    const f = first ? first.charAt(0).toUpperCase() : '';
    const l = last ? last.charAt(0).toUpperCase() : '';
    return `${f}${l}`;
  };

  const formatBirthDate = (day, month, year) => {
    if (!day || !month) return '-';
    const months = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];
    const monthName = months[parseInt(month) - 1] || month;
    return year ? `${day} ${monthName} ${year}` : `${day} ${monthName}`;
  };

  // Generate Year Array from current year down to 1920
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 1920; y--) {
    years.push(y);
  }

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedGuests = [...guests].sort((a, b) => {
    let res = 0;
    if (sortConfig.key === 'FullName') {
      const aVal = (a.FullName || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.FullName || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    } else if (sortConfig.key === 'BirthDate') {
      const hasA = a.BirthDateDay && a.BirthDateMonth;
      const hasB = b.BirthDateDay && b.BirthDateMonth;
      if (!hasA && !hasB) return 0;
      if (!hasA) return 1;
      if (!hasB) return -1;

      if (Number(a.BirthDateMonth) !== Number(b.BirthDateMonth)) {
        res = Number(a.BirthDateMonth) - Number(b.BirthDateMonth);
      } else {
        res = Number(a.BirthDateDay) - Number(b.BirthDateDay);
      }
    }
    return sortConfig.direction === 'asc' ? res : -res;
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
        <h2>Misafirler ({guests.length})</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Yeni Misafir
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('FullName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Misafir
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'FullName' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('FullName')}
                </span>
              </th>
              <th>Telefon</th>
              <th>Instagram</th>
              <th onClick={() => handleSort('BirthDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Doğum Tarihi
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'BirthDate' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('BirthDate')}
                </span>
              </th>
              <th>Notlar</th>
              <th style={{width: '150px'}}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {sortedGuests.map(guest => (
              <tr key={guest.GuestID}>
                <td data-label="Misafir" className="td-guest-profile">
                  <div className="guest-avatar-wrapper">
                    {guest.ProfilePicture ? (
                      <img src={guest.ProfilePicture} alt={guest.FullName} className="guest-avatar-img" />
                    ) : (
                      <div className="guest-avatar-initials">
                        {getInitials(guest.FirstName, guest.LastName)}
                      </div>
                    )}
                  </div>
                  <span className="guest-name-text">{guest.FullName}</span>
                </td>
                <td data-label="Telefon">{guest.PhoneNumber || '-'}</td>
                <td data-label="Instagram">
                  {guest.InstagramLink ? (
                    <a href={guest.InstagramLink} target="_blank" rel="noreferrer" className="instagram-link-badge">Profil</a>
                  ) : '-'}
                </td>
                <td data-label="Doğum Tarihi">
                  {formatBirthDate(guest.BirthDateDay, guest.BirthDateMonth, guest.BirthDateYear)}
                </td>
                <td data-label="Notlar" className="td-notes-preview" title={guest.Notes}>
                  {guest.Notes ? (guest.Notes.length > 30 ? guest.Notes.substring(0, 30) + '...' : guest.Notes) : '-'}
                </td>
                <td data-label="İşlemler" className="action-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => openModal(guest)}>Düzenle</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(guest.GuestID)}>Sil</button>
                </td>
              </tr>
            ))}
            {sortedGuests.length === 0 && (
              <tr><td colSpan="6" style={{textAlign: 'center'}}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="modal-header">
              <h2>{editingGuest ? 'Misafir Düzenle' : 'Yeni Misafir Ekle'}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem'}}>
                {/* Profile Picture Upload (Left/Top Column) */}
                <div className="form-group profile-picture-upload-section" style={{flex: '1 1 200px', alignItems: 'center', textAlign: 'center'}}>
                  <label style={{width: '100%'}}>Profil Resmi</label>
                  <div className="profile-preview-container">
                    {formData.ProfilePicture ? (
                      <div className="profile-img-preview-wrapper">
                        <img src={formData.ProfilePicture} alt="Profil Önizleme" />
                        <button type="button" className="profile-img-delete-badge" onClick={removeProfilePicture} title="Resmi Sil">&times;</button>
                      </div>
                    ) : (
                      <div className="profile-preview-placeholder">
                        <span>RESİM YOK</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="upload-btn-group" style={{marginTop: '0.75rem', display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center'}}>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => profileCameraInputRef.current?.click()}>
                      📷 Anlık Çek
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => profileBrowseInputRef.current?.click()}>
                      📂 Galeriden Seç
                    </button>
                  </div>
                  
                  <input 
                    type="file" 
                    ref={profileCameraInputRef} 
                    accept="image/*" 
                    capture="environment" 
                    style={{display: 'none'}} 
                    onChange={handleProfilePictureUpload} 
                  />
                  <input 
                    type="file" 
                    ref={profileBrowseInputRef} 
                    accept="image/*" 
                    style={{display: 'none'}} 
                    onChange={handleProfilePictureUpload} 
                  />
                </div>

                {/* Identity Info (Right/Bottom Column) */}
                <div style={{flex: '1 1 350px'}}>
                  <div className="form-group">
                    <label>Ad</label>
                    <input type="text" name="FirstName" value={formData.FirstName} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>Soyad</label>
                    <input type="text" name="LastName" value={formData.LastName} onChange={handleChange} required />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Telefon Numarası</label>
                <input type="text" name="PhoneNumber" value={formData.PhoneNumber} onChange={handleChange} />
              </div>
              
              <div className="form-group">
                <label>Instagram Linki</label>
                <input type="url" name="InstagramLink" value={formData.InstagramLink} onChange={handleChange} placeholder="https://instagram.com/..." />
              </div>

              {/* Birth Date Section */}
              <div className="form-group">
                <label>Doğum Tarihi (Gün ve Ay zorunlu, Yıl opsiyoneldir)</label>
                <div className="birthdate-select-row" style={{display: 'flex', gap: '0.75rem'}}>
                  <select name="BirthDateDay" value={formData.BirthDateDay} onChange={handleChange} style={{flex: 1}}>
                    <option value="">Gün</option>
                    {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  
                  <select name="BirthDateMonth" value={formData.BirthDateMonth} onChange={handleChange} style={{flex: 1.5}}>
                    <option value="">Ay</option>
                    <option value="1">Ocak</option>
                    <option value="2">Şubat</option>
                    <option value="3">Mart</option>
                    <option value="4">Nisan</option>
                    <option value="5">Mayıs</option>
                    <option value="6">Haziran</option>
                    <option value="7">Temmuz</option>
                    <option value="8">Ağustos</option>
                    <option value="9">Eylül</option>
                    <option value="10">Ekim</option>
                    <option value="11">Kasım</option>
                    <option value="12">Aralık</option>
                  </select>

                  <select name="BirthDateYear" value={formData.BirthDateYear} onChange={handleChange} style={{flex: 1.2}}>
                    <option value="">Yıl</option>
                    {years.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes Field */}
              <div className="form-group">
                <label>Notlar</label>
                <textarea 
                  name="Notes" 
                  value={formData.Notes} 
                  onChange={handleChange} 
                  rows="4" 
                  placeholder="Misafir hakkında özel notlar, tercihler..."
                  style={{
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1', 
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Photos Gallery Section */}
              <div className="form-group gallery-photos-section" style={{marginTop: '1.5rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
                  <label style={{margin: 0}}>Misafir ile Çekilmiş Fotoğraflar</label>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => galleryCameraInputRef.current?.click()}>
                      📷 Fotoğraf Çek
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => galleryBrowseInputRef.current?.click()}>
                      📂 Görsel Ekle
                    </button>
                  </div>
                </div>

                <input 
                  type="file" 
                  ref={galleryCameraInputRef} 
                  accept="image/*" 
                  capture="environment" 
                  multiple 
                  style={{display: 'none'}} 
                  onChange={handleGalleryPhotosUpload} 
                />
                <input 
                  type="file" 
                  ref={galleryBrowseInputRef} 
                  accept="image/*" 
                  multiple 
                  style={{display: 'none'}} 
                  onChange={handleGalleryPhotosUpload} 
                />

                {/* Previews Grid */}
                <div className="gallery-previews-grid">
                  {formData.Photos && formData.Photos.map((photo, index) => (
                    <div key={index} className="gallery-preview-item">
                      <img src={photo} alt={`Galeri Önizleme ${index + 1}`} />
                      <button type="button" className="gallery-preview-delete-badge" onClick={() => removeGalleryPhoto(index)} title="Fotoğrafı Sil">&times;</button>
                    </div>
                  ))}
                  {(!formData.Photos || formData.Photos.length === 0) && (
                    <div className="gallery-empty-placeholder">
                      <span>Henüz fotoğraf eklenmemiş. Anlık çekebilir veya cihazınızdan seçebilirsiniz.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-actions" style={{marginTop: '2rem'}}>
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
