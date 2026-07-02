import React, { useState, useEffect } from 'react';
import { api } from '../api';
import store from '../store';

const COLOR_PRESETS = [
  { label: 'Mavi', hex: '#0ea5e9' },
  { label: 'Sarı', hex: '#f59e0b' },
  { label: 'Yeşil', hex: '#10b981' },
  { label: 'Mor', hex: '#8b5cf6' },
  { label: 'Kırmızı', hex: '#ef4444' },
  { label: 'Pembe', hex: '#ec4899' },
  { label: 'Turkuaz', hex: '#14b8a6' },
  { label: 'Gri', hex: '#64748b' }
];

export default function Parameters() {
  const [subTab, setSubTab] = useState('statuses'); // 'statuses', 'venues', or 'cities'
  const [statuses, setStatuses] = useState([]);
  const [venues, setVenues] = useState([]);
  const [cities, setCities] = useState([]);
  const [copiedVenueId, setCopiedVenueId] = useState(null);

  // Modal states
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [statusForm, setStatusForm] = useState({ StatusName: '', Color: '#0ea5e9' });

  const [isVenueModalOpen, setIsVenueModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [venueForm, setVenueForm] = useState({
    VenueName: '',
    CityID: '',
    ContactPerson: '',
    ContactPhone: '',
    InstagramLink: '',
    Notes: '',
    GoogleMapsLink: ''
  });

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [editingCity, setEditingCity] = useState(null);
  const [cityForm, setCityForm] = useState({ CityName: '' });

  useEffect(() => {
    const syncFromStore = () => {
      setStatuses([...store.statuses]);
      setVenues([...store.venues]);
      setCities([...store.cities]);
    };
    if (store.isLoaded) {
      syncFromStore();
    } else {
      store.load().then(syncFromStore);
    }
    window.addEventListener('store-updated', syncFromStore);
    return () => window.removeEventListener('store-updated', syncFromStore);
  }, []);

  // Status handlers
  const openStatusModal = (status = null) => {
    if (status) {
      setEditingStatus(status);
      setStatusForm({ StatusName: status.StatusName, Color: status.Color });
    } else {
      setEditingStatus(null);
      setStatusForm({ StatusName: '', Color: '#0ea5e9' });
    }
    setIsStatusModalOpen(true);
  };

  const closeStatusModal = () => {
    setIsStatusModalOpen(false);
    setEditingStatus(null);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!statusForm.StatusName.trim()) {
      alert("Durum adı boş bırakılamaz.");
      return;
    }

    try {
      if (editingStatus) {
        await api.updateStatus(editingStatus.StatusID, statusForm);
        store.updateStatus(editingStatus.StatusID, statusForm);
      } else {
        const result = await api.createStatus(statusForm);
        store.addStatus({
          StatusID: result.StatusID,
          StatusName: result.StatusName,
          Color: result.Color
        });
      }
      closeStatusModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusDelete = async (status) => {
    if (window.confirm(`"${status.StatusName}" durum parametresini silmek istediğinize emin misiniz?`)) {
      try {
        await api.deleteStatus(status.StatusID);
        store.removeStatus(status.StatusID);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Venue handlers
  const openVenueModal = (venue = null) => {
    if (venue) {
      setEditingVenue(venue);
      setVenueForm({
        VenueName: venue.VenueName,
        CityID: venue.CityID || '',
        ContactPerson: venue.ContactPerson || '',
        ContactPhone: venue.ContactPhone || '',
        InstagramLink: venue.InstagramLink || '',
        Notes: venue.Notes || '',
        GoogleMapsLink: venue.GoogleMapsLink || ''
      });
    } else {
      setEditingVenue(null);
      setVenueForm({
        VenueName: '',
        CityID: store.cities.length > 0 ? store.cities[0].CityID : '',
        ContactPerson: '',
        ContactPhone: '',
        InstagramLink: '',
        Notes: '',
        GoogleMapsLink: ''
      });
    }
    setIsVenueModalOpen(true);
  };

  const closeVenueModal = () => {
    setIsVenueModalOpen(false);
    setEditingVenue(null);
  };

  const handleCopyLink = (venueId, link) => {
    let copyPromise;
    if (navigator.clipboard && window.isSecureContext) {
      copyPromise = navigator.clipboard.writeText(link);
    } else {
      // Fallback for non-HTTPS (e.g. HTTP testing on mobile/local network)
      const textArea = document.createElement("textarea");
      textArea.value = link;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        copyPromise = Promise.resolve();
      } catch (err) {
        copyPromise = Promise.reject(err);
      }
      document.body.removeChild(textArea);
    }

    copyPromise.then(() => {
      setCopiedVenueId(venueId);
      setTimeout(() => setCopiedVenueId(null), 1500);
    }).catch(err => {
      console.error("Copy failed:", err);
      alert("Kopyalama başarısız oldu.");
    });
  };

  const handleVenueSubmit = async (e) => {
    e.preventDefault();
    if (!venueForm.VenueName.trim()) {
      alert("Mekan adı boş bırakılamaz.");
      return;
    }
    if (!venueForm.CityID) {
      alert("Lütfen bir şehir seçin.");
      return;
    }

    try {
      if (editingVenue) {
        await api.updateVenue(editingVenue.VenueID, venueForm);
        store.updateVenue(editingVenue.VenueID, {
          ...venueForm,
          CityName: store.cities.find(c => c.CityID === Number(venueForm.CityID))?.CityName || '-'
        });
      } else {
        const result = await api.createVenue(venueForm);
        store.addVenue({
          VenueID: result.VenueID,
          VenueName: result.VenueName,
          CityID: result.CityID,
          CityName: result.CityName,
          ContactPerson: result.ContactPerson,
          ContactPhone: result.ContactPhone,
          InstagramLink: result.InstagramLink,
          Notes: result.Notes,
          GoogleMapsLink: result.GoogleMapsLink
        });
      }
      closeVenueModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVenueDelete = async (venue) => {
    if (window.confirm(`"${venue.VenueName}" mekan kaydını silmek istediğinize emin misiniz?`)) {
      try {
        await api.deleteVenue(venue.VenueID);
        store.removeVenue(venue.VenueID);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // City handlers
  const openCityModal = (city = null) => {
    if (city) {
      setEditingCity(city);
      setCityForm({ CityName: city.CityName });
    } else {
      setEditingCity(null);
      setCityForm({ CityName: '' });
    }
    setIsCityModalOpen(true);
  };

  const closeCityModal = () => {
    setIsCityModalOpen(false);
    setEditingCity(null);
  };

  const handleCitySubmit = async (e) => {
    e.preventDefault();
    if (!cityForm.CityName.trim()) {
      alert("Şehir adı boş bırakılamaz.");
      return;
    }

    try {
      if (editingCity) {
        await api.updateCity(editingCity.CityID, cityForm);
        store.updateCity(editingCity.CityID, cityForm);
      } else {
        const result = await api.createCity(cityForm);
        store.addCity({
          CityID: result.CityID,
          CityName: result.CityName
        });
      }
      closeCityModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCityDelete = async (city) => {
    if (window.confirm(`"${city.CityName}" şehir parametresini silmek istediğinize emin misiniz?`)) {
      try {
        await api.deleteCity(city.CityID);
        store.removeCity(city.CityID);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  // Helper to draw status badge preview
  const getStatusBadgeStyle = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 148;
    const g = parseInt(hex.substring(2, 4), 16) || 163;
    const b = parseInt(hex.substring(4, 6), 16) || 184;
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
      color: color,
      border: `1px solid rgba(${r}, ${g}, ${b}, 0.25)`,
      padding: '0.35rem 0.85rem',
      borderRadius: '999px',
      fontWeight: 'bold',
      fontSize: '0.82rem',
      display: 'inline-block'
    };
  };

  return (
    <div className="tab-content active" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div className="section-header">
        <h2>Sistem Parametreleri</h2>
      </div>

      {/* Sub tabs navigation */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${subTab === 'statuses' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSubTab('statuses')}
          style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem' }}
        >
          🚦 Durum Tanımları
        </button>
        <button
          className={`btn ${subTab === 'venues' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSubTab('venues')}
          style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem' }}
        >
          📍 Mekan Tanımları
        </button>
        <button
          className={`btn ${subTab === 'cities' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSubTab('cities')}
          style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem' }}
        >
          🏙️ Şehir Tanımları
        </button>
      </div>

      {/* --- STATUSES VIEW --- */}
      {subTab === 'statuses' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              Şarkı istekleri için kullanılan durumları ve renklerini yönetin.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => openStatusModal()}>
              + Yeni Durum Tanımla
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Durum Adı</th>
                  <th>Görünüm Önizleme</th>
                  <th>Renk Kodu</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map(s => (
                  <tr key={s.StatusID}>
                    <td data-label="Durum Adı" style={{ fontWeight: 600 }}>{s.StatusName}</td>
                    <td data-label="Görünüm Önizleme">
                      <span style={getStatusBadgeStyle(s.Color)}>{s.StatusName}</span>
                    </td>
                    <td data-label="Renk Kodu">
                      <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{s.Color}</span>
                    </td>
                    <td data-label="İşlemler">
                      <div className="action-btns">
                        <button className="btn btn-sm btn-outline" onClick={() => openStatusModal(s)}>Düzenle</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusDelete(s)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {statuses.length === 0 && (
                  <tr><td colSpan="4" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- VENUES VIEW --- */}
      {subTab === 'venues' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              Etkinliklerin ve programların yapıldığı mekanları tanımlayın.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => openVenueModal()}>
              + Yeni Mekan Ekle
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Mekan Adı</th>
                  <th>Şehir</th>
                  <th>İrtibat Kişisi</th>
                  <th>İrtibat Telefonu</th>
                  <th>Instagram</th>
                  <th>Konum</th>
                  <th>Notlar</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {venues.map(v => (
                  <tr key={v.VenueID}>
                    <td data-label="Mekan Adı" style={{ fontWeight: 600 }}>{v.VenueName}</td>
                    <td data-label="Şehir" style={{ fontWeight: 500 }}>{v.CityName || '-'}</td>
                    <td data-label="İrtibat Kişisi">{v.ContactPerson || '-'}</td>
                    <td data-label="İrtibat Telefonu">{v.ContactPhone || '-'}</td>
                    <td data-label="Instagram">
                      {v.InstagramLink ? (
                        <a
                          href={v.InstagramLink}
                          target="_blank"
                          rel="noreferrer"
                          className="instagram-link-badge"
                        >
                          Instagram ↗
                        </a>
                      ) : '-'}
                    </td>
                    <td data-label="Konum">
                      {v.GoogleMapsLink ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline"
                          onClick={() => handleCopyLink(v.VenueID, v.GoogleMapsLink)}
                          title="Google Harita Konumunu Kopyala"
                          style={{
                            padding: '0.35rem 0.65rem',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            cursor: 'pointer',
                            backgroundColor: copiedVenueId === v.VenueID ? '#d1fae5' : 'transparent',
                            borderColor: copiedVenueId === v.VenueID ? '#34d399' : 'var(--border-strong)',
                            color: copiedVenueId === v.VenueID ? '#065f46' : 'var(--text-main)',
                            transition: 'all 0.2s ease',
                            fontWeight: '600'
                          }}
                        >
                          {copiedVenueId === v.VenueID ? '✅ Kopyalandı' : '🗺️ Konum'}
                        </button>
                      ) : '-'}
                    </td>
                    <td data-label="Notlar" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{v.Notes || '-'}</td>
                    <td data-label="İşlemler">
                      <div className="action-btns">
                        <button className="btn btn-sm btn-outline" onClick={() => openVenueModal(v)}>Düzenle</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleVenueDelete(v)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {venues.length === 0 && (
                  <tr><td colSpan="8" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CITIES VIEW --- */}
      {subTab === 'cities' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              Mekanların bağlı olduğu şehir listelerini yönetin.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => openCityModal()}>
              + Yeni Şehir Ekle
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Şehir Adı</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {cities.map(c => (
                  <tr key={c.CityID}>
                    <td data-label="Şehir Adı" style={{ fontWeight: 600 }}>{c.CityName}</td>
                    <td data-label="İşlemler">
                      <div className="action-btns">
                        <button className="btn btn-sm btn-outline" onClick={() => openCityModal(c)}>Düzenle</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleCityDelete(c)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {cities.length === 0 && (
                  <tr><td colSpan="2" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- STATUS ADD/EDIT MODAL --- */}
      {isStatusModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{editingStatus ? 'Durumu Düzenle' : 'Yeni Durum Tanımla'}</h2>
              <button className="close-btn" onClick={closeStatusModal}>&times;</button>
            </div>
            <form onSubmit={handleStatusSubmit}>
              <div className="form-group">
                <label>Durum İsmi</label>
                <input
                  type="text"
                  value={statusForm.StatusName}
                  onChange={e => setStatusForm({ ...statusForm, StatusName: e.target.value })}
                  placeholder="Örn: Beklemede, Sıraya Alındı..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Renk Seçimi</label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={statusForm.Color}
                    onChange={e => setStatusForm({ ...statusForm, Color: e.target.value })}
                    style={{
                      width: '50px',
                      height: '40px',
                      border: '1px solid var(--border-strong)',
                      borderRadius: '8px',
                      padding: 0,
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>{statusForm.Color}</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hızlı Renk Şablonları</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {COLOR_PRESETS.map(preset => (
                    <button
                      key={preset.hex}
                      type="button"
                      onClick={() => setStatusForm({ ...statusForm, Color: preset.hex })}
                      title={preset.label}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: preset.hex,
                        border: statusForm.Color === preset.hex ? '3px solid #000' : '1px solid rgba(0,0,0,0.1)',
                        cursor: 'pointer',
                        transform: statusForm.Color === preset.hex ? 'scale(1.1)' : 'none',
                        transition: 'transform 0.15s ease'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--surface-muted)' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Badge Önizlemesi</label>
                <div style={{ textAlign: 'center', padding: '0.25rem' }}>
                  <span style={getStatusBadgeStyle(statusForm.Color)}>
                    {statusForm.StatusName || 'Durum Metni'}
                  </span>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeStatusModal}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- VENUE ADD/EDIT MODAL --- */}
      {isVenueModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingVenue ? 'Mekanı Düzenle' : 'Yeni Mekan Ekle'}</h2>
              <button className="close-btn" onClick={closeVenueModal}>&times;</button>
            </div>
            <form onSubmit={handleVenueSubmit}>
              <div className="form-group">
                <label>Mekan Adı</label>
                <input
                  type="text"
                  value={venueForm.VenueName}
                  onChange={e => setVenueForm({ ...venueForm, VenueName: e.target.value })}
                  placeholder="Mekan veya Sahne Adı..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Şehir (Zorunlu)</label>
                <select
                  value={venueForm.CityID}
                  onChange={e => setVenueForm({ ...venueForm, CityID: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface)',
                    color: 'var(--text)'
                  }}
                >
                  <option value="">Şehir Seçin...</option>
                  {cities.map(c => (
                    <option key={c.CityID} value={c.CityID}>{c.CityName}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Kontak Kişi</label>
                <input
                  type="text"
                  value={venueForm.ContactPerson}
                  onChange={e => setVenueForm({ ...venueForm, ContactPerson: e.target.value })}
                  placeholder="İrtibata geçilecek yetkili..."
                />
              </div>

              <div className="form-group">
                <label>Kontak Telefon</label>
                <input
                  type="tel"
                  value={venueForm.ContactPhone}
                  onChange={e => setVenueForm({ ...venueForm, ContactPhone: e.target.value })}
                  placeholder="Telefon Numarası..."
                />
              </div>

              <div className="form-group">
                <label>Mekan Instagram Bağlantısı</label>
                <input
                  type="url"
                  value={venueForm.InstagramLink}
                  onChange={e => setVenueForm({ ...venueForm, InstagramLink: e.target.value })}
                  placeholder="https://instagram.com/..."
                />
              </div>

              <div className="form-group">
                <label>Google Harita (Konum) Linki</label>
                <input
                  type="url"
                  value={venueForm.GoogleMapsLink || ''}
                  onChange={e => setVenueForm({ ...venueForm, GoogleMapsLink: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div className="form-group">
                <label>Notlar</label>
                <textarea
                  value={venueForm.Notes || ''}
                  onChange={e => setVenueForm({ ...venueForm, Notes: e.target.value })}
                  placeholder="Mekan hakkında notlar..."
                  rows={2}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeVenueModal}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CITY ADD/EDIT MODAL --- */}
      {isCityModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{editingCity ? 'Şehri Düzenle' : 'Yeni Şehir Ekle'}</h2>
              <button className="close-btn" onClick={closeCityModal}>&times;</button>
            </div>
            <form onSubmit={handleCitySubmit}>
              <div className="form-group">
                <label>Şehir Adı</label>
                <input
                  type="text"
                  value={cityForm.CityName}
                  onChange={e => setCityForm({ ...cityForm, CityName: e.target.value })}
                  placeholder="Örn: İstanbul, Ankara..."
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeCityModal}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
