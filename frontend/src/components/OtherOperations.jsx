import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import store from '../store';

export default function OtherOperations() {
  const [currentView, setCurrentView] = useState('home'); // 'home' or 'bulk-photo'
  const [guests, setGuests] = useState([]);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [selectedGuestIds, setSelectedGuestIds] = useState(new Set());
  const [guestSearch, setGuestSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const cameraInputRef = useRef(null);
  const browseInputRef = useRef(null);


  // Global paste handler for images when in bulk photo panel
  useEffect(() => {
    const handleGlobalPaste = async (event) => {
      if (currentView !== 'bulk-photo') return;
      if (document.activeElement && document.activeElement.name === 'guestSearch') {
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
          const compressedBase64 = await compressImage(imageFile, 800, 800, 0.7);
          setSelectedPhotos(prev => [...prev, compressedBase64]);
        } catch (err) {
          alert("Görsel yapıştırılırken hata oluştu: " + err.message);
        }
      }
    };
    
    document.addEventListener('paste', handleGlobalPaste);
    return () => {
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }, [currentView]);

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

  const handlePhotosUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    try {
      const promises = files.map(file => compressImage(file, 800, 800, 0.7));
      const compressedImages = await Promise.all(promises);
      setSelectedPhotos(prev => [...prev, ...compressedImages]);
    } catch (err) {
      alert("Görsel yüklenirken hata oluştu: " + err.message);
    }
    e.target.value = ""; // Reset
  };

  const removePhoto = (indexToRemove) => {
    setSelectedPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const pastePhoto = async () => {
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
            setSelectedPhotos(prev => [...prev, compressedBase64]);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        alert("Panoda doğrudan okunabilir bir görsel bulunamadı.\n\nEğer Windows Explorer'dan bir dosya kopyaladıysanız, lütfen bu panel açıkken klavyenizden CTRL+V tuşlarına basarak yapıştırın!");
      }
    } catch (err) {
      alert("Doğrudan pano okuma engellendi (Güvenlik Kısıtlaması).\n\nLütfen görselinizi yapıştırmak için klavyenizden CTRL+V kısayolunu kullanın!");
    }
  };

  const toggleGuestSelection = (guestId) => {
    setSelectedGuestIds(prev => {
      const next = new Set(prev);
      if (next.has(guestId)) {
        next.delete(guestId);
      } else {
        next.add(guestId);
      }
      return next;
    });
  };

  const selectAllFilteredGuests = () => {
    const filtered = guests.filter(g => {
      const fullName = (g.FullName || '').toLocaleLowerCase('tr-TR');
      return fullName.includes(guestSearch.toLocaleLowerCase('tr-TR'));
    });
    setSelectedGuestIds(prev => {
      const next = new Set(prev);
      filtered.forEach(g => next.add(g.GuestID));
      return next;
    });
  };

  const clearGuestSelection = () => {
    setSelectedGuestIds(new Set());
  };

  const handleSave = async () => {
    if (selectedPhotos.length === 0) {
      alert("Lütfen en az bir fotoğraf ekleyin.");
      return;
    }
    if (selectedGuestIds.size === 0) {
      alert("Lütfen en az bir misafir seçin.");
      return;
    }

    setIsSaving(true);
    try {
      const savePromises = Array.from(selectedGuestIds).map(async (guestId) => {
        const guest = guests.find(g => g.GuestID === guestId);
        if (!guest) return;
        const currentPhotos = guest.Photos || [];
        const updatedPhotos = [...currentPhotos, ...selectedPhotos];
        
        return api.updateGuest(guestId, {
          FirstName:      guest.FirstName,
          LastName:       guest.LastName,
          PhoneNumber:    guest.PhoneNumber,
          InstagramLink:  guest.InstagramLink,
          Notes:          guest.Notes,
          ProfilePicture: guest.ProfilePicture,
          BirthDateDay:   guest.BirthDateDay,
          BirthDateMonth: guest.BirthDateMonth,
          BirthDateYear:  guest.BirthDateYear,
          Photos:         updatedPhotos
        }).then(() => {
          // Store'u güncelle — Firestore okuma YOK
          store.updateGuest(guestId, { ...guest, Photos: updatedPhotos });
        });
      });

      await Promise.all(savePromises);
      alert(`Fotoğraflar seçilen ${selectedGuestIds.size} misafirin albümüne başarıyla ayrı ayrı kaydedildi!`);
      
      // Reset state and return to dashboard
      setSelectedPhotos([]);
      setSelectedGuestIds(new Set());
      setGuestSearch('');
      setCurrentView('home');
    } catch (err) {
      alert("Kaydetme işlemi sırasında hata oluştu: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm("Yapılan tüm seçimler iptal edilecektir. Emin misiniz?")) {
      setSelectedPhotos([]);
      setSelectedGuestIds(new Set());
      setGuestSearch('');
      setCurrentView('home');
    }
  };

  // Filter guests locally
  const filteredGuests = guests.filter(g => {
    const fullName = (g.FullName || '').toLocaleLowerCase('tr-TR');
    return fullName.includes(guestSearch.toLocaleLowerCase('tr-TR'));
  });

  if (currentView === 'bulk-photo') {
    return (
      <div className="tab-content active" style={{ animation: 'fadeIn 0.4s ease-out' }}>
        <div className="section-header">
          <button className="btn btn-outline btn-sm" onClick={handleCancel}>← Geri Dön</button>
          <h2>Toplu Fotoğraf İşleme</h2>
        </div>
        <p className="section-subtitle" style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
          Yükleyeceğiniz fotoğraflar, işaretleyeceğiniz tüm misafirlerin albümlerine ayrı ayrı eklenecektir.
        </p>

        <div className="bulk-layout" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Photos Upload (Left Column) */}
          <div className="bulk-col" style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column' }}>
            <div className="form-group">
              <div className="bulk-header-row">
                <label style={{ margin: 0, fontWeight: 600 }}>Fotoğrafları Seçin</label>
                <div className="bulk-action-buttons">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => cameraInputRef.current?.click()}>📷 Fotoğraf Çek</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => browseInputRef.current?.click()}>📂 Görsel Ekle</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={pastePhoto}>📋 Yapıştır</button>
                </div>
              </div>

              <input 
                type="file" 
                ref={cameraInputRef} 
                accept="image/*" 
                capture="environment" 
                multiple 
                style={{ display: 'none' }} 
                onChange={handlePhotosUpload} 
              />
              <input 
                type="file" 
                ref={browseInputRef} 
                accept="image/*" 
                multiple 
                style={{ display: 'none' }} 
                onChange={handlePhotosUpload} 
              />

              <div className="gallery-previews-grid" style={{ minHeight: '150px', maxHeight: '300px' }}>
                {selectedPhotos.map((photo, index) => (
                  <div key={index} className="gallery-preview-item">
                    <img src={photo} alt={`Toplu Görsel ${index + 1}`} />
                    <button type="button" className="gallery-preview-delete-badge" onClick={() => removePhoto(index)} title="Sil">&times;</button>
                  </div>
                ))}
                {selectedPhotos.length === 0 && (
                  <div className="gallery-empty-placeholder">
                    <span>Henüz fotoğraf eklenmemiş. Fotoğraf çekebilir, galeriden seçebilir veya panodan yapıştırabilirsiniz (CTRL+V).</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Guest Selection (Right Column) */}
          <div className="bulk-col" style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column' }}>
            <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                Misafirleri İşaretleyin {selectedGuestIds.size > 0 && <span style={{ fontWeight: 'bold', color: '#000000' }}> ({selectedGuestIds.size} misafir seçildi)</span>}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input 
                  type="text" 
                  name="guestSearch" 
                  placeholder="Misafir ara..." 
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button type="button" className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={selectAllFilteredGuests}>Tümünü Seç</button>
                <button type="button" className="btn btn-sm btn-outline" style={{ flex: 1 }} onClick={clearGuestSelection}>Seçimleri Temizle</button>
              </div>
              <div className="listbox-container" style={{ flex: 1, minHeight: '200px', maxHeight: '300px' }}>
                {filteredGuests.map(g => (
                  <div 
                    key={g.GuestID} 
                    className={`listbox-item ${selectedGuestIds.has(g.GuestID) ? 'selected' : ''}`} 
                    onClick={() => toggleGuestSelection(g.GuestID)}
                  >
                    <span>{g.FullName}</span>
                    {selectedGuestIds.has(g.GuestID) && <span style={{ fontSize: '0.8rem' }}>✓</span>}
                  </div>
                ))}
                {filteredGuests.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem' }}>Misafir bulunamadı.</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '2rem', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '1.5rem' }}>
          <button type="button" className="btn btn-outline" onClick={handleCancel} disabled={isSaving}>İptal</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Kaydediliyor...' : 'Fotoğrafları Kaydet'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content active" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="section-header">
        <h2>Diğer İşlemler</h2>
      </div>
      
      <div className="operations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
        <div className="operation-card active" onClick={() => setCurrentView('bulk-photo')}>
          <div className="operation-icon" style={{ fontSize: '2.2rem', lineHeight: 1 }}>👥📷</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0' }}>Toplu Foto İşleme</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4, flexGrow: 1 }}>
            Cihazınızdan seçtiğiniz veya kamerayla çektiğiniz fotoğrafları, birden fazla misafirin profiline tek seferde kaydedin.
          </p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem', width: '100%' }}>Başlat</button>
        </div>
        
        <div className="operation-card disabled">
          <div className="operation-icon" style={{ fontSize: '2.2rem', lineHeight: 1 }}>📊</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0' }}>Veri İşleme</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4, flexGrow: 1 }}>
            Sistem verilerini dışa aktarın veya yedeklerden geri yükleyin.
          </p>
          <span className="badge-soon" style={{ marginTop: '0.5rem' }}>Yakında</span>
        </div>

        <div className="operation-card disabled">
          <div className="operation-icon" style={{ fontSize: '2.2rem', lineHeight: 1 }}>⚙️</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0' }}>Bakım Programları</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4, flexGrow: 1 }}>
            Kullanılmayan veya mükerrer verileri temizleyerek veritabanını optimize edin.
          </p>
          <span className="badge-soon" style={{ marginTop: '0.5rem' }}>Yakında</span>
        </div>

        <div className="operation-card disabled">
          <div className="operation-icon" style={{ fontSize: '2.2rem', lineHeight: 1 }}>📋</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.25rem 0' }}>Raporlar Alma</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4, flexGrow: 1 }}>
            Detaylı istatistikler ve istek analizi raporları oluşturun.
          </p>
          <span className="badge-soon" style={{ marginTop: '0.5rem' }}>Yakında</span>
        </div>
      </div>
    </div>
  );
}
