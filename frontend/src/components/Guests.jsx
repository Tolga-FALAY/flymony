import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import store from '../store';

const cleanPhoneNumberForWhatsapp = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, ''); // strip non-numeric
  if (cleaned.length === 10 && cleaned.startsWith('5')) {
    cleaned = '90' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '90' + cleaned.substring(1);
  }
  return cleaned;
};

const getInstagramUsername = (url) => {
  if (!url) return '';
  const match = url.match(/(?:instagram\.com\/|instagr\.am\/)([a-zA-Z0-9_\.]+)/i);
  return match ? match[1] : '';
};

export default function Guests() {
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [contactGuest, setContactGuest] = useState(null);

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({ key: 'FullName', direction: 'asc' });

  // Filter States
  const [filterName, setFilterName] = useState('');
  const [filterNotes, setFilterNotes] = useState('');
  const [filterBirthMonth, setFilterBirthMonth] = useState('');

  const clearAllFilters = () => {
    setFilterName('');
    setFilterNotes('');
    setFilterBirthMonth('');
  };

  // Paste section target configuration
  const [activePasteSection, setActivePasteSection] = useState('profile');
  const [relationSearch, setRelationSearch] = useState('');
  const [selectedRelationId, setSelectedRelationId] = useState('');
  
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
    Photos: [],
    RelatedGuestIDs: []
  });

  const getIndirectRelations = () => {
    if (!formData.RelatedGuestIDs || formData.RelatedGuestIDs.length === 0) return [];
    
    const indirectIds = new Set();
    
    formData.RelatedGuestIDs.forEach(directId => {
      const directGuest = guests.find(g => Number(g.GuestID) === Number(directId));
      if (directGuest && directGuest.RelatedGuestIDs) {
        directGuest.RelatedGuestIDs.forEach(indirectId => {
          const indirectIdStr = String(indirectId);
          // Exclude self (the editing guest)
          if (editingGuest && String(editingGuest.GuestID) === indirectIdStr) return;
          // Exclude direct relations of the editing guest
          if (formData.RelatedGuestIDs.includes(indirectIdStr)) return;
          
          indirectIds.add(Number(indirectId));
        });
      }
    });
    
    return Array.from(indirectIds).map(id => guests.find(g => g.GuestID === id)).filter(Boolean);
  };

  const profileCameraInputRef = useRef(null);
  const profileBrowseInputRef = useRef(null);
  const galleryCameraInputRef = useRef(null);
  const galleryBrowseInputRef = useRef(null);

  useEffect(() => {
    const syncFromStore = () => setGuests([...store.guests]);
    if (store.isLoaded) {
      syncFromStore();
    } else {
      store.load().then(syncFromStore);
    }
    window.addEventListener('store-updated', syncFromStore);
    return () => window.removeEventListener('store-updated', syncFromStore);
  }, []);

  useEffect(() => {
    const handleGlobalPaste = async (event) => {
      if (!isModalOpen) return;
      if (document.activeElement && document.activeElement.name === 'Notes') {
        return;
      }
      
      const items = (event.clipboardData || event.originalEvent.clipboardData).items;
      let imageFile = null;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          imageFile = item.getAsFile();
          break;
        }
      }
      
      if (imageFile) {
        event.preventDefault();
        try {
          if (activePasteSection === 'profile') {
            const compressedBase64 = await compressImage(imageFile, 250, 250, 0.75);
            setFormData(prev => ({ ...prev, ProfilePicture: compressedBase64 }));
          } else if (activePasteSection === 'gallery') {
            const compressedBase64 = await compressImage(imageFile, 800, 800, 0.7);
            setFormData(prev => ({
              ...prev,
              Photos: [...prev.Photos, compressedBase64]
            }));
          }
        } catch (err) {
          alert("Görsel yapıştırılırken hata oluştu: " + err.message);
        }
      }
    };
    
    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, [isModalOpen, activePasteSection]);

  useEffect(() => {
    const handleOpenExternal = () => {
      openModal();
    };
    window.addEventListener('open-guest-modal-from-external', handleOpenExternal);
    return () => window.removeEventListener('open-guest-modal-from-external', handleOpenExternal);
  }, []);

  const openModal = (guest = null) => {
    setRelationSearch('');
    setSelectedRelationId('');
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
        Photos: guest.Photos || [],
        RelatedGuestIDs: (guest.RelatedGuestIDs || []).map(String)
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
        Photos: [],
        RelatedGuestIDs: []
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGuest(null);
    setRelationSearch('');
    setSelectedRelationId('');
    if (typeof window.onGuestCreated === 'function') {
      window.onGuestCreated = null;
    }
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

  const pasteProfilePicture = async () => {
    setActivePasteSection('profile');
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        throw new Error("Tarayıcı doğrudan pano okuma özelliğini desteklemiyor.");
      }
      const clipboardItems = await navigator.clipboard.read();
      let found = false;
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const compressedBase64 = await compressImage(blob, 250, 250, 0.75);
            setFormData(prev => ({ ...prev, ProfilePicture: compressedBase64 }));
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        alert("Panoda doğrudan okunabilir bir görsel bulunamadı.\n\nEğer Windows Explorer'dan bir dosya kopyaladıysanız, lütfen modal açıkken klavyenizden CTRL+V tuşlarına basarak yapıştırın!");
      }
    } catch (err) {
      alert("Doğrudan pano okuma engellendi (Güvenlik Kısıtlaması).\n\nLütfen görselinizi yapıştırmak için klavyenizden CTRL+V kısayolunu kullanın!");
    }
  };

  const pasteGalleryPhoto = async () => {
    setActivePasteSection('gallery');
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        throw new Error("Tarayıcı doğrudan pano okuma özelliğini desteklemiyor.");
      }
      const clipboardItems = await navigator.clipboard.read();
      let found = false;
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const compressedBase64 = await compressImage(blob, 800, 800, 0.7);
            setFormData(prev => ({
              ...prev,
              Photos: [...prev.Photos, compressedBase64]
            }));
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        alert("Panoda doğrudan okunabilir bir görsel bulunamadı.\n\nEğer Windows Explorer'dan bir dosya kopyaladıysanız, lütfen modal açıkken klavyenizden CTRL+V tuşlarına basarak yapıştırın!");
      }
    } catch (err) {
      alert("Doğrudan pano okuma engellendi (Güvenlik Kısıtlaması).\n\nLütfen görselinizi yapıştırmak için klavyenizden CTRL+V kısayolunu kullanın!");
    }
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

    // Duplicate check: check if FirstName & LastName already exists (case-insensitive, trimmed)
    const normalizedFirstName = formData.FirstName.trim().toLowerCase();
    const normalizedLastName = formData.LastName.trim().toLowerCase();
    const existingGuest = guests.find(g => 
      (!editingGuest || g.GuestID !== editingGuest.GuestID) &&
      g.FirstName.trim().toLowerCase() === normalizedFirstName && 
      g.LastName.trim().toLowerCase() === normalizedLastName
    );

    if (existingGuest) {
      alert("Bu isimde bir misafir zaten kayıtlı!");
      const goToExisting = window.confirm("İlgili kayda gitmek ister misiniz?");
      if (goToExisting) {
        openModal(existingGuest);
      } else {
        closeModal();
      }
      return;
    }

    try {
      const payload = {
        ...formData,
        RelatedGuestIDs: (formData.RelatedGuestIDs || []).map(Number)
      };
      if (editingGuest) {
        await api.updateGuest(editingGuest.GuestID, payload);
        // Store'u güncelle — Firestore okuma YOK
        store.updateGuest(editingGuest.GuestID, {
          ...payload,
          GuestID:  editingGuest.GuestID,
          FullName: `${payload.FirstName} ${payload.LastName}`.trim()
        });
      } else {
        const result = await api.createGuest(payload);
        store.addGuest({
          ...payload,
          GuestID:  result.GuestID,
          FullName: `${payload.FirstName} ${payload.LastName}`.trim(),
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString()
        });
        if (typeof window.onGuestCreated === 'function') {
          window.onGuestCreated(result.GuestID);
          window.onGuestCreated = null;
        }
      }
      closeModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      // Bağlantı kontrolü: Firestore okuma YOK — bellekteki store kullanılır
      const isLinked = store.requests.some(r => (r.GuestIDs || []).includes(Number(id)));
      if (isLinked) {
        alert("Bu şarkıyı veya misafiri silmek için önce bu şarkının ve misafirin kayıtlı olduğu tüm istek kayıtlarını silmelisiniz");
        return;
      }
      if (window.confirm('Bu misafiri silmek istediğinize emin misiniz?')) {
        await api.deleteGuest(id);
        store.removeGuest(Number(id));
      }
    } catch (err) {
      alert("Silme hatası: " + err.message);
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

  const filteredGuests = sortedGuests.filter(guest => {
    // 1. Name & Surname filter
    if (filterName) {
      const searchName = filterName.toLocaleLowerCase('tr-TR');
      const fullName = (guest.FullName || '').toLocaleLowerCase('tr-TR');
      if (!fullName.includes(searchName)) {
        return false;
      }
    }

    // 2. Notes filter
    if (filterNotes) {
      const searchNotes = filterNotes.toLocaleLowerCase('tr-TR');
      const notes = (guest.Notes || '').toLocaleLowerCase('tr-TR');
      if (!notes.includes(searchNotes)) {
        return false;
      }
    }

    // 3. Birth Month filter
    if (filterBirthMonth) {
      if (Number(guest.BirthDateMonth) !== Number(filterBirthMonth)) {
        return false;
      }
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
        <h2>Misafirler ({filteredGuests.length})</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Yeni Misafir
        </button>
      </div>

      <div className="filters-panel">
        <div className="filter-group-row">
          <div className="filter-item">
            <label htmlFor="filterGuestNameReact">Misafir Adı / Soyadı</label>
            <input 
              type="text" 
              id="filterGuestNameReact" 
              placeholder="Ad veya soyad ara..." 
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label htmlFor="filterGuestNotesReact">Notlar</label>
            <input 
              type="text" 
              id="filterGuestNotesReact" 
              placeholder="Not içeriğinde ara..." 
              value={filterNotes}
              onChange={(e) => setFilterNotes(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label htmlFor="filterGuestMonthReact">Doğum Ayı</label>
            <select 
              id="filterGuestMonthReact"
              value={filterBirthMonth}
              onChange={(e) => setFilterBirthMonth(e.target.value)}
            >
              <option value="">Tüm Aylar</option>
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
              <th style={{width: '150px', textAlign: 'right'}}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredGuests.map(guest => (
              <tr key={guest.GuestID}>
                <td data-label="Misafir" className="td-guest-profile">
                  <div className="guest-profile-content">
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
                  </div>
                </td>
                <td data-label="Telefon">
                  {guest.PhoneNumber ? (
                    <span
                      style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setContactGuest(guest)}
                    >
                      {guest.PhoneNumber}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td data-label="Instagram">
                  {guest.InstagramLink ? (
                    <a href={guest.InstagramLink} target="_blank" rel="noreferrer" className="instagram-link-badge">Profil</a>
                  ) : '-'}
                </td>
                <td data-label="Doğum Tarihi">
                  {formatBirthDate(guest.BirthDateDay, guest.BirthDateMonth, guest.BirthDateYear)}
                </td>
                <td data-label="Notlar" className="td-notes-preview" title={guest.Notes}>
                  <span className="notes-text">{guest.Notes || '-'}</span>
                </td>
                <td data-label="İşlemler">
                  <div className="action-btns">
                    <button className="btn btn-sm btn-outline" onClick={() => openModal(guest)}>Düzenle</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(guest.GuestID)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredGuests.length === 0 && (
              <tr><td colSpan="6" style={{textAlign: 'center'}}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && createPortal(
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
                    <button type="button" className="btn btn-sm btn-outline" onClick={pasteProfilePicture}>
                      📋 Yapıştır
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
                  style={{ resize: 'vertical' }}
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
                    <button type="button" className="btn btn-sm btn-outline" onClick={pasteGalleryPhoto}>
                      📋 Yapıştır
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

              {/* İlişkili Misafirler Field */}
              <div className="form-group">
                <label>İlişkili Misafirler</label>
                <div className="listbox-container" style={{ minHeight: '60px', maxHeight: '120px', overflowY: 'auto', marginBottom: '0.5rem' }}>
                  {formData.RelatedGuestIDs && formData.RelatedGuestIDs.length > 0 ? (
                    formData.RelatedGuestIDs.map(id => {
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
                                RelatedGuestIDs: prev.RelatedGuestIDs.filter(rId => String(rId) !== String(id))
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
                      Henüz ilişkili misafir eklenmemiş.
                    </div>
                  )}
                </div>

                {/* Dolaylı İlişkili Misafirler */}
                {getIndirectRelations().length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.25rem', fontWeight: '500' }}>
                      Dolaylı İlişkiler
                    </div>
                    <div className="listbox-container" style={{ minHeight: '40px', maxHeight: '100px', overflowY: 'auto', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '0.25rem' }}>
                      {getIndirectRelations().map(g => (
                        <div
                          key={g.GuestID}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            background: '#f1f5f9',
                            color: '#64748b', // sönük gri renk
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            margin: '0.2rem',
                            fontSize: '0.85rem',
                            border: '1px solid #e2e8f0',
                            gap: '0.4rem'
                          }}
                        >
                          <span>{g.FullName}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{
                              padding: '0 0.25rem',
                              fontSize: '0.75rem',
                              minHeight: 'auto',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '18px',
                              lineHeight: 1
                            }}
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                RelatedGuestIDs: [...(prev.RelatedGuestIDs || []), String(g.GuestID)]
                              }));
                            }}
                          >
                            İlişki Ekle
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="İlişkili misafir ara..."
                    value={relationSearch}
                    onChange={(e) => setRelationSearch(e.target.value)}
                    style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  />
                  <select
                    value={selectedRelationId}
                    onChange={(e) => setSelectedRelationId(e.target.value)}
                    style={{ flex: 1.5, margin: 0, padding: '0.5rem', fontSize: '0.9rem', height: '38px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="">Misafir Seçin...</option>
                    {guests
                      .filter(g => {
                        if (editingGuest && g.GuestID === editingGuest.GuestID) return false;
                        if (formData.RelatedGuestIDs && formData.RelatedGuestIDs.includes(String(g.GuestID))) return false;
                        return (g.FullName || '').toLocaleLowerCase('tr-TR').includes(relationSearch.toLocaleLowerCase('tr-TR'));
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
                    style={{ padding: '0.5rem 1rem', fontWeight: 'bold', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      if (!selectedRelationId) {
                        alert("Lütfen listeden bir misafir seçin.");
                        return;
                      }
                      setFormData(prev => ({
                        ...prev,
                        RelatedGuestIDs: [...(prev.RelatedGuestIDs || []), String(selectedRelationId)]
                      }));
                      setSelectedRelationId('');
                      setRelationSearch('');
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="modal-actions" style={{marginTop: '2rem'}}>
                <button type="button" className="btn btn-outline" onClick={closeModal}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {contactGuest && (() => {
        const phoneClean = cleanPhoneNumberForWhatsapp(contactGuest.PhoneNumber);
        const igUsername = getInstagramUsername(contactGuest.InstagramLink);
        return (
          <div className="modal-overlay" style={{ zIndex: 1300 }}>
            <div className="modal-content" style={{ maxWidth: '350px', padding: '1.5rem', borderRadius: '12px' }}>
              <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>İletişim Seçenekleri</h2>
                <button type="button" className="close-btn" onClick={() => setContactGuest(null)}>&times;</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#1e293b', marginBottom: '0.75rem', textAlign: 'center' }}>
                  {contactGuest.FullName}
                </div>
                
                {/* Mobil Arama */}
                <a
                  href={`tel:${contactGuest.PhoneNumber}`}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit' }}
                  onClick={() => setContactGuest(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '10px', color: '#3b82f6' }}>
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                    <line x1="12" y1="18" x2="12.01" y2="18"></line>
                  </svg>
                  Mobil Arama
                </a>
                
                {/* WhatsApp Arama */}
                <a
                  href={`whatsapp://call?phone=${phoneClean}`}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit' }}
                  onClick={() => setContactGuest(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '10px', color: '#22c55e' }}>
                    <path d="M12.004 2C6.51 2 2.014 6.5 2.014 12c0 2.13.67 4.13 1.81 5.79l-1.2 4.41 4.54-1.18c1.58.86 3.38 1.3 5.24 1.3 5.494 0 9.99-4.5 9.99-10S17.498 2 12.004 2zm0 1.95c4.43 0 8.04 3.61 8.04 8.05s-3.61 8.05-8.04 8.05c-1.63 0-3.19-.5-4.52-1.42l-.33-.21-2.73.71.73-2.67-.25-.37c-1.02-1.42-1.57-3.12-1.57-4.89 0-4.44 3.61-8.05 8.04-8.05zM9.474 8.01c-.18 0-.46.07-.7.33-.25.26-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.19 1.9 2.9 4.62 4.08.65.28 1.15.45 1.54.57.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.82-1.29.23-.63.23-1.18.16-1.29-.07-.11-.25-.18-.53-.32-.28-.14-1.19-.44-2.27-1.4-.84-.75-1.4-1.67-1.57-1.95-.17-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.27.28-.46.09-.18.05-.35-.02-.48-.07-.14-.61-1.48-.84-2.02-.22-.54-.45-.46-.61-.47h-.49z"/>
                  </svg>
                  WhatsApp Arama
                </a>
                
                {/* WhatsApp Mesaj */}
                <a
                  href={`https://wa.me/${phoneClean}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit' }}
                  onClick={() => setContactGuest(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '10px', color: '#22c55e' }}>
                    <path d="M12.004 2C6.51 2 2.014 6.5 2.014 12c0 2.13.67 4.13 1.81 5.79l-1.2 4.41 4.54-1.18c1.58.86 3.38 1.3 5.24 1.3 5.494 0 9.99-4.5 9.99-10S17.498 2 12.004 2zm0 1.95c4.43 0 8.04 3.61 8.04 8.05s-3.61 8.05-8.04 8.05c-1.63 0-3.19-.5-4.52-1.42l-.33-.21-2.73.71.73-2.67-.25-.37c-1.02-1.42-1.57-3.12-1.57-4.89 0-4.44 3.61-8.05 8.04-8.05zM9.474 8.01c-.18 0-.46.07-.7.33-.25.26-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.19 1.9 2.9 4.62 4.08.65.28 1.15.45 1.54.57.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.82-1.29.23-.63.23-1.18.16-1.29-.07-.11-.25-.18-.53-.32-.28-.14-1.19-.44-2.27-1.4-.84-.75-1.4-1.67-1.57-1.95-.17-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.27.28-.46.09-.18.05-.35-.02-.48-.07-.14-.61-1.48-.84-2.02-.22-.54-.45-.46-.61-.47h-.49z"/>
                  </svg>
                  WhatsApp Mesaj
                </a>
                
                {/* Instagram DM Mesaj */}
                {contactGuest.InstagramLink && igUsername && (
                  <a
                    href={`https://instagram.com/direct/t/${igUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit' }}
                    onClick={() => setContactGuest(null)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style={{ marginRight: '10px', color: '#ec4899' }}>
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                    Instagram DM Mesaj
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
