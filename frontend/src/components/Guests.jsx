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

const formatGigRelativeTime = (gigDateStr) => {
  if (!gigDateStr) return '';
  const dateObj = new Date(gigDateStr);
  if (isNaN(dateObj.getTime())) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gigDate = new Date(dateObj);
  gigDate.setHours(0, 0, 0, 0);

  const diffTime = today - gigDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return ' (Bugün)';
  } else if (diffDays < 60) {
    return ` (${diffDays} Gün)`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    if (days > 0) {
      return ` (${months} Ay, ${days} Gün)`;
    } else {
      return ` (${months} Ay)`;
    }
  } else {
    const years = Math.floor(diffDays / 365);
    const remDays = diffDays % 365;
    const months = Math.floor(remDays / 30);
    const days = remDays % 30;

    let parts = [`${years} Yıl`];
    if (months > 0) parts.push(`${months} Ay`);
    if (days > 0) parts.push(`${days} Gün`);

    return ` (${parts.join(', ')})`;
  }
};

export default function Guests() {
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState(null);
  const [contactGuest, setContactGuest] = useState(null);
  const [gigsModalGuest, setGigsModalGuest] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [noteModalGuest, setNoteModalGuest] = useState(null);

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({ key: 'FullName', direction: 'asc' });

  // Filter States
  const [filterName, setFilterName] = useState('');
  const [filterNotes, setFilterNotes] = useState('');
  const [filterBirthMonth, setFilterBirthMonth] = useState('');
  const [filterIsMusician, setFilterIsMusician] = useState(false);

  const clearAllFilters = () => {
    setFilterName('');
    setFilterNotes('');
    setFilterBirthMonth('');
    setFilterIsMusician(false);
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
    RelatedGuestIDs: [],
    IsMusician: false
  });

  const getIndirectRelations = () => {
    if (!formData.RelatedGuestIDs || formData.RelatedGuestIDs.length === 0) return [];
    
    const indirectIds = new Set();
    const directIdsNum = formData.RelatedGuestIDs.map(Number);
    
    directIdsNum.forEach(directId => {
      const directGuest = guests.find(g => Number(g.GuestID) === directId);
      if (directGuest && directGuest.RelatedGuestIDs) {
        directGuest.RelatedGuestIDs.forEach(indirectId => {
          const indirectIdNum = Number(indirectId);
          // Exclude self (the editing guest)
          if (editingGuest && Number(editingGuest.GuestID) === indirectIdNum) return;
          // Exclude direct relations of the editing guest
          if (directIdsNum.includes(indirectIdNum)) return;
          
          indirectIds.add(indirectIdNum);
        });
      }
    });
    
    return Array.from(indirectIds).map(id => guests.find(g => Number(g.GuestID) === id)).filter(Boolean);
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
        City: guest.City || '',
        InstagramLink: guest.InstagramLink || '',
        Notes: guest.Notes || '',
        ProfilePicture: guest.ProfilePicture || '',
        BirthDateDay: guest.BirthDateDay || '',
        BirthDateMonth: guest.BirthDateMonth || '',
        BirthDateYear: guest.BirthDateYear || '',
        Photos: guest.Photos || [],
        RelatedGuestIDs: (guest.RelatedGuestIDs || []).map(String),
        IsMusician: guest.IsMusician ? true : false
      });
    } else {
      setEditingGuest(null);
      setFormData({
        FirstName: '',
        LastName: '',
        PhoneNumber: '',
        City: '',
        InstagramLink: '',
        Notes: '',
        ProfilePicture: '',
        BirthDateDay: '',
        BirthDateMonth: '',
        BirthDateYear: '',
        Photos: [],
        RelatedGuestIDs: [],
        IsMusician: false
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
        IsMusician: formData.IsMusician ? 1 : 0,
        RelatedGuestIDs: (formData.RelatedGuestIDs || []).map(Number)
      };
      if (editingGuest) {
        await api.updateGuest(editingGuest.GuestID, payload);
        // Store'u güncelle — Firestore okuma YOK
        store.updateGuest(editingGuest.GuestID, {
          ...payload,
          IsMusician: formData.IsMusician,
          GuestID:  editingGuest.GuestID,
          FullName: `${payload.FirstName} ${payload.LastName}`.trim()
        });
      } else {
        const result = await api.createGuest(payload);
        store.addGuest({
          ...payload,
          IsMusician: formData.IsMusician,
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

  // Age Calculator Helper
  const calculateAge = (day, month, year) => {
    if (!day || !month || !year) return null;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

    const today = new Date();
    let age = today.getFullYear() - y;
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    if (currentMonth < m || (currentMonth === m && currentDay < d)) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const formatBirthDate = (day, month, year) => {
    if (!day || !month) return '-';
    const months = [
      "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
      "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];
    const monthName = months[parseInt(month) - 1] || month;
    const age = calculateAge(day, month, year);
    return (
      <div style={{ lineHeight: 1.2, fontSize: '0.85rem', textAlign: 'center' }}>
        <div>{day} {monthName}</div>
        {year && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{year}{age !== null ? ` (${age})` : ''}</div>}
      </div>
    );
  };

  const formatDDMMYYYY = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const renderCityMultiLine = (cityStr) => {
    if (!cityStr || !cityStr.trim()) return '-';
    const lines = cityStr.trim().split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0) return '-';
    const line1 = lines[0];
    const restLines = lines.slice(1);
    return (
      <div style={{ textAlign: 'center', lineHeight: 1.25 }}>
        <div style={{ fontSize: '0.85rem' }}>{line1}</div>
        {restLines.map((l, idx) => (
          <div key={idx} style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {l}
          </div>
        ))}
      </div>
    );
  };

  const renderRegistrationMeta = (createdAtStr) => {
    if (!createdAtStr) return null;
    const created = new Date(createdAtStr);
    if (isNaN(created.getTime())) return null;

    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - created.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let timeAgoStr = '';
    if (diffDays < 60) {
      timeAgoStr = `${diffDays} Gün`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const days = diffDays % 30;
      if (days === 0) timeAgoStr = `${months} Ay`;
      else timeAgoStr = `${months} Ay, ${days} Gün`;
    } else {
      const years = Math.floor(diffDays / 365);
      const remDays = diffDays % 365;
      const months = Math.floor(remDays / 30);
      const days = remDays % 30;
      
      const parts = [`${years} Yıl`];
      if (months > 0) parts.push(`${months} Ay`);
      if (days > 0) parts.push(`${days} Gün`);
      timeAgoStr = parts.join(', ');
    }

    const dayStr = String(created.getDate()).padStart(2, '0');
    const monthStr = String(created.getMonth() + 1).padStart(2, '0');
    const yearStr = created.getFullYear();
    const formattedDate = `${dayStr}.${monthStr}.${yearStr}`;

    return `📅 Kayıt: ${formattedDate} (${timeAgoStr} önce)`;
  };

  // 3-Line Phone Formatter
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

  // Generate Year Array from current year down to 1920
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 1920; y--) {
    years.push(y);
  }

  const getGuestGigCount = (guestId) => {
    const targetId = Number(guestId);
    if (!store.gigs || store.gigs.length === 0) return 0;
    return store.gigs.filter(gig => 
      (gig.Guests || []).some(g => Number(g.GuestID || g.guestId) === targetId)
    ).length;
  };

  const getGuestAttendedGigs = (guestId) => {
    const targetId = Number(guestId);
    if (!store.gigs || store.gigs.length === 0) return [];
    const list = store.gigs.filter(gig => 
      (gig.Guests || []).some(g => Number(g.GuestID || g.guestId) === targetId)
    );
    return list.sort((a, b) => new Date(b.GigDate || b.gigDate).getTime() - new Date(a.GigDate || a.gigDate).getTime());
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key !== key && (key === 'CreatedAt' || key === 'GigCount')) {
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
    } else if (sortConfig.key === 'InstagramLink') {
      const getIG = (g) => (g.InstagramLink || g.instagram || '').trim().toLocaleLowerCase('tr-TR');
      const getName = (g) => (g.FullName || `${g.FirstName || ''} ${g.LastName || ''}`).trim().toLocaleLowerCase('tr-TR');

      const igA = getIG(a);
      const igB = getIG(b);
      const hasA = igA.length > 0 && igA !== '-' && igA !== 'null';
      const hasB = igB.length > 0 && igB !== '-' && igB !== 'null';

      if (sortConfig.direction === 'asc') {
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (hasA && hasB) return igA.localeCompare(igB, 'tr');
        return getName(a).localeCompare(getName(b), 'tr');
      } else {
        if (!hasA && hasB) return -1;
        if (hasA && !hasB) return 1;
        if (!hasA && !hasB) return getName(a).localeCompare(getName(b), 'tr');
        return igB.localeCompare(igA, 'tr');
      }
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
    } else if (sortConfig.key === 'GigCount') {
      const countA = getGuestGigCount(a.GuestID);
      const countB = getGuestGigCount(b.GuestID);
      res = countA - countB;
    } else if (sortConfig.key === 'CreatedAt') {
      const timeA = a.CreatedAt ? new Date(a.CreatedAt).getTime() : Number(a.GuestID || 0);
      const timeB = b.CreatedAt ? new Date(b.CreatedAt).getTime() : Number(b.GuestID || 0);
      res = timeA - timeB;
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

    // 4. Musician filter
    if (filterIsMusician) {
      if (!guest.IsMusician) {
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
          
          {/* Musician Filter */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-end', marginBottom: '0.65rem', padding: '0.5rem 0.25rem', flex: '0 0 auto' }}>
            <span style={{ fontSize: '1.25rem', filter: 'drop-shadow(0 2px 4px rgba(14, 165, 233, 0.2))', lineHeight: 1 }} title="Sadece Müzisyenler">🎵</span>
            <input 
              type="checkbox" 
              id="filterGuestIsMusicianReact" 
              checked={filterIsMusician}
              onChange={(e) => setFilterIsMusician(e.target.checked)}
              style={{ cursor: 'pointer', margin: 0, width: '18px', height: '18px' }}
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
        <table className="data-table guests-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('FullName')} className="th-guest" style={{ cursor: 'pointer', userSelect: 'none' }}>
                MISAFIR
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'FullName' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('FullName')}
                </span>
              </th>
              <th onClick={() => handleSort('GigCount')} className="th-gigcount" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }} title="Sahne Katılım Sayısına Göre Sırala">
                🎸
                <span style={{ fontSize: '0.75rem', color: sortConfig.key === 'GigCount' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('GigCount')}
                </span>
              </th>
              <th className="th-cep" style={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>CEP</th>
              <th onClick={() => handleSort('InstagramLink')} className="th-insta" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                INSTA
                <span style={{ fontSize: '0.75rem', color: sortConfig.key === 'InstagramLink' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('InstagramLink')}
                </span>
              </th>
              <th onClick={() => handleSort('BirthDate')} className="th-birthdate" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                DOĞUM T.
                <span style={{ fontSize: '0.75rem', color: sortConfig.key === 'BirthDate' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('BirthDate')}
                </span>
              </th>
              <th onClick={() => handleSort('City')} className="th-city" style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                ŞEHİR
                <span style={{ fontSize: '0.75rem', color: sortConfig.key === 'City' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('City')}
                </span>
              </th>
              <th onClick={() => handleSort('CreatedAt')} className="th-createdat" style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none', paddingLeft: '2px', paddingRight: '2px' }} title="Kayıt Tarihine Göre Sırala">
                KAYIT TAR.
                <span style={{ fontSize: '0.75rem', color: sortConfig.key === 'CreatedAt' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('CreatedAt')}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredGuests.map(guest => (
              <tr key={guest.GuestID}>
                <td data-label="MISAFIR" className="td-guest-profile" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                  <div className="guest-profile-content">
                    <div 
                      className="guest-avatar-wrapper"
                      style={guest.ProfilePicture ? { cursor: 'pointer' } : {}}
                      onClick={() => {
                        if (guest.ProfilePicture) {
                          setFullscreenImage(guest.ProfilePicture);
                        }
                      }}
                    >
                      {guest.ProfilePicture ? (
                        <img src={guest.ProfilePicture} alt={guest.FullName} className="guest-avatar-img" />
                      ) : (
                        <div className="guest-avatar-initials">
                          {getInitials(guest.FirstName, guest.LastName)}
                        </div>
                      )}
                    </div>
                     <span 
                       className="guest-name-text"
                       onClick={() => openModal(guest)}
                       style={{ cursor: 'pointer', textDecoration: 'none' }}
                       onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                       onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                     >
                      {guest.FullName}
                      {guest.IsMusician && (
                        <span 
                          style={{ marginLeft: '0.45rem', display: 'inline-flex', alignItems: 'center', color: 'var(--primary)', filter: 'drop-shadow(0 2px 4px rgba(14, 165, 233, 0.2))' }} 
                          title="Müzisyen"
                        >
                          🎵
                        </span>
                      )}
                    </span>
                  </div>
                </td>
                <td data-label="Sahne Sayısı" style={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                  {getGuestGigCount(guest.GuestID) > 0 ? (
                    <span 
                      style={{ fontWeight: 700, color: 'var(--primary)', background: 'rgba(14, 165, 233, 0.12)', padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.82rem', border: '1px solid rgba(14, 165, 233, 0.25)', display: 'inline-block', cursor: 'pointer' }}
                      onClick={() => setGigsModalGuest(guest)}
                      title="Katıldığı sahneleri göster"
                    >
                      {getGuestGigCount(guest.GuestID)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>0</span>
                  )}
                </td>
                <td data-label="CEP" style={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                  {guest.PhoneNumber ? (
                    <span
                      style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setContactGuest(guest)}
                    >
                      {renderPhone3Lines(guest.PhoneNumber)}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td data-label="INSTA" style={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                  {guest.InstagramLink ? (
                    <a href={guest.InstagramLink} target="_blank" rel="noreferrer" className="instagram-link-badge">Profil</a>
                  ) : '-'}
                </td>
                <td data-label="DOĞUM T." style={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                  {formatBirthDate(guest.BirthDateDay, guest.BirthDateMonth, guest.BirthDateYear)}
                </td>
                <td data-label="ŞEHİR" style={{ textAlign: 'center', paddingLeft: '2px', paddingRight: '2px' }}>
                  {renderCityMultiLine(guest.City)}
                </td>
                <td data-label="KAYIT TAR." style={{ paddingLeft: '2px', paddingRight: '2px', textAlign: 'right' }}>
                  <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                    {String(guest.Notes || '').trim().length > 0 && (
                      <button 
                        className="btn btn-sm" 
                        style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.35rem 0.55rem', borderRadius: '6px', cursor: 'pointer', marginRight: '0.2rem' }}
                        onClick={() => setNoteModalGuest(guest)}
                        title="Notu Oku"
                      >
                        📝
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline" onClick={() => openModal(guest)}>Düzenle</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(guest.GuestID)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredGuests.length === 0 && (
              <tr><td colSpan="7" style={{textAlign: 'center'}}>Kayıt bulunamadı.</td></tr>
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
                        <img 
                          src={formData.ProfilePicture} 
                          alt="Profil Önizleme" 
                          style={{ cursor: 'pointer' }}
                          onClick={() => setFullscreenImage(formData.ProfilePicture)}
                        />
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
                <label>Şehir / Adres (Enter ile alt satıra geçilebilir)</label>
                <textarea
                  name="City"
                  value={formData.City}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Örn: Lefkoşa&#10;KKTC"
                  style={{ resize: 'vertical', width: '100%', fontFamily: 'inherit', fontSize: '0.95rem', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
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

              {/* IsMusician Checkbox */}
              <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '-0.5rem', marginBottom: '1.25rem', width: '100%' }}>
                <input
                  type="checkbox"
                  id="guestIsMusician"
                  name="IsMusician"
                  checked={formData.IsMusician}
                  onChange={(e) => setFormData(prev => ({ ...prev, IsMusician: e.target.checked }))}
                  style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                />
                <label htmlFor="guestIsMusician" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>Müzisyen mi?</label>
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
                      <img 
                        src={photo} 
                        alt={`Galeri Önizleme ${index + 1}`} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => setFullscreenImage(photo)}
                      />
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
                      Bağlantılı / Dolaylı İlişkiler
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

              <div className="modal-actions" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {editingGuest ? renderRegistrationMeta(editingGuest.CreatedAt) : ''}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-outline" onClick={closeModal}>İptal</button>
                  <button type="submit" className="btn btn-primary">Kaydet</button>
                </div>
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
      {fullscreenImage && createPortal(
        <div 
          className="modal-overlay" 
          style={{ 
            backgroundColor: 'rgba(15, 23, 42, 0.9)', 
            zIndex: 2000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backdropFilter: 'blur(8px)'
          }}
          onClick={() => setFullscreenImage(null)}
        >
          <div 
            style={{ 
              position: 'relative', 
              maxWidth: '90vw', 
              maxHeight: '90vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              type="button"
              className="close-btn"
              onClick={() => setFullscreenImage(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0px',
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                color: '#fff',
                fontSize: '1.75rem',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}
            >
              &times;
            </button>
            <img 
              src={fullscreenImage} 
              alt="Tam Ekran Görünüm" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '85vh', 
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              }} 
            />
          </div>
        </div>,
        document.body
      )}

      {/* Guest Attended Gigs Modal */}
      {gigsModalGuest && createPortal(
        <div className="modal-overlay" style={{ display: 'flex', zIndex: 1350 }} onClick={() => setGigsModalGuest(null)}>
          <div className="modal-content" style={{ maxWidth: '480px', padding: '1.5rem', borderRadius: '12px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '1rem', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
                📍 {gigsModalGuest.FullName || `${gigsModalGuest.FirstName || gigsModalGuest.firstName || ''} ${gigsModalGuest.LastName || gigsModalGuest.lastName || ''}`} - Katıldığı Sahneler ({getGuestAttendedGigs(gigsModalGuest.GuestID || gigsModalGuest.id).length})
              </h2>
              <button type="button" className="close-btn" onClick={() => setGigsModalGuest(null)}>&times;</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '0.2rem' }}>
              {getGuestAttendedGigs(gigsModalGuest.GuestID || gigsModalGuest.id).length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem' }}>
                  Henüz katıldığı bir sahne kaydı bulunmuyor.
                </div>
              ) : (
                getGuestAttendedGigs(gigsModalGuest.GuestID || gigsModalGuest.id).map(gig => {
                  const rawDate = gig.GigDate || gig.gigDate;
                  const dateFormatted = rawDate ? new Date(rawDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-';
                  const relativeTime = formatGigRelativeTime(rawDate);
                  const venueName = gig.VenueName || gig.venueName || 'Bilinmeyen Mekân';
                  const cityName = gig.CityName || gig.cityName;
                  const venueStr = `${venueName}${cityName && cityName !== '-' ? ' (' + cityName + ')' : ''}`;

                  return (
                    <div 
                      key={gig.GigID || gig.id} 
                      className="guest-gig-card-item"
                      onClick={() => {
                        setGigsModalGuest(null);
                        const gigId = gig.GigID || gig.id;
                        const gigsNavBtn = document.querySelector('button.nav-btn[data-target="gigs"], #navMenu button[data-target="gigs"]');
                        if (gigsNavBtn) gigsNavBtn.click();
                        window.dispatchEvent(new CustomEvent('open-gig-from-guest', { detail: { gigId } }));
                        if (window.openGigModal) {
                          window.openGigModal(gigId);
                        }
                      }}
                      style={{ padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>📍 {venueStr}</div>
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>
                            📅 {dateFormatted} <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{relativeTime}</span>
                          </div>
                        </div>
                        <span style={{ color: 'var(--primary)', fontSize: '1.1rem', fontWeight: 'bold', paddingLeft: '0.5rem' }}>↗</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Note Popup Modal */}
      {noteModalGuest && createPortal(
        <div className="modal-overlay" style={{ zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setNoteModalGuest(null)}>
          <div className="modal-content" style={{ maxWidth: '450px', width: '90%', margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '0.75rem', paddingBottom: '0.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>📝 {noteModalGuest.FullName} - Notlar</h2>
              <button className="close-btn" onClick={() => setNoteModalGuest(null)}>&times;</button>
            </div>
            <div style={{ padding: '1rem', background: 'var(--surface-muted)', borderRadius: '8px', fontSize: '0.95rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)', lineHeight: 1.5, maxHeight: '60vh', overflowY: 'auto' }}>
              {noteModalGuest.Notes || 'Herhangi bir not bulunmamaktadır.'}
            </div>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setNoteModalGuest(null)}>Kapat</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
