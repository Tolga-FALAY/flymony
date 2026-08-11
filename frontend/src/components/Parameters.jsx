import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import store from '../store';

const cleanPhoneNumberForWhatsapp = (phone) => {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
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

const renderPhone3Lines = (phone) => {
  if (!phone) return '-';
  const digits = phone.replace(/\D/g, '');
  let p1 = '', p2 = '', p3 = '';
  if (digits.length === 11 && digits.startsWith('0')) {
    p1 = digits.substring(0, 4);
    p2 = digits.substring(4, 7);
    p3 = digits.substring(7, 11);
  } else if (digits.length === 10 && digits.startsWith('5')) {
    p1 = '0' + digits.substring(0, 3);
    p2 = digits.substring(3, 6);
    p3 = digits.substring(6, 10);
  } else {
    const parts = phone.trim().split(/\s+/);
    if (parts.length >= 3) {
      p1 = parts[0]; p2 = parts[1]; p3 = parts.slice(2).join(' ');
    } else {
      p1 = digits.substring(0, 4); p2 = digits.substring(4, 7); p3 = digits.substring(7);
    }
  }
  return (
    <div style={{ lineHeight: 1.15, fontSize: '0.8rem', fontFamily: 'monospace', textAlign: 'center' }}>
      <div>{p1}</div>
      <div>{p2}</div>
      <div>{p3}</div>
    </div>
  );
};

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
  const [subTab, setSubTab] = useState('statuses'); // 'statuses', 'venues', 'cities', or 'languages'
  const [statuses, setStatuses] = useState([]);
  const [venues, setVenues] = useState([]);
  const [cities, setCities] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [copiedVenueId, setCopiedVenueId] = useState(null);
  const [contactVenue, setContactVenue] = useState(null);
  const [noteModalVenue, setNoteModalVenue] = useState(null);

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

  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [editingLanguage, setEditingLanguage] = useState(null);
  const [languageForm, setLanguageForm] = useState({ LanguageName: '' });

  useEffect(() => {
    const syncFromStore = () => {
      setStatuses([...store.statuses]);
      setVenues([...store.venues]);
      setCities([...store.cities]);
      setLanguages([...store.languages]);
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

  // Language handlers
  const openLanguageModal = (lang = null) => {
    if (lang) {
      setEditingLanguage(lang);
      setLanguageForm({ LanguageName: lang.LanguageName });
    } else {
      setEditingLanguage(null);
      setLanguageForm({ LanguageName: '' });
    }
    setIsLanguageModalOpen(true);
  };

  const closeLanguageModal = () => {
    setIsLanguageModalOpen(false);
    setEditingLanguage(null);
  };

  const handleLanguageSubmit = async (e) => {
    e.preventDefault();
    if (!languageForm.LanguageName.trim()) {
      alert("Dil adı boş bırakılamaz.");
      return;
    }

    try {
      if (editingLanguage) {
        await api.updateLanguage(editingLanguage.LanguageID, languageForm);
        store.updateLanguage(editingLanguage.LanguageID, languageForm);
      } else {
        const result = await api.createLanguage(languageForm);
        store.addLanguage({
          LanguageID: result.LanguageID,
          LanguageName: result.LanguageName
        });
      }
      closeLanguageModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLanguageDelete = async (lang) => {
    if (window.confirm(`"${lang.LanguageName}" dil parametresini silmek istediğinize emin misiniz?`)) {
      try {
        await api.deleteLanguage(lang.LanguageID);
        store.removeLanguage(lang.LanguageID);
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
        <button
          className={`btn ${subTab === 'languages' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setSubTab('languages')}
          style={{ padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.9rem' }}
        >
          🌐 Dil Tanımları
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
                  <th>MEKAN ADI</th>
                  <th>ŞEHİR</th>
                  <th>İRTİBAT</th>
                  <th style={{ textAlign: 'center' }}>CEP NO</th>
                  <th style={{ textAlign: 'center' }}>INSTA</th>
                  <th>KONUM</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {venues.map(v => (
                  <tr key={v.VenueID}>
                    <td data-label="MEKAN ADI" style={{ fontWeight: 600 }}>{v.VenueName}</td>
                    <td data-label="ŞEHİR" style={{ fontWeight: 500 }}>{v.CityName || '-'}</td>
                    <td data-label="İRTİBAT">{v.ContactPerson || '-'}</td>
                    <td data-label="CEP NO" style={{ textAlign: 'center' }}>
                      {v.ContactPhone ? (
                        <span
                          style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => setContactVenue(v)}
                        >
                          {renderPhone3Lines(v.ContactPhone)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td data-label="INSTA" style={{ textAlign: 'center' }}>
                      {v.InstagramLink ? (
                        <a
                          href={v.InstagramLink}
                          target="_blank"
                          rel="noreferrer"
                          className="instagram-link-badge"
                        >
                          Profil
                        </a>
                      ) : '-'}
                    </td>
                    <td data-label="KONUM">
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
                          {copiedVenueId === v.VenueID ? '✅ Kopyalandı' : 'Kopyala'}
                        </button>
                      ) : '-'}
                    </td>
                    <td data-label="İşlemler">
                      <div className="action-btns">
                        {String(v.Notes || '').trim().length > 0 && (
                          <button 
                            className="btn btn-sm" 
                            style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.35rem 0.55rem', borderRadius: '6px', cursor: 'pointer', marginRight: '0.2rem' }}
                            onClick={() => setNoteModalVenue(v)}
                            title={v.Notes}
                          >
                            📝
                          </button>
                        )}
                        <button className="btn btn-sm btn-outline" onClick={() => openVenueModal(v)}>Düzenle</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleVenueDelete(v)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {venues.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
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

      {/* --- LANGUAGES VIEW --- */}
      {subTab === 'languages' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
              Şarkıların ve isteklerin dillerini yönetin.
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => openLanguageModal()}>
              + Yeni Dil Ekle
            </button>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Dil Adı</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {languages.map(l => (
                  <tr key={l.LanguageID}>
                    <td data-label="Dil Adı" style={{ fontWeight: 600 }}>{l.LanguageName}</td>
                    <td data-label="İşlemler">
                      <div className="action-btns">
                        <button className="btn btn-sm btn-outline" onClick={() => openLanguageModal(l)}>Düzenle</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleLanguageDelete(l)}>Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {languages.length === 0 && (
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

      {/* --- LANGUAGE ADD/EDIT MODAL --- */}
      {isLanguageModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>{editingLanguage ? 'Dili Düzenle' : 'Yeni Dil Ekle'}</h2>
              <button className="close-btn" onClick={closeLanguageModal}>&times;</button>
            </div>
            <form onSubmit={handleLanguageSubmit}>
              <div className="form-group">
                <label>Dil Adı</label>
                <input
                  type="text"
                  value={languageForm.LanguageName}
                  onChange={e => setLanguageForm({ ...languageForm, LanguageName: e.target.value })}
                  placeholder="Örn: Türkçe, İngilizce..."
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeLanguageModal}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* VENUE CONTACT MODAL */}
      {contactVenue && (() => {
        const phoneClean = cleanPhoneNumberForWhatsapp(contactVenue.ContactPhone);
        const igUsername = getInstagramUsername(contactVenue.InstagramLink);
        return createPortal(
          <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setContactVenue(null)}>
            <div className="modal-content" style={{ maxWidth: '350px', padding: '1.5rem', borderRadius: '12px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>İletişim Seçenekleri</h2>
                <button type="button" className="close-btn" onClick={() => setContactVenue(null)}>&times;</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#1e293b', marginBottom: '0.75rem', textAlign: 'center' }}>
                  {contactVenue.VenueName} {contactVenue.ContactPerson ? `(${contactVenue.ContactPerson})` : ''}
                </div>
                
                {/* Mobil Arama */}
                <a
                  href={`tel:${contactVenue.ContactPhone}`}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit' }}
                  onClick={() => setContactVenue(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', color: '#3b82f6' }}>
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
                  onClick={() => setContactVenue(null)}
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
                  onClick={() => setContactVenue(null)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '10px', color: '#22c55e' }}>
                    <path d="M12.004 2C6.51 2 2.014 6.5 2.014 12c0 2.13.67 4.13 1.81 5.79l-1.2 4.41 4.54-1.18c1.58.86 3.38 1.3 5.24 1.3 5.494 0 9.99-4.5 9.99-10S17.498 2 12.004 2zm0 1.95c4.43 0 8.04 3.61 8.04 8.05s-3.61 8.05-8.04 8.05c-1.63 0-3.19-.5-4.52-1.42l-.33-.21-2.73.71.73-2.67-.25-.37c-1.02-1.42-1.57-3.12-1.57-4.89 0-4.44 3.61-8.05 8.04-8.05zM9.474 8.01c-.18 0-.46.07-.7.33-.25.26-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.19 1.9 2.9 4.62 4.08.65.28 1.15.45 1.54.57.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.82-1.29.23-.63.23-1.18.16-1.29-.07-.11-.25-.18-.53-.32-.28-.14-1.19-.44-2.27-1.4-.84-.75-1.4-1.67-1.57-1.95-.17-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.27.28-.46.09-.18.05-.35-.02-.48-.07-.14-.61-1.48-.84-2.02-.22-.54-.45-.46-.61-.47h-.49z"/>
                  </svg>
                  WhatsApp Mesaj
                </a>

                {contactVenue.InstagramLink && igUsername && (
                  <a
                    href={`https://instagram.com/direct/t/${igUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', padding: '0.75rem 1rem', textDecoration: 'none', color: 'inherit' }}
                    onClick={() => setContactVenue(null)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px', color: '#ec4899' }}>
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                    Instagram DM Mesaj
                  </a>
                )}
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* VENUE NOTE POPUP MODAL */}
      {noteModalVenue && createPortal(
        <div className="modal-overlay" style={{ zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setNoteModalVenue(null)}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>📝 {noteModalVenue.VenueName} - Notlar</h2>
              <button className="close-btn" onClick={() => setNoteModalVenue(null)}>&times;</button>
            </div>
            <div style={{ padding: '1rem', background: 'var(--canvas)', borderRadius: '8px', fontSize: '0.95rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)', lineHeight: '1.5', maxHeight: '60vh', overflowY: 'auto' }}>
              {noteModalVenue.Notes || 'Herhangi bir not bulunmamaktadır.'}
            </div>
            <div className="modal-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setNoteModalVenue(null)}>Kapat</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
