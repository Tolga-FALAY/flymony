import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import store from '../store';
import { 
  noteToSemitone, 
  sharpScale, 
  flatScale, 
  getScaleForTargetKey, 
  renderTransposedTextAsHTML, 
  hasLyricsContent, 
  getUploadsUrl 
} from '../utils/chordUtils';

export default function Gigs() {
  const [gigs, setGigs] = useState([]);
  const [songs, setSongs] = useState([]);
  const [guests, setGuests] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGig, setEditingGig] = useState(null);
  const [noteModalGig, setNoteModalGig] = useState(null);
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const gigCameraInputRef = useRef(null);
  const gigBrowseInputRef = useRef(null);
  const gigDateInputRef = useRef(null);

  // Filter States
  const [filterSearch, setFilterSearch] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Table Sort State
  const [sortConfig, setSortConfig] = useState({ key: 'GigDate', direction: 'desc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Gig Editor Form State
  const [formData, setFormData] = useState({
    VenueID: '',
    GigDate: '',
    Notes: '',
    Photos: [],
    Videos: [],
    Songs: [], // { SongID, SortOrder, IsPlayed, IsRequest }
    Guests: [] // { GuestID, TableName }
  });

  // Editor Autocomplete & Add lists search
  const [songSearchText, setSongSearchText] = useState('');
  const [guestSearchText, setGuestSearchText] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  
  // Selection states for Grouping / Relationship inside tables
  const [selectedGroupGuests, setSelectedGroupGuests] = useState({}); // { table_name: Set(GuestIDs) }
  const [selectedTargetTable, setSelectedTargetTable] = useState('Masa 1');

  // Active Performance ("Sahnem") State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveGig, setLiveGig] = useState(null);
  const [liveSongIndex, setLiveSongIndex] = useState(-1);
  const [isLiveDrawerOpen, setIsLiveDrawerOpen] = useState(false);
  const [liveFontSize, setLiveFontSize] = useState(16);
  const [liveTheme, setLiveTheme] = useState('dark');
  const [liveViewMode, setLiveViewMode] = useState('chords'); // 'chords' vs 'image'
  const [liveTransposeShift, setLiveTransposeShift] = useState(0);
  const [liveIsSingleScreen, setLiveIsSingleScreen] = useState(false);
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState([]);
  const [liveSortField, setLiveSortField] = useState('no'); // 'no', 'sarki', 'sanatci'
  const [liveSortOrder, setLiveSortOrder] = useState('asc'); // 'asc', 'desc'
  const [liveShowUnplayedOnly, setLiveShowUnplayedOnly] = useState(false);

  const [liveChordPageIndex, setLiveChordPageIndex] = useState(0);

  const liveChordContentRef = useRef(null);

  useEffect(() => {
    const syncFromStore = () => {
      setGigs([...store.gigs]);
      setSongs([...store.songs]);
      setGuests([...store.guests]);
    };
    if (store.isLoaded) {
      syncFromStore();
    } else {
      store.load().then(syncFromStore);
    }
    window.addEventListener('store-updated', syncFromStore);

    const handleExternalOpenGig = (e) => {
      if (e.detail && e.detail.gigId) {
        const targetId = Number(e.detail.gigId);
        const gigToEdit = (store.gigs || []).find(g => Number(g.GigID || g.id) === targetId);
        if (gigToEdit) {
          handleEdit(gigToEdit);
        }
      }
    };
    window.addEventListener('open-gig-from-guest', handleExternalOpenGig);

    return () => {
      window.removeEventListener('store-updated', syncFromStore);
      window.removeEventListener('open-gig-from-guest', handleExternalOpenGig);
    };
  }, []);

  // HTML5 Canvas client-side image compression
  const compressImage = (file, maxWidth, maxHeight, quality = 0.7) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
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
          resolve(canvas.toDataURL(file.type || 'image/jpeg', quality));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const promises = files.map(file => compressImage(file, 800, 800, 0.75));
    const compressedImages = await Promise.all(promises);
    setFormData(prev => ({
      ...prev,
      Photos: [...prev.Photos, ...compressedImages]
    }));
    e.target.value = '';
  };

  const removePhoto = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      Photos: prev.Photos.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const addVideoLink = () => {
    if (!newVideoUrl.trim()) return;
    setFormData(prev => ({
      ...prev,
      Videos: [...prev.Videos, newVideoUrl.trim()]
    }));
    setNewVideoUrl('');
  };

  const removeVideo = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      Videos: prev.Videos.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleEdit = (gig) => {
    setEditingGig(gig);
    setFormData({
      VenueID: gig.VenueID || '',
      GigDate: gig.GigDate,
      Notes: gig.Notes || '',
      Photos: gig.Photos || [],
      Videos: gig.Videos || [],
      Songs: gig.Songs ? gig.Songs.map(s => ({
        SongID: Number(s.SongID),
        SortOrder: Number(s.SortOrder),
        IsPlayed: Number(s.IsPlayed),
        IsRequest: Number(s.IsRequest)
      })) : [],
      Guests: gig.Guests ? gig.Guests.map(g => ({
        GuestID: g.GuestID ? Number(g.GuestID) : null,
        IsAnonymous: !!g.IsAnonymous || !g.GuestID,
        TableName: g.TableName || 'Masa 1',
        Description: g.Description || '',
        GuestCount: Number(g.GuestCount || 1),
        FullName: g.FullName || (g.IsAnonymous ? (Number(g.GuestCount || 1) > 1 ? 'Tanımsız Grup' : 'Tanımsız Kişi') : 'Misafir')
      })) : []
    });
    setSongSearchText('');
    setGuestSearchText('');
    setSelectedGroupGuests({});
    const initialTable = (gig.Guests && gig.Guests.length > 0 && gig.Guests[0].TableName) ? gig.Guests[0].TableName : 'Masa 1';
    setSelectedTargetTable(initialTable);
    setIsModalOpen(true);
  };

  const formatGigDateWithDay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    });
  };

  const handleCreateNew = () => {
    setEditingGig(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({
      VenueID: '',
      GigDate: today,
      Notes: '',
      Photos: [],
      Videos: [],
      Songs: [],
      Guests: []
    });
    setSongSearchText('');
    setGuestSearchText('');
    setSelectedGroupGuests({});
    setSelectedTargetTable('Masa 1');
    setIsModalOpen(true);
  };

  const handleDelete = async (gigId) => {
    if (!confirm('Bu sahne gecesi kaydını tamamen silmek istediğinizden emin misiniz?')) return;
    try {
      await api.deleteGig(gigId);
      store.removeGig(gigId);
    } catch (err) {
      alert('Silme hatası: ' + err.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.VenueID || !formData.GigDate) {
      alert('Lütfen mekân ve tarih bilgilerini doldurun.');
      return;
    }

    const payload = {
      ...formData,
      Guests: formData.Guests.map(g => ({
        GuestID: (g.GuestID && Number(g.GuestID) > 0) ? Number(g.GuestID) : null,
        IsAnonymous: g.IsAnonymous ? 1 : 0,
        TableName: g.TableName || '',
        Description: g.Description || '',
        GuestCount: Number(g.GuestCount || 1),
        FullName: g.FullName
      }))
    };

    try {
      if (editingGig) {
        await api.updateGig(editingGig.GigID, payload);
        // Refresh local store
        const refreshed = await api.getGigs();
        const updated = refreshed.find(g => g.GigID === editingGig.GigID);
        if (updated) {
          store.updateGig(editingGig.GigID, updated);
        }
      } else {
        const result = await api.createGig(payload);
        const refreshed = await api.getGigs();
        const created = refreshed.find(g => g.GigID === result.GigID || g.GigID === result.id);
        if (created) {
          store.addGig(created);
        }
      }
      setIsModalOpen(false);
    } catch (err) {
      alert('Kaydetme hatası: ' + err.message);
    }
  };

  // --- Song management inside Gig Editor ---
  const addSongToGig = (song) => {
    if (formData.Songs.some(s => s.SongID === song.SongID)) {
      alert('Bu şarkı repertuvarda zaten ekli.');
      return;
    }
    const newSongEntry = {
      SongID: song.SongID,
      SortOrder: formData.Songs.length + 1,
      IsPlayed: 0,
      IsRequest: 0
    };
    setFormData(prev => ({
      ...prev,
      Songs: [...prev.Songs, newSongEntry]
    }));
    setSongSearchText('');
  };

  const removeSongFromGig = (songId) => {
    const filtered = formData.Songs.filter(s => s.SongID !== songId);
    // Recalculate SortOrders
    const recalculated = filtered.map((s, idx) => ({ ...s, SortOrder: idx + 1 }));
    setFormData(prev => ({
      ...prev,
      Songs: recalculated
    }));
  };

  const swapSongs = (idxA, idxB) => {
    if (idxA < 0 || idxA >= formData.Songs.length || idxB < 0 || idxB >= formData.Songs.length) return;
    const list = [...formData.Songs];
    const temp = list[idxA];
    list[idxA] = list[idxB];
    list[idxB] = temp;
    const recalculated = list.map((s, idx) => ({ ...s, SortOrder: idx + 1 }));
    setFormData(prev => ({
      ...prev,
      Songs: recalculated
    }));
  };

  const moveSongToOrder = (currentIndex, targetOrderVal) => {
    const targetOrder = parseInt(targetOrderVal);
    if (isNaN(targetOrder) || targetOrder < 1 || targetOrder > formData.Songs.length) return;
    const targetIdx = targetOrder - 1;
    if (currentIndex === targetIdx) return;

    const list = [...formData.Songs];
    const [moved] = list.splice(currentIndex, 1);
    list.splice(targetIdx, 0, moved);

    const recalculated = list.map((s, idx) => ({ ...s, SortOrder: idx + 1 }));
    setFormData(prev => ({
      ...prev,
      Songs: recalculated
    }));
  };

  const toggleGigModalSongPlayed = (songId) => {
    setFormData(prev => ({
      ...prev,
      Songs: prev.Songs.map(s => s.SongID === songId ? { ...s, IsPlayed: s.IsPlayed ? 0 : 1 } : s)
    }));
  };

  // --- Guest & Table management inside Gig Editor ---
  const addGuestToGig = (guest) => {
    if (formData.Guests.some(g => g.GuestID === guest.GuestID)) {
      alert('Bu misafir zaten ekli.');
      return;
    }
    const newGuestEntry = {
      GuestID: guest.GuestID,
      IsAnonymous: 0,
      TableName: selectedTargetTable || 'Masa 1',
      Description: '',
      GuestCount: 1,
      FullName: guest.FullName
    };
    setFormData(prev => ({
      ...prev,
      Guests: [...prev.Guests, newGuestEntry]
    }));
    setGuestSearchText('');
  };

  const addAnonymousGuestPerson = () => {
    setFormData(prev => ({
      ...prev,
      Guests: [
        ...prev.Guests,
        {
          GuestID: null,
          IsAnonymous: 1,
          TableName: selectedTargetTable || 'Masa 1',
          Description: '',
          GuestCount: 1,
          FullName: 'Tanımsız Kişi'
        }
      ]
    }));
  };

  const addAnonymousGuestGroup = () => {
    setFormData(prev => ({
      ...prev,
      Guests: [
        ...prev.Guests,
        {
          GuestID: null,
          IsAnonymous: 1,
          TableName: selectedTargetTable || 'Masa 1',
          Description: '',
          GuestCount: 2,
          FullName: 'Tanımsız Grup'
        }
      ]
    }));
  };

  const handleAddNewTable = () => {
    let maxNum = 0;
    existingTables.forEach(t => {
      const match = t.match(/^Masa\s*(\d+)$/i);
      if (match) {
        const n = parseInt(match[1]);
        if (n > maxNum) maxNum = n;
      }
    });
    const defaultNext = `Masa ${Math.max(existingTables.length + 1, maxNum + 1)}`;
    const newName = prompt('Yeni masa ismi veya numarası girin:', defaultNext);
    if (newName && newName.trim()) {
      const trimmed = newName.trim();
      setSelectedTargetTable(trimmed);
    }
  };

  const handleRenameTable = (oldTableName) => {
    const newName = prompt(`"${oldTableName}" masasının yeni ismini girin:`, oldTableName);
    if (newName && newName.trim() && newName.trim() !== oldTableName) {
      const trimmed = newName.trim();
      setFormData(prev => ({
        ...prev,
        Guests: prev.Guests.map(g => 
          (g.TableName || 'Masa 1') === oldTableName 
            ? { ...g, TableName: trimmed }
            : g
        )
      }));
      if (selectedTargetTable === oldTableName) {
        setSelectedTargetTable(trimmed);
      }
      setSelectedGroupGuests(prev => {
        const copy = { ...prev };
        if (copy[oldTableName]) {
          copy[trimmed] = copy[oldTableName];
          delete copy[oldTableName];
        }
        return copy;
      });
    }
  };

  const handleMoveGuestTable = (guestIndex, targetTableVal) => {
    if (targetTableVal === '__NEW_TABLE__') {
      let maxNum = 0;
      existingTables.forEach(t => {
        const match = t.match(/^Masa\s*(\d+)$/i);
        if (match) {
          const n = parseInt(match[1]);
          if (n > maxNum) maxNum = n;
        }
      });
      const defaultNext = `Masa ${Math.max(existingTables.length + 1, maxNum + 1)}`;
      const customName = prompt('Yeni masa ismi girin:', defaultNext);
      if (customName && customName.trim()) {
        const trimmed = customName.trim();
        updateGuestTableByIndex(guestIndex, trimmed);
        setSelectedTargetTable(trimmed);
      }
    } else {
      updateGuestTableByIndex(guestIndex, targetTableVal);
    }
  };

  const removeGuestFromGigByIndex = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      Guests: prev.Guests.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const updateGuestTableByIndex = (index, tableName) => {
    setFormData(prev => {
      const newGuests = [...prev.Guests];
      newGuests[index] = { ...newGuests[index], TableName: tableName || 'Masa 1' };
      return { ...prev, Guests: newGuests };
    });
  };

  const updateGuestDescription = (index, description) => {
    setFormData(prev => {
      const newGuests = [...prev.Guests];
      newGuests[index] = { ...newGuests[index], Description: description };
      return { ...prev, Guests: newGuests };
    });
  };

  const updateGuestCount = (index, countVal) => {
    setFormData(prev => {
      const newGuests = [...prev.Guests];
      newGuests[index] = { ...newGuests[index], GuestCount: Math.max(1, parseInt(countVal) || 1) };
      return { ...prev, Guests: newGuests };
    });
  };

  const pastePhotoFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        throw new Error("Tarayıcı panodan kopyalama okumasını desteklemiyor.");
      }
      const clipboardItems = await navigator.clipboard.read();
      let found = false;
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const compressed = await compressImage(blob, 800, 800, 0.75);
            setFormData(prev => ({ ...prev, Photos: [...prev.Photos, compressed] }));
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        alert("Panoda kopyalanmış bir görsel bulunamadı. CTRL+V tuşlarını kullanabilirsiniz!");
      }
    } catch (err) {
      alert("Pano okuma engellendi. Lütfen klavyenizden CTRL+V kısayolunu kullanın!");
    }
  };

  const toggleGroupGuestSelect = (tableName, guestId) => {
    setSelectedGroupGuests(prev => {
      const currentSet = new Set(prev[tableName] || []);
      if (currentSet.has(guestId)) {
        currentSet.delete(guestId);
      } else {
        currentSet.add(guestId);
      }
      return { ...prev, [tableName]: currentSet };
    });
  };

  const makeSelectedGuestsRelated = async (tableName) => {
    const selectedIds = Array.from(selectedGroupGuests[tableName] || []);
    if (selectedIds.length < 2) {
      alert('Lütfen ilişkilendirmek için aynı masadan en az 2 kişi seçin.');
      return;
    }

    try {
      // Loop over each selected guest and update their relationships with all others
      for (const currentId of selectedIds) {
        const guestObj = guests.find(g => g.GuestID === currentId);
        if (!guestObj) continue;
        const otherIds = selectedIds.filter(id => id !== currentId);
        const existingRels = guestObj.RelatedGuestIDs || [];
        // Merge without duplicates
        const newRels = Array.from(new Set([...existingRels, ...otherIds]));
        
        await api.updateGuest(currentId, {
          FirstName: guestObj.FirstName,
          LastName: guestObj.LastName,
          PhoneNumber: guestObj.PhoneNumber,
          InstagramLink: guestObj.InstagramLink,
          Notes: guestObj.Notes,
          ProfilePicture: guestObj.ProfilePicture,
          BirthDateDay: guestObj.BirthDateDay,
          BirthDateMonth: guestObj.BirthDateMonth,
          BirthDateYear: guestObj.BirthDateYear,
          Photos: guestObj.Photos,
          RelatedGuestIDs: newRels,
          IsMusician: guestObj.IsMusician
        });
      }
      
      // Reload core data from API to refresh global store relationships
      await store.load(true);
      alert('Seçilen misafirler birbiriyle kalıcı olarak ilişkilendirildi.');
      setSelectedGroupGuests(prev => ({ ...prev, [tableName]: new Set() }));
    } catch (err) {
      alert('İlişkilendirme hatası: ' + err.message);
    }
  };

  // --- Active Gig Performance ("Sahnem") Mode ---
  const triggerLiveAutoFit = () => {
    const pre = liveChordContentRef.current;
    if (!pre) return;
    let fontSize = 24;
    pre.style.fontSize = fontSize + 'px';
    const maxIterations = 50;
    let iterations = 0;
    while ((pre.scrollWidth > pre.clientWidth || pre.scrollHeight > pre.clientHeight) && fontSize > 8 && iterations < maxIterations) {
      fontSize--;
      pre.style.fontSize = fontSize + 'px';
      iterations++;
    }
  };

  useEffect(() => {
    if (isLiveMode && liveViewMode === 'chords' && liveIsSingleScreen) {
      const timer = setTimeout(triggerLiveAutoFit, 100);
      return () => clearTimeout(timer);
    }
  }, [isLiveMode, liveViewMode, liveIsSingleScreen, liveTransposeShift, liveSongIndex, liveFontSize]);

  // Keyboard navigation for Sahnem mode
  useEffect(() => {
    if (!isLiveMode) return;
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextSong();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevSong();
      } else if (e.key === 'Escape') {
        if (isLiveDrawerOpen) {
          setIsLiveDrawerOpen(false);
        } else {
          closeLiveMode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLiveMode, liveGig, liveSongIndex, isLiveDrawerOpen, liveViewMode, liveChordPageIndex]);

  const startLiveMode = (gig) => {
    if (!gig) return;
    setLiveGig(gig);
    const initialIndex = gig.Songs && gig.Songs.length > 0 ? 0 : -1;
    setLiveSongIndex(initialIndex);
    setLiveChordPageIndex(0);
    setIsLiveDrawerOpen(false);
    setLiveFontSize(16);
    setLiveTheme('dark');
    setLiveTransposeShift(0);
    setLiveIsSingleScreen(false);
    setLiveSearchQuery('');
    setLiveSearchResults([]);
    setLiveSortField('no');
    setLiveSortOrder('asc');
    setLiveShowUnplayedOnly(false);
    // Always default to chord image ('image') mode on stage opening!
    setLiveViewMode('image');
    setIsLiveMode(true);
  };

  const handleLiveSort = (field) => {
    if (liveSortField === field) {
      setLiveSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLiveSortField(field);
      setLiveSortOrder('asc');
    }
  };

  const closeLiveMode = async () => {
    setIsLiveMode(false);
    setIsLiveDrawerOpen(false);
    setLiveGig(null);
    setLiveSongIndex(-1);
    setLiveChordPageIndex(0);
    setLiveTransposeShift(0);
    // Force store reload to keep database status synced
    await store.load(true);
  };

  const goToNextSong = () => {
    if (!liveGig || !liveGig.Songs || liveGig.Songs.length === 0) return;
    
    // In chord image mode, check if current song has multiple chord pages
    if (liveViewMode === 'image' && liveSongIndex >= 0 && liveGig.Songs[liveSongIndex]) {
      const currentGigSong = liveGig.Songs[liveSongIndex];
      const fullSong = (store.songs || []).find(s => Number(s.SongID) === Number(currentGigSong.SongID)) || currentGigSong;
      const images = (Array.isArray(fullSong.ChordImages) && fullSong.ChordImages.length > 0)
        ? fullSong.ChordImages
        : (fullSong.ChordImagePath ? [fullSong.ChordImagePath] : []);
      
      if (images.length > 1 && liveChordPageIndex < images.length - 1) {
        setLiveChordPageIndex(prev => prev + 1);
        return;
      }
    }

    const nextIdx = (liveSongIndex + 1) % liveGig.Songs.length;
    setLiveSongIndex(nextIdx);
    setLiveChordPageIndex(0);
    setLiveTransposeShift(0);
    // Always default/reset to chord image ('image') mode on song switch!
    setLiveViewMode('image');
  };

  const goToPrevSong = () => {
    if (!liveGig || !liveGig.Songs || liveGig.Songs.length === 0) return;

    // In chord image mode, check if we can go to previous page of current song
    if (liveViewMode === 'image' && liveChordPageIndex > 0) {
      setLiveChordPageIndex(prev => prev - 1);
      return;
    }

    const prevIdx = (liveSongIndex - 1 + liveGig.Songs.length) % liveGig.Songs.length;
    
    let prevSongLastPage = 0;
    if (liveGig.Songs[prevIdx]) {
      const prevGigSong = liveGig.Songs[prevIdx];
      const prevFullSong = (store.songs || []).find(s => Number(s.SongID) === Number(prevGigSong.SongID)) || prevGigSong;
      const prevImages = (Array.isArray(prevFullSong.ChordImages) && prevFullSong.ChordImages.length > 0)
        ? prevFullSong.ChordImages
        : (prevFullSong.ChordImagePath ? [prevFullSong.ChordImagePath] : []);
      if (prevImages.length > 1) {
        prevSongLastPage = prevImages.length - 1;
      }
    }

    setLiveSongIndex(prevIdx);
    setLiveChordPageIndex(prevSongLastPage);
    setLiveTransposeShift(0);
    // Always default/reset to chord image ('image') mode on song switch!
    setLiveViewMode('image');
  };

  const handleRemoveLiveSong = async (songIndex) => {
    if (!liveGig || !liveGig.Songs || !liveGig.Songs[songIndex]) return;
    const targetSong = liveGig.Songs[songIndex];
    if (!window.confirm(`"${targetSong.SongTitle}" şarkısını canlı listeden silmek istediğinize emin misiniz?`)) return;

    const updatedSongs = liveGig.Songs.filter((_, idx) => idx !== songIndex).map((s, i) => ({ ...s, SortOrder: i + 1 }));
    let newSongIdx = liveSongIndex;
    if (newSongIdx >= updatedSongs.length) {
      newSongIdx = updatedSongs.length - 1;
    }

    const payload = {
      VenueID: liveGig.VenueID,
      GigDate: liveGig.GigDate,
      Notes: liveGig.Notes,
      Photos: liveGig.Photos,
      Videos: liveGig.Videos,
      Songs: updatedSongs,
      Guests: liveGig.Guests
    };

    try {
      await api.updateGig(liveGig.GigID, payload);
      setLiveGig(prev => ({ ...prev, Songs: updatedSongs }));
      setLiveSongIndex(newSongIdx);
    } catch (err) {
      alert('Şarkı silme hatası: ' + err.message);
    }
  };

  const toggleSongPlayed = async (songIndex) => {
    if (!liveGig || !liveGig.Songs || !liveGig.Songs[songIndex]) return;
    
    const updatedSongs = liveGig.Songs.map((s, idx) => 
      idx === songIndex ? { ...s, IsPlayed: s.IsPlayed ? 0 : 1 } : s
    );

    const payload = {
      VenueID: liveGig.VenueID,
      GigDate: liveGig.GigDate,
      Notes: liveGig.Notes,
      Photos: liveGig.Photos,
      Videos: liveGig.Videos,
      Songs: updatedSongs,
      Guests: (liveGig.Guests || []).map(g => ({
        GuestID: (g.GuestID && Number(g.GuestID) > 0) ? Number(g.GuestID) : null,
        IsAnonymous: g.IsAnonymous ? 1 : 0,
        TableName: g.TableName || '',
        Description: g.Description || '',
        GuestCount: Number(g.GuestCount || 1),
        FullName: g.FullName
      }))
    };

    try {
      await api.updateGig(liveGig.GigID, payload);
      setLiveGig(prev => ({ ...prev, Songs: updatedSongs }));
    } catch (err) {
      alert('İşaretleme hatası: ' + err.message);
    }
  };

  const searchLiveRequests = (text) => {
    setLiveSearchQuery(text);
    if (!text.trim()) {
      setLiveSearchResults([]);
      return;
    }
    const term = text.toLocaleLowerCase('tr-TR');
    const matched = songs.filter(s => 
      s.SongTitle.toLocaleLowerCase('tr-TR').includes(term) ||
      (s.ArtistNames && s.ArtistNames.toLocaleLowerCase('tr-TR').includes(term))
    );
    setLiveSearchResults(matched.slice(0, 10));
  };

  const playRequestSongDirect = async (song) => {
    if (!liveGig) return;
    
    // Check if song is already in the list
    let existingIdx = liveGig.Songs.findIndex(s => s.SongID === song.SongID);
    
    if (existingIdx !== -1) {
      // Switch to this song index
      setLiveSongIndex(existingIdx);
      setLiveChordPageIndex(0);
      setLiveTransposeShift(0);
      setLiveViewMode('image');
    } else {
      // Add as unplayed request at the end of the list
      const newOrder = liveGig.Songs.length + 1;
      const newLiveSong = {
        SongID: song.SongID,
        SortOrder: newOrder,
        IsPlayed: 0,
        IsRequest: 1,
        SongTitle: song.SongTitle,
        ArtistNames: song.ArtistNames,
        ChordImagePath: song.ChordImagePath || '',
        ChordImages: song.ChordImages || (song.ChordImagePath ? [song.ChordImagePath] : [])
      };
      
      const newSongsList = [...liveGig.Songs, newLiveSong];
      const payload = {
        VenueID: liveGig.VenueID,
        GigDate: liveGig.GigDate,
        Notes: liveGig.Notes,
        Photos: liveGig.Photos,
        Videos: liveGig.Videos,
        Songs: newSongsList,
        Guests: (liveGig.Guests || []).map(g => ({
          GuestID: (g.GuestID && Number(g.GuestID) > 0) ? Number(g.GuestID) : null,
          IsAnonymous: g.IsAnonymous ? 1 : 0,
          TableName: g.TableName || '',
          Description: g.Description || '',
          GuestCount: Number(g.GuestCount || 1),
          FullName: g.FullName
        }))
      };

      try {
        await api.updateGig(liveGig.GigID, payload);
        setLiveGig(prev => ({ ...prev, Songs: newSongsList }));
        setLiveSongIndex(newSongsList.length - 1);
        setLiveChordPageIndex(0);
        setLiveTransposeShift(0);
        setLiveViewMode('image');
      } catch (err) {
        alert('İstek ekleme hatası: ' + err.message);
      }
    }
    
    // Clear request search box
    setLiveSearchQuery('');
    setLiveSearchResults([]);
  };

  // Touch Swipe & Tap for Chord Slider
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const touchEndX = useRef(null);
  const touchEndY = useRef(null);
  const swipeOccurredRef = useRef(false);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    touchEndX.current = null;
    touchEndY.current = null;
    swipeOccurredRef.current = false;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diffX = touchStartX.current - touchEndX.current;
    const diffY = (touchStartY.current !== null && touchEndY.current !== null)
      ? touchStartY.current - touchEndY.current
      : 0;

    const minSwipe = 45;
    if (Math.abs(diffX) > minSwipe && Math.abs(diffX) > Math.abs(diffY) * 1.2) {
      swipeOccurredRef.current = true;
      if (diffX > 0) {
        goToNextSong();
      } else {
        goToPrevSong();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  // 3-Zone Tap Handler (Left 1/3 = Previous, Right 1/3 = Next, Center 1/3 = Safe Zone)
  const handleChordImageZoneClick = (e) => {
    if (swipeOccurredRef.current) {
      swipeOccurredRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect || !rect.width) return;

    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;

    if (ratio < 0.3333) {
      // Left 1/3 -> Previous chord page / song
      goToPrevSong();
    } else if (ratio > 0.6666) {
      // Right 1/3 -> Next chord page / song
      goToNextSong();
    }
    // Center 1/3 (0.3333 - 0.6666) -> Safe zone, no action
  };

  // --- Filtering & Sorting Gigs ---
  const filteredGigs = gigs.filter(gig => {
    // 1. Serbest Arama (Mekân, Notlar, vb.)
    if (filterSearch) {
      const query = filterSearch.toLocaleLowerCase('tr-TR');
      const venueMatch = (gig.VenueName || '').toLocaleLowerCase('tr-TR').includes(query);
      const notesMatch = (gig.Notes || '').toLocaleLowerCase('tr-TR').includes(query);
      if (!venueMatch && !notesMatch) return false;
    }

    // 2. Mekân Filtresi
    if (filterVenue && gig.VenueName !== filterVenue) {
      return false;
    }

    // 3. Tarih Aralığı Filtresi
    if (filterStartDate && gig.GigDate < filterStartDate) return false;
    if (filterEndDate && gig.GigDate > filterEndDate) return false;

    return true;
  }).sort((a, b) => {
    let comp = 0;
    if (sortConfig.key === 'GigDate') {
      const timeA = new Date(a.GigDate).getTime() || 0;
      const timeB = new Date(b.GigDate).getTime() || 0;
      comp = timeA - timeB;
    } else if (sortConfig.key === 'VenueName') {
      const aVal = (a.VenueName || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.VenueName || '').toLocaleLowerCase('tr-TR');
      comp = aVal.localeCompare(bVal, 'tr');
    } else if (sortConfig.key === 'GuestCount') {
      const aGuests = a.Guests ? a.Guests.reduce((sum, g) => sum + (Number(g.GuestCount) || 1), 0) : 0;
      const bGuests = b.Guests ? b.Guests.reduce((sum, g) => sum + (Number(g.GuestCount) || 1), 0) : 0;
      comp = aGuests - bGuests;
    }
    return sortConfig.direction === 'asc' ? comp : -comp;
  });

  // Unique venues list for dropdown filter
  const uniqueVenues = Array.from(new Set(gigs.map(g => g.VenueName).filter(Boolean))).sort((a, b) =>
    a.toLocaleLowerCase('tr-TR').localeCompare(b.toLocaleLowerCase('tr-TR'), 'tr')
  );

  // Derived list of unique tables
  const existingTables = Array.from(
    new Set(formData.Guests.map(g => (g.TableName || '').trim()).filter(Boolean))
  );
  if (existingTables.length === 0) {
    existingTables.push('Masa 1');
  }
  if (selectedTargetTable && !existingTables.includes(selectedTargetTable)) {
    existingTables.push(selectedTargetTable);
  }

  // Grouping guests inside the editor by table
  const guestsByTable = {};
  formData.Guests.forEach((gEntry, index) => {
    const guestObj = guests.find(g => g.GuestID === gEntry.GuestID);
    const tName = gEntry.TableName || 'Masasız';
    if (!guestsByTable[tName]) guestsByTable[tName] = [];
    let displayName = gEntry.FullName;
    if (guestObj) {
      displayName = guestObj.FullName;
    } else if (!displayName || displayName === 'Misafir') {
      displayName = (Number(gEntry.GuestCount || 1) > 1) ? 'Tanımsız Grup' : 'Tanımsız Kişi';
    }
    guestsByTable[tName].push({
      ...gEntry,
      _idx: index,
      FullName: displayName
    });
  });

  const formatLiveGigDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const datePart = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    const dayName = d.toLocaleDateString('tr-TR', { weekday: 'long' });
    return `${datePart}, ${dayName}`;
  };

  return (
    <section id="gigs" className="tab-content active">
      {/* HEADER CONTROLS */}
      <div className="section-header">
        <h2>Sahnelerim ({filteredGigs.length})</h2>
        <button className="btn btn-primary" onClick={handleCreateNew}>+ Yeni Sahne</button>
      </div>

      {/* FILTER PANEL */}
      <div className="filters-panel">
        <div className="filter-group-row">
          <div className="filter-item search-box">
            <label>Serbest Arama</label>
            <input 
              type="text" 
              placeholder="Mekân veya notlar..." 
              value={filterSearch} 
              onChange={e => setFilterSearch(e.target.value)} 
            />
          </div>
          <div className="filter-item">
            <label>Mekân</label>
            <select value={filterVenue} onChange={e => setFilterVenue(e.target.value)}>
              <option value="">Tüm Mekânlar</option>
              {uniqueVenues.map(venueName => (
                <option key={venueName} value={venueName}>{venueName}</option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Başlangıç Tarihi</label>
            <input 
              type="date" 
              value={filterStartDate} 
              onChange={e => setFilterStartDate(e.target.value)} 
            />
          </div>
          <div className="filter-item">
            <label>Bitiş Tarihi</label>
            <input 
              type="date" 
              value={filterEndDate} 
              onChange={e => setFilterEndDate(e.target.value)} 
            />
          </div>
          <div className="filter-item filter-actions">
            <button className="btn btn-outline btn-sm" onClick={() => {
              setFilterSearch('');
              setFilterVenue('');
              setFilterStartDate('');
              setFilterEndDate('');
            }}>Temizle</button>
          </div>
        </div>
      </div>

      {/* GIGS LIST TABLE */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('GigDate')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Tarih {sortConfig.key === 'GigDate' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
              </th>
              <th onClick={() => handleSort('VenueName')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Mekân {sortConfig.key === 'VenueName' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
              </th>
              <th style={{ textAlign: 'center' }}>Şarkı Sayısı</th>
              <th onClick={() => handleSort('GuestCount')} style={{ textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                MİSAFİRLERİM {sortConfig.key === 'GuestCount' ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
              </th>
              <th style={{ width: '300px', textAlign: 'right' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredGigs.map(gig => {
              const formattedDate = new Date(gig.GigDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
              const songsCount = gig.Songs ? gig.Songs.length : 0;
              const playedCount = gig.Songs ? gig.Songs.filter(s => s.IsPlayed).length : 0;
              const guestsCount = gig.Guests ? gig.Guests.reduce((sum, g) => sum + (Number(g.GuestCount) || 1), 0) : 0;

              return (
                <tr key={gig.GigID}>
                  <td data-label="Tarih">{formattedDate}</td>
                  <td data-label="Mekân">{gig.VenueName} ({gig.CityName || '-'})</td>
                  <td data-label="Şarkı Sayısı" style={{ textAlign: 'center' }}>
                    <span style={{ fontWeight: '600' }}>{playedCount}</span> / {songsCount}
                  </td>
                  <td data-label="Misafir Sayısı" style={{ textAlign: 'center' }}>{guestsCount}</td>
                  <td data-label="İşlemler">
                    <div className="action-btns">
                      {String(gig.Notes || '').trim().length > 0 && (
                        <button 
                          className="btn btn-sm" 
                          style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.35rem 0.55rem', borderRadius: '6px', cursor: 'pointer', marginRight: '0.2rem' }}
                          onClick={() => setNoteModalGig(gig)}
                          title={gig.Notes}
                        >
                          📝
                        </button>
                      )}
                      <button className="btn btn-sm btn-outline btn-added-style" onClick={() => startLiveMode(gig)}>Sahnem 🎤</button>
                      <button className="btn btn-sm btn-outline" onClick={() => handleEdit(gig)}>Düzenle</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(gig.GigID)}>Sil</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredGigs.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EDITOR GIG MODAL */}
      {isModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>{editingGig ? 'Sahne Gecesi Düzenle' : 'Yeni Sahne Gecesi Ekle'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="filter-group-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Sahne Alınan Mekân (Mekân)</label>
                  <select
                    value={formData.VenueID}
                    onChange={e => setFormData({ ...formData, VenueID: e.target.value })}
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
                    <option value="">Mekân Seçin...</option>
                    {store.venues.map(v => (
                      <option key={v.VenueID} value={v.VenueID}>
                        {v.VenueName} ({v.CityName})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Sahne Tarihi</label>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <input 
                      type="text" 
                      readOnly 
                      value={formatGigDateWithDay(formData.GigDate)} 
                      onClick={() => gigDateInputRef.current?.showPicker ? gigDateInputRef.current.showPicker() : gigDateInputRef.current?.focus()} 
                      style={{
                        width: '100%',
                        padding: '0.75rem 2.5rem 0.75rem 1rem',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '10px',
                        backgroundColor: 'var(--surface)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.95rem'
                      }}
                    />
                    <input 
                      type="date" 
                      ref={gigDateInputRef}
                      value={formData.GigDate} 
                      onChange={e => setFormData({ ...formData, GigDate: e.target.value })} 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100%', 
                        opacity: 0, 
                        cursor: 'pointer',
                        zIndex: 1
                      }}
                      required 
                    />
                    <span style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '1.1rem', color: 'var(--text-muted)' }}>
                      📅
                    </span>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Geceye Dair Notlar</label>
                <textarea 
                  value={formData.Notes} 
                  onChange={e => setFormData({ ...formData, Notes: e.target.value })} 
                  placeholder="Geceden kalan notlar, gözlemler, sahne atmosferi..."
                  style={{ fontSize: '0.85rem', height: '80px', resize: 'vertical' }}
                />
              </div>

              {/* TABS CONTAINER FOR SONGS AND GUESTS IN MODAL */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginTop: '1.5rem' }}>
                
                {/* SONGS SECTION */}
                {(() => {
                  const allSongs = formData.Songs || [];
                  const repSongs = allSongs.filter(s => Number(s.IsRequest) !== 1);
                  const reqSongs = allSongs.filter(s => Number(s.IsRequest) === 1);

                  const repTotal = repSongs.length;
                  const repPlayed = repSongs.filter(s => s.IsPlayed).length;
                  const repRemaining = Math.max(0, repTotal - repPlayed);

                  const reqTotal = reqSongs.length;
                  const reqPlayed = reqSongs.filter(s => s.IsPlayed).length;
                  const reqRemaining = Math.max(0, reqTotal - reqPlayed);

                  const grandTotal = allSongs.length;
                  const grandPlayed = allSongs.filter(s => s.IsPlayed).length;
                  const grandRemaining = Math.max(0, grandTotal - grandPlayed);

                  return (
                    <div style={{ borderRight: '1px solid var(--border)', paddingRight: '1.5rem', minWidth: 0, overflow: 'hidden' }}>
                      {/* Header and Live Stats Row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        {/* Left Side: Title and Shortened Search Box */}
                        <div style={{ flex: '1 1 52%', minWidth: 0 }}>
                          <h3 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-main)', fontSize: '1rem', fontWeight: 800 }}>
                            🎵 Şarkı Listesi ({formData.Songs.length})
                          </h3>
                          
                          {/* Add song dropdown search */}
                          <div className="form-group" style={{ position: 'relative', margin: 0 }}>
                            <input 
                              type="text" 
                              placeholder="Şarkı ara ve listeye ekle..." 
                              value={songSearchText}
                              onChange={e => setSongSearchText(e.target.value)} 
                              style={{ width: '100%', margin: 0, padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                            />
                            {songSearchText.trim() && (
                              <div className="listbox-container" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--bg-card, #ffffff)', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '280px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                {songs
                                  .filter(s => {
                                    const query = songSearchText.toLocaleLowerCase('tr-TR');
                                    const titleMatch = s.SongTitle && s.SongTitle.toLocaleLowerCase('tr-TR').includes(query);
                                    const artistMatch = s.ArtistNames && s.ArtistNames.toLocaleLowerCase('tr-TR').includes(query);
                                    return titleMatch || artistMatch;
                                  })
                                  .slice(0, 10)
                                  .map(s => {
                                    const hasChord = Boolean(s.ChordImagePath && s.ChordImagePath.trim());
                                    return (
                                      <div 
                                        key={s.SongID} 
                                        onClick={() => addSongToGig(s)}
                                        style={{ 
                                          padding: '0.5rem 0.75rem', 
                                          cursor: 'pointer', 
                                          borderBottom: '1px solid var(--border-soft)', 
                                          fontSize: '0.85rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '0.5rem'
                                        }}
                                        className="autocomplete-item-hover"
                                      >
                                        <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <span style={{ fontWeight: !hasChord ? 700 : 'normal', color: !hasChord ? '#dc2626' : 'inherit' }}>
                                            {s.SongTitle}
                                          </span>
                                          {s.ArtistNames && (
                                            <span style={{ opacity: 0.75, fontSize: '0.78rem', marginLeft: '6px', color: !hasChord ? '#ef4444' : 'var(--text-muted)' }}>
                                              ({s.ArtistNames})
                                            </span>
                                          )}
                                        </div>
                                        {!hasChord && (
                                          <span className="live-no-chord-badge">Akor Yok</span>
                                        )}
                                      </div>
                                    );
                                  })
                                }
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Live Statistics (Repertuvar, İstekler, Toplam) */}
                        <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '3px', textAlign: 'right', paddingTop: '2px' }}>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-main)', fontWeight: 500 }}>
                            Repertuvar ({repPlayed}/{repTotal}) - kalan {repRemaining}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-main)', fontWeight: 500 }}>
                            İstekler ({reqPlayed}/{reqTotal}) - kalan {reqRemaining}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-main)', fontWeight: 600 }}>
                            Toplam ({grandPlayed}/{grandTotal}) - kalan {grandRemaining}
                          </div>
                        </div>
                      </div>

                      {/* List of gig songs */}
                      <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
                        {formData.Songs.map((gSong, idx) => {
                          const songObj = songs.find(s => s.SongID === gSong.SongID);
                          if (!songObj) return null;
                          const isPlayed = Boolean(gSong.IsPlayed);
                          const hasChord = Boolean((songObj.ChordImagePath && songObj.ChordImagePath.trim()) || (gSong.ChordImagePath && gSong.ChordImagePath.trim()));
                          return (
                            <div key={gSong.SongID} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', fontSize: '0.85rem', background: isPlayed ? 'rgba(16, 185, 129, 0.06)' : 'transparent', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                <span style={{ fontWeight: 'bold', color: 'var(--text-muted)', width: '22px', flexShrink: 0 }}>{gSong.SortOrder}.</span>
                                {Number(gSong.IsRequest) === 1 && (
                                  <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', fontWeight: 700, flexShrink: 0 }}>İstek</span>
                                )}
                                <span style={{ 
                                  textOverflow: 'ellipsis', 
                                  overflow: 'hidden', 
                                  whiteSpace: 'nowrap', 
                                  textDecoration: isPlayed ? 'line-through' : 'none',
                                  color: isPlayed ? 'var(--text-muted)' : (!hasChord ? '#dc2626' : 'inherit'),
                                  fontWeight: !hasChord && !isPlayed ? 700 : 'normal',
                                  flex: 1,
                                  minWidth: 0
                                }} title={songObj.SongTitle}>
                                  {songObj.SongTitle}
                                  {songObj.ArtistNames && songObj.ArtistNames !== '-' && (
                                    <span style={{ opacity: 0.75, fontSize: '0.75rem', marginLeft: '6px', color: !hasChord && !isPlayed ? '#ef4444' : 'var(--text-muted)' }}>
                                      ({songObj.ArtistNames})
                                    </span>
                                  )}
                                </span>
                                {!hasChord && (
                                  <span className="live-no-chord-tag" style={{ fontSize: '0.65rem', padding: '1px 5px', flexShrink: 0 }}>Akor Yok</span>
                                )}
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                <button 
                                  type="button" 
                                  onClick={() => toggleGigModalSongPlayed(gSong.SongID)}
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    minWidth: '24px',
                                    padding: 0,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.82rem',
                                    fontWeight: 800,
                                    borderRadius: '50%',
                                    border: '1px solid',
                                    borderColor: isPlayed ? '#10b981' : 'var(--border)',
                                    background: isPlayed ? '#10b981' : 'transparent',
                                    color: isPlayed ? '#ffffff' : 'var(--text-muted)',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                  }}
                                  title={isPlayed ? "Çalınmadı olarak işaretle" : "Çalındı olarak işaretle"}
                                >
                                  {isPlayed ? '✓' : '◯'}
                                </button>
                                {/* Sequence shift input */}
                                <input 
                                  type="text" 
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={gSong.SortOrder}
                                  onChange={e => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    if (val) moveSongToOrder(idx, val);
                                  }}
                                  style={{ 
                                    width: '28px', 
                                    padding: '2px 0', 
                                    textAlign: 'center', 
                                    fontSize: '0.8rem', 
                                    height: '24px', 
                                    margin: 0,
                                    borderRadius: '4px',
                                    border: '1px solid var(--border)',
                                    flexShrink: 0
                                  }}
                                  title="Sıra Numarası"
                                />
                                <button type="button" className="btn btn-outline" style={{ padding: '2px 5px', fontSize: '0.72rem', height: '24px', flexShrink: 0 }} onClick={() => swapSongs(idx, idx - 1)} disabled={idx === 0}>▲</button>
                                <button type="button" className="btn btn-outline" style={{ padding: '2px 5px', fontSize: '0.72rem', height: '24px', flexShrink: 0 }} onClick={() => swapSongs(idx, idx + 1)} disabled={idx === formData.Songs.length - 1}>▼</button>
                                <button type="button" className="btn btn-sm btn-danger" style={{ padding: '2px 6px', fontSize: '0.75rem', height: '24px', borderRadius: '4px', flexShrink: 0 }} onClick={() => removeSongFromGig(gSong.SongID)}>&times;</button>
                              </div>
                            </div>
                          );
                        })}
                        {formData.Songs.length === 0 && (
                          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Henüz şarkı eklenmedi.</div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* GUESTS SECTION */}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem' }}>
                      👥 Misafirler ({formData.Guests.reduce((sum, g) => sum + (Number(g.GuestCount) || 1), 0)})
                    </h3>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button type="button" className="btn btn-sm btn-outline" onClick={addAnonymousGuestPerson} style={{ fontSize: '0.75rem', padding: '2px 8px', height: '24px', lineHeight: 1, whiteSpace: 'nowrap' }}>➕ Kişi</button>
                      <button type="button" className="btn btn-sm btn-outline" onClick={addAnonymousGuestGroup} style={{ fontSize: '0.75rem', padding: '2px 8px', height: '24px', lineHeight: 1, whiteSpace: 'nowrap' }}>➕ Grup</button>
                    </div>
                  </div>

                  {/* ACTIVE / TARGET TABLE SELECTOR BAR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', background: '#f1f5f9', padding: '0.35rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-soft)' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>📍 Hedef Masa:</span>
                    <select 
                      value={selectedTargetTable} 
                      onChange={e => {
                        if (e.target.value === '__NEW__') {
                          handleAddNewTable();
                        } else {
                          setSelectedTargetTable(e.target.value);
                        }
                      }}
                      style={{ flex: 1, padding: '2px 6px', fontSize: '0.8rem', height: '24px', margin: 0, borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: 'var(--primary)', background: '#ffffff' }}
                    >
                      {existingTables.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                      <option value="__NEW__">➕ Yeni Masa Aç...</option>
                    </select>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline" 
                      onClick={handleAddNewTable} 
                      style={{ fontSize: '0.75rem', padding: '2px 6px', height: '24px', whiteSpace: 'nowrap' }}
                      title="Yeni Masa Oluştur"
                    >
                      ➕ Yeni Masa
                    </button>
                  </div>
                  
                  <div className="form-group" style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder={`Misafir ara ve [${selectedTargetTable}] masasına ekle...`} 
                      value={guestSearchText} 
                      onChange={e => setGuestSearchText(e.target.value)} 
                    />
                    {guestSearchText.trim() && (
                      <div className="listbox-container" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'white', border: '1px solid var(--border)', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        {guests
                          .filter(g => g.FullName.toLocaleLowerCase('tr-TR').includes(guestSearchText.toLocaleLowerCase('tr-TR')))
                          .slice(0, 10)
                          .map(g => (
                            <div 
                              key={g.GuestID} 
                              onClick={() => addGuestToGig(g)}
                              style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)', fontSize: '0.85rem' }}
                              className="autocomplete-item-hover"
                            >
                              {g.FullName}
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>

                  {/* List of gig guests grouped by Table */}
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem' }}>
                    {Object.keys(guestsByTable).map(tName => {
                      const totalInGroup = guestsByTable[tName].reduce((sum, g) => sum + (Number(g.GuestCount) || 1), 0);
                      return (
                        <div key={tName} style={{ marginBottom: '0.75rem', border: '1px solid var(--border-soft)', borderRadius: '6px', padding: '0.5rem', background: '#f8fafc' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.3rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>📍 {tName} ({totalInGroup})</span>
                              <button 
                                type="button" 
                                className="btn btn-outline" 
                                style={{ padding: '1px 5px', fontSize: '0.7rem', height: '20px' }}
                                onClick={() => handleRenameTable(tName)}
                                title="Masa Adını Değiştir"
                              >
                                ✏️ Adlandır
                              </button>
                            </div>
                            <button 
                              type="button" 
                              className="btn btn-outline" 
                              style={{ padding: '2px 6px', fontSize: '0.75rem', height: '22px' }}
                              onClick={() => makeSelectedGuestsRelated(tName)}
                              title="Seçilen misafirleri birbiriyle ilişkilendir"
                            >
                              🔗 İlişkilendir
                            </button>
                          </div>
                          {guestsByTable[tName].map(gEntry => {
                            const isAnonymous = Boolean(gEntry.IsAnonymous || !gEntry.GuestID);
                            const isGroup = isAnonymous && (Number(gEntry.GuestCount || 1) > 1 || gEntry.FullName === 'Tanımsız Grup');

                            return (
                              <div key={gEntry._idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.35rem 0', borderBottom: '1px dashed #e2e8f0', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                  {isAnonymous ? (
                                    isGroup ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                        <span style={{ color: '#0284c7', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>👥 Tanımsız Grup</span>
                                        <input 
                                          type="number" 
                                          min="1" 
                                          max="99" 
                                          value={gEntry.GuestCount || 1} 
                                          onChange={e => updateGuestCount(gEntry._idx, e.target.value)} 
                                          style={{ width: '45px', padding: '1px 4px', fontSize: '0.78rem', height: '22px', margin: 0, textAlign: 'center' }} 
                                          title="Kişi Sayısı"
                                        />
                                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Kişi</span>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '0.95rem', userSelect: 'none' }} title="Tanımsız Kişi">👤</span>
                                        <input 
                                          type="text" 
                                          value={gEntry.Description || ''} 
                                          onChange={e => updateGuestDescription(gEntry._idx, e.target.value)} 
                                          placeholder="Kişi ismi, tarif veya açıklama" 
                                          style={{ flex: 1, minWidth: 0, padding: '2px 6px', fontSize: '0.78rem', height: '22px', margin: 0, border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}
                                        />
                                      </div>
                                    )
                                  ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                                      <input 
                                        type="checkbox" 
                                        checked={!!(selectedGroupGuests[tName] && selectedGroupGuests[tName].has(gEntry.GuestID))}
                                        onChange={() => toggleGroupGuestSelect(tName, gEntry.GuestID)}
                                        style={{ margin: 0 }}
                                      />
                                      <span style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{gEntry.FullName}</span>
                                    </div>
                                  )}
                                  
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <select 
                                      value={gEntry.TableName || 'Masa 1'} 
                                      onChange={e => handleMoveGuestTable(gEntry._idx, e.target.value)}
                                      style={{ width: '95px', padding: '1px 4px', fontSize: '0.78rem', height: '22px', margin: 0, borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff' }}
                                      title="Misafirin Masasını Değiştir"
                                    >
                                      {existingTables.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                      <option value="__NEW_TABLE__">➕ Yeni Masa...</option>
                                    </select>
                                    <button type="button" className="btn btn-sm btn-danger" style={{ padding: '1px 5px', fontSize: '0.7rem', height: '20px' }} onClick={() => removeGuestFromGigByIndex(gEntry._idx)}>&times;</button>
                                  </div>
                                </div>

                                {/* Ekstra açıklama/tarif alanı SADECE Tanımsız Grup için alt satırda gösterilir */}
                                {isAnonymous && isGroup && (
                                  <input 
                                    type="text" 
                                    value={gEntry.Description || ''} 
                                    onChange={e => updateGuestDescription(gEntry._idx, e.target.value)} 
                                    placeholder="Grup tarifi veya açıklama (örn: Ahmet'in yanındaki masa)..." 
                                    style={{ width: '100%', padding: '2px 6px', fontSize: '0.78rem', height: '22px', margin: 0, border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff' }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {formData.Guests.length === 0 && (
                      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Henüz misafir veya tanımsız grup eklenmedi.</div>
                    )}
                  </div>
                </div>

              </div>

              {/* MEDIA GALLERY SECTION */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                
                {/* FOTOLAR SECTION */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>Sahne Görselleri (Fotolar)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => gigCameraInputRef.current?.click()}>
                      📷 Fotoğraf Çek
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => gigBrowseInputRef.current?.click()}>
                      📂 Görsel Ekle
                    </button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={pastePhotoFromClipboard}>
                      📋 Yapıştır
                    </button>
                  </div>
                </div>

                <input 
                  type="file" 
                  ref={gigCameraInputRef} 
                  accept="image/*" 
                  capture="environment" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={handlePhotoUpload} 
                />
                <input 
                  type="file" 
                  ref={gigBrowseInputRef} 
                  accept="image/*" 
                  multiple 
                  style={{ display: 'none' }} 
                  onChange={handlePhotoUpload} 
                />

                <div className="gallery-previews-grid" style={{ marginBottom: '1.25rem' }}>
                  {formData.Photos && formData.Photos.map((photo, index) => (
                    <div key={index} className="gallery-preview-item">
                      <img 
                        src={photo} 
                        alt={`Sahne Fotoğrafı ${index + 1}`} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => setFullscreenImage(photo)}
                      />
                      <button type="button" className="gallery-preview-delete-badge" onClick={() => removePhoto(index)} title="Fotoğrafı Sil">&times;</button>
                    </div>
                  ))}
                  {(!formData.Photos || formData.Photos.length === 0) && (
                    <div className="gallery-empty-placeholder">
                      <span>Henüz fotoğraf eklenmemiş. Anlık çekebilir veya cihazınızdan seçebilirsiniz.</span>
                    </div>
                  )}
                </div>

                {/* VIDEO LINKS SECTION */}
                <div style={{ marginTop: '1.25rem', borderTop: '1px dashed var(--border)', paddingTop: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Video Linki URL (YouTube, Drive...)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Video URL'si ekle veya yapıştır..." 
                      value={newVideoUrl} 
                      onChange={e => setNewVideoUrl(e.target.value)} 
                      style={{ margin: 0, flex: 1, fontSize: '0.85rem' }}
                    />
                    <button type="button" className="btn btn-outline" onClick={addVideoLink}>Ekle</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {formData.Videos.map((url, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.82rem', border: '1px solid #e2e8f0' }}>
                        <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'underline' }}>
                          🎬 {url}
                        </a>
                        <button type="button" className="btn btn-sm btn-danger" style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }} onClick={() => removeVideo(index)}>&times;</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions" style={{ marginTop: '2rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ACTIVE LIVE GIG MODE ("SAHNEM" fullscreen chord swiper) */}
      {isLiveMode && liveGig && createPortal(
        <div className={`fullscreen-viewer-overlay live-stage-overlay ${liveViewMode === 'image' ? 'theme-chord' : `theme-${liveTheme}`}`}>
          
          {/* LEFT SLIDE-IN REPERTOIRE DRAWER */}
          {isLiveDrawerOpen && (
            <div className="live-stage-backdrop" onClick={() => setIsLiveDrawerOpen(false)} />
          )}
          <div className={`live-stage-drawer ${isLiveDrawerOpen ? 'open' : ''}`}>
            {/* Drawer Header */}
            {(() => {
              const allSongs = liveGig.Songs || [];
              const repSongs = allSongs.filter(s => Number(s.IsRequest) !== 1);
              const reqSongs = allSongs.filter(s => Number(s.IsRequest) === 1);

              const repTotal = repSongs.length;
              const repPlayed = repSongs.filter(s => Number(s.IsPlayed) === 1).length;
              const repRemaining = Math.max(0, repTotal - repPlayed);

              const reqTotal = reqSongs.length;
              const reqPlayed = reqSongs.filter(s => Number(s.IsPlayed) === 1).length;
              const reqRemaining = Math.max(0, reqTotal - reqPlayed);

              const grandTotal = allSongs.length;
              const grandPlayed = allSongs.filter(s => Number(s.IsPlayed) === 1).length;
              const grandRemaining = Math.max(0, grandTotal - grandPlayed);

              return (
                <div className="live-stage-drawer-header">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.45rem', marginTop: '2px' }}>🎙️</span>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{liveGig.VenueName}</h3>
                      {liveGig.GigDate && (
                        <div style={{ fontSize: '0.86rem', color: '#38bdf8', fontWeight: 700, marginTop: '2px' }}>
                          {formatLiveGigDate(liveGig.GigDate)}
                        </div>
                      )}
                      <div style={{ 
                        marginTop: '8px', 
                        display: 'grid', 
                        gridTemplateColumns: 'auto auto auto', 
                        columnGap: '10px', 
                        rowGap: '4px', 
                        fontSize: '0.82rem', 
                        alignItems: 'center' 
                      }}>
                        <span style={{ opacity: 0.85, fontWeight: 500 }}>Repertuvar</span>
                        <span style={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>({repPlayed}/{repTotal})</span>
                        <span style={{ opacity: 0.75 }}>- kalan {repRemaining}</span>

                        <span style={{ opacity: 0.85, fontWeight: 500 }}>İstekler</span>
                        <span style={{ fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>({reqPlayed}/{reqTotal})</span>
                        <span style={{ opacity: 0.75 }}>- kalan {reqRemaining}</span>

                        <span style={{ fontWeight: 700 }}>Toplam</span>
                        <span style={{ fontWeight: 700, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>({grandPlayed}/{grandTotal})</span>
                        <span style={{ fontWeight: 600, opacity: 0.9 }}>- kalan {grandRemaining}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="live-drawer-close-btn" 
                    onClick={() => setIsLiveDrawerOpen(false)}
                    title="Menüyü Kapat"
                  >
                    &times;
                  </button>
                </div>
              );
            })()}

            {/* INSTANT REQUEST SEARCH (AT THE VERY TOP OF DRAWER) */}
            <div className="live-stage-search-box">
              <div className="live-search-input-wrapper">
                <input 
                  type="text" 
                  placeholder="🔍 İstek bul ve hemen aç..." 
                  value={liveSearchQuery} 
                  onChange={e => searchLiveRequests(e.target.value)} 
                  className="live-stage-search-input"
                />
                {liveSearchQuery && (
                  <button 
                    type="button" 
                    className="live-search-clear-btn" 
                    onClick={() => { setLiveSearchQuery(''); setLiveSearchResults([]); }}
                    title="Temizle"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Instant Autocomplete Results */}
              {liveSearchResults.length > 0 && (
                <div className="live-stage-search-results">
                  {liveSearchResults.map(s => {
                    const hasChord = Boolean(s.ChordImagePath && s.ChordImagePath.trim());
                    return (
                      <div 
                        key={s.SongID} 
                        onClick={() => {
                          playRequestSongDirect(s);
                          setIsLiveDrawerOpen(false);
                        }}
                        className={`live-stage-search-item ${!hasChord ? 'no-chord' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>{s.SongTitle}</div>
                          {!hasChord && (
                            <span className="live-no-chord-badge">Akor Yok</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.84rem', opacity: 0.75, marginTop: '2px' }}>{s.ArtistNames || '-'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MINI SORTABLE & FILTER HEADERS (NO, ŞARKI, SANATÇI, ÇALINMAMIŞ/TÜMÜ) */}
            <div className="live-stage-list-sort-header">
              <button 
                type="button" 
                className={`live-sort-btn ${liveSortField === 'no' ? 'active' : ''}`}
                onClick={() => handleLiveSort('no')}
                title="Sıra Numarasına Göre Sırala (NO)"
              >
                NO {liveSortField === 'no' ? (liveSortOrder === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button 
                type="button" 
                className={`live-sort-btn ${liveSortField === 'sarki' ? 'active' : ''}`}
                onClick={() => handleLiveSort('sarki')}
                title="Şarkı İsmine Göre Sırala"
              >
                ŞARKI {liveSortField === 'sarki' ? (liveSortOrder === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button 
                type="button" 
                className={`live-sort-btn ${liveSortField === 'sanatci' ? 'active' : ''}`}
                onClick={() => handleLiveSort('sanatci')}
                title="Sanatçı İsmine Göre Sırala"
              >
                SANATÇI {liveSortField === 'sanatci' ? (liveSortOrder === 'asc' ? '▲' : '▼') : ''}
              </button>
              <button 
                type="button" 
                className={`live-sort-btn live-filter-btn ${liveShowUnplayedOnly ? 'active' : ''}`}
                onClick={() => setLiveShowUnplayedOnly(prev => !prev)}
                title={liveShowUnplayedOnly ? "Tüm Şarkıları Göster" : "Sadece Çalınmamış Şarkıları Göster"}
              >
                {liveShowUnplayedOnly ? 'Tümü' : 'Çalınmamış'}
              </button>
            </div>

            {/* PLAYLIST REPERTOIRE LIST */}
            <div className="live-stage-song-list">
              {(() => {
                const songsToDisplay = [...(liveGig.Songs || [])]
                  .map((song, originalIdx) => ({ song, originalIdx }))
                  .filter(({ song }) => !liveShowUnplayedOnly || !song.IsPlayed)
                  .sort((a, b) => {
                    if (liveSortField === 'no') {
                      const valA = Number(a.song.SortOrder || 0);
                      const valB = Number(b.song.SortOrder || 0);
                      return liveSortOrder === 'asc' ? valA - valB : valB - valA;
                    } else if (liveSortField === 'sarki') {
                      const valA = (a.song.SongTitle || '').toLocaleLowerCase('tr-TR');
                      const valB = (b.song.SongTitle || '').toLocaleLowerCase('tr-TR');
                      return liveSortOrder === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                    } else if (liveSortField === 'sanatci') {
                      const valA = (a.song.ArtistNames || '').toLocaleLowerCase('tr-TR');
                      const valB = (b.song.ArtistNames || '').toLocaleLowerCase('tr-TR');
                      return liveSortOrder === 'asc' ? valA.localeCompare(valB, 'tr') : valB.localeCompare(valA, 'tr');
                    }
                    return 0;
                  });

                return songsToDisplay.map(({ song: gSong, originalIdx }) => {
                  const fullSong = songs.find(s => s.SongID === gSong.SongID) || gSong;
                  const hasChord = Boolean((fullSong.ChordImagePath && fullSong.ChordImagePath.trim()) || (gSong.ChordImagePath && gSong.ChordImagePath.trim()));

                  return (
                    <div 
                      key={gSong.GigSongID || gSong.SongID || originalIdx}
                      onClick={() => {
                        setLiveSongIndex(originalIdx);
                        setLiveChordPageIndex(0);
                        setLiveTransposeShift(0);
                        setLiveViewMode('image');
                        setIsLiveDrawerOpen(false);
                      }}
                      className={`live-stage-song-item ${originalIdx === liveSongIndex ? 'active' : ''} ${!hasChord ? 'no-chord' : ''}`}
                    >
                      <div className="live-song-item-info">
                        <span className="live-song-num">{gSong.SortOrder || originalIdx + 1}.</span>
                        <div className="live-song-text">
                          <div className={`live-song-title ${gSong.IsPlayed ? 'played' : ''} ${!hasChord ? 'no-chord' : ''}`}>
                            {gSong.SongTitle}
                          </div>
                          {gSong.ArtistNames && (
                            <div className={`live-song-artist ${!hasChord ? 'no-chord' : ''}`}>
                              {gSong.ArtistNames}
                            </div>
                          )}
                        </div>
                        {!hasChord && (
                          <span className="live-no-chord-tag">Akor Yok</span>
                        )}
                        {gSong.IsRequest === 1 && (
                          <span className="live-request-tag">İstek</span>
                        )}
                      </div>

                      <div className="live-song-item-actions">
                        <button 
                          type="button"
                          className={`live-played-indicator-btn ${gSong.IsPlayed ? 'is-played' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSongPlayed(originalIdx);
                          }}
                          title={gSong.IsPlayed ? 'Çalınmadı yap' : 'Çalındı yap'}
                        >
                          {gSong.IsPlayed ? '✓' : '◯'}
                        </button>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); handleRemoveLiveSong(originalIdx); }}
                          className="live-song-del-btn"
                          title="Şarkıyı Listeden Çıkar"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
              {(!liveGig.Songs || liveGig.Songs.length === 0) && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
                  Henüz şarkı eklenmemiş. Yukarıdaki arama kutusundan şarkı arayıp ekleyebilirsiniz.
                </div>
              )}
            </div>
          </div>

          {/* MAIN 100% FULLSCREEN STAGE BODY */}
          <div 
            className="live-stage-body"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {liveSongIndex !== -1 && liveGig.Songs && liveGig.Songs[liveSongIndex] ? (() => {
              const gigSong = liveGig.Songs[liveSongIndex];
              const fullSongObj = songs.find(s => s.SongID === gigSong.SongID) || gigSong;

              // Note Transposition logic
              const origKey = fullSongObj.OriginalKey || fullSongObj.originalKey;
              let origRoot = '';
              let suffix = '';
              let origSemitone = null;

              if (origKey) {
                const match = origKey.match(/^([A-G][#b]?)(.*)$/i);
                if (match) {
                  origRoot = match[1];
                  suffix = match[2];
                  const origRootUpper = origRoot.charAt(0).toUpperCase() + origRoot.slice(1).toLowerCase();
                  origSemitone = noteToSemitone[origRootUpper];
                }
              }

              let targetScale = sharpScale;
              if (origSemitone !== null && origSemitone !== undefined) {
                let targetSemitone = (origSemitone + liveTransposeShift) % 12;
                if (targetSemitone < 0) targetSemitone += 12;
                const targetRoot = sharpScale[targetSemitone];
                targetScale = getScaleForTargetKey(targetRoot);
              }

              const htmlContent = renderTransposedTextAsHTML(fullSongObj.Lyrics, liveTransposeShift, targetScale);
              const standardScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
              const hasLyr = Boolean(fullSongObj && hasLyricsContent(fullSongObj.Lyrics));
              const hasChordImg = Boolean(fullSongObj && (fullSongObj.ChordImagePath || (Array.isArray(fullSongObj.ChordImages) && fullSongObj.ChordImages.length > 0)));

              return (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
                  
                  {liveViewMode === 'image' ? (
                    /* CHORD IMAGE FULLSCREEN VIEW */
                    (() => {
                      const chordImages = (Array.isArray(fullSongObj.ChordImages) && fullSongObj.ChordImages.length > 0)
                        ? fullSongObj.ChordImages
                        : (fullSongObj.ChordImagePath ? [fullSongObj.ChordImagePath] : []);
                      const currentChordImg = chordImages[liveChordPageIndex] || chordImages[0] || '';
                      const totalPages = chordImages.length;
                      const hasMultiplePages = totalPages > 1;

                      return (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
                          {/* Image Top Info Bar (Fixed 56px height) */}
                          <div style={{
                            height: '56px',
                            minHeight: '56px',
                            maxHeight: '56px',
                            padding: '0 1.25rem',
                            background: 'rgba(0, 0, 0, 0.75)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexShrink: 0,
                            boxSizing: 'border-box'
                          }}>
                            {/* Left: Hamburger & Counter + Song Info */}
                            <div style={{ minWidth: 0, flex: 1, paddingRight: '1rem', display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap', gap: '0.65rem' }}>
                              <button 
                                type="button" 
                                onClick={() => setIsLiveDrawerOpen(prev => !prev)}
                                style={{
                                  height: '38px',
                                  padding: '0 0.75rem',
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: 'pointer',
                                  background: 'rgba(255, 255, 255, 0.12)',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  color: '#ffffff',
                                  fontWeight: 700,
                                  fontSize: '0.88rem',
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease'
                                }}
                                title="Repertuvar Sırası (Şarkı Listesi - ☰)"
                              >
                                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>☰</span>
                                <span style={{
                                  fontSize: '0.8rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  background: 'var(--primary)',
                                  color: '#ffffff',
                                  lineHeight: 1
                                }}>
                                  {liveSongIndex !== -1 ? `${liveSongIndex + 1}/${liveGig.Songs?.length || 0}` : '0/0'}
                                </span>
                              </button>

                              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {gigSong.SongTitle}
                              </span>
                              {gigSong.ArtistNames && gigSong.ArtistNames !== '-' && (
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginLeft: '0.25rem', flexShrink: 0 }}>
                                  - {gigSong.ArtistNames}
                                </span>
                              )}
                              {origKey && <span className="orig-key-badge" style={{ marginLeft: '0.25rem', flexShrink: 0 }}>({origKey} Tonu)</span>}
                            </div>

                            {/* Right: Controls Aligned in Top Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                              {hasMultiplePages && (
                                <div 
                                  className="live-chord-multipage-badge"
                                  style={{
                                    fontFamily: "'Montserrat', sans-serif",
                                    fontSize: '20pt',
                                    height: '38px',
                                    fontWeight: 900,
                                    color: '#ef4444',
                                    lineHeight: 1,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 0.75rem',
                                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                    border: '2px solid #ef4444',
                                    borderRadius: '8px',
                                    letterSpacing: '1.5px',
                                    textShadow: '0 0 10px rgba(239, 68, 68, 0.5)',
                                    flexShrink: 0
                                  }}
                                  title={`Toplam ${totalPages} sayfa. İleri/Geri kaydırarak veya yön tuşlarıyla sayfaları gezebilirsiniz.`}
                                >
                                  {liveChordPageIndex + 1}/{totalPages}
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleSongPlayed(liveSongIndex)}
                                style={{
                                  fontFamily: "'Montserrat', sans-serif",
                                  height: '38px',
                                  minWidth: '135px',
                                  width: '135px',
                                  padding: '0 0.5rem',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  border: gigSong.IsPlayed ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.25)',
                                  background: gigSong.IsPlayed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                                  color: gigSong.IsPlayed ? '#34d399' : '#f8fafc',
                                  fontSize: '0.88rem',
                                  whiteSpace: 'nowrap',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                {gigSong.IsPlayed ? '✓ Çalındı' : '◯ Çalınmadı'}
                              </button>

                              <button 
                                type="button" 
                                onClick={() => {
                                  if (hasLyr) {
                                    setLiveViewMode('chords');
                                  } else {
                                    alert("Bu şarkının transpoze metni yoktur");
                                  }
                                }}
                                style={{
                                  height: '38px',
                                  width: '38px',
                                  minWidth: '38px',
                                  padding: 0,
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 800,
                                  fontSize: '1.05rem',
                                  cursor: 'pointer',
                                  border: hasLyr ? '1px solid #10b981' : '1px solid rgba(239, 68, 68, 0.4)',
                                  background: hasLyr ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                  color: hasLyr ? '#10b981' : '#f87171'
                                }}
                                title="Transpoze / Metin Ekranına Geç (T)"
                              >
                                T
                              </button>

                              <button 
                                type="button" 
                                onClick={closeLiveMode}
                                style={{
                                  height: '38px',
                                  width: '38px',
                                  minWidth: '38px',
                                  padding: 0,
                                  borderRadius: '8px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#f87171'
                                }}
                                title="Sahnem Ekranını Kapat (X / ESC)"
                              >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18"></line>
                                  <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Image Container with 3-Zone Click/Tap */}
                          <div 
                            className="fullscreen-chord-image-wrapper"
                            onClick={handleChordImageZoneClick}
                            style={{ position: 'relative', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
                          >
                            {currentChordImg ? (
                              <img 
                                src={getUploadsUrl(currentChordImg)} 
                                alt={`Akor Görseli Sayfa ${liveChordPageIndex + 1}`} 
                                className="fullscreen-chord-image"
                                style={{ pointerEvents: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
                                draggable="false"
                              />
                            ) : (
                              <div style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>
                                ⚠️ Bu şarkı için akor görseli bulunmuyor.<br />
                                <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)', marginTop: '0.5rem', display: 'inline-block' }}>
                                  Sağ üstteki "T" butonuna basarak transpoze metnine geçebilirsiniz.
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    /* TRANSPOSE & LYRICS FULLSCREEN VIEW */
                    <div className="fullscreen-transpose-wrapper">
                      
                      {/* Transpose Toolbar */}
                      <div className="fullscreen-transpose-toolbar" style={{ paddingLeft: '1.25rem' }}>
                        <div className="toolbar-section" style={{ paddingRight: '10px', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <button 
                            type="button" 
                            onClick={() => setIsLiveDrawerOpen(prev => !prev)}
                            style={{
                              height: '38px',
                              padding: '0 0.75rem',
                              borderRadius: '8px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              background: 'var(--surface)',
                              border: '1px solid var(--border-strong)',
                              color: 'var(--text-main)',
                              fontWeight: 700,
                              fontSize: '0.88rem',
                              flexShrink: 0,
                              transition: 'all 0.15s ease'
                            }}
                            title="Repertuvar Sırası (Şarkı Listesi - ☰)"
                          >
                            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>☰</span>
                            <span style={{
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: '6px',
                              background: 'var(--primary)',
                              color: '#ffffff',
                              lineHeight: 1
                            }}>
                              {liveSongIndex !== -1 ? `${liveSongIndex + 1}/${liveGig.Songs?.length || 0}` : '0/0'}
                            </span>
                          </button>

                          <span className="song-title-label">
                            {gigSong.SongTitle} {gigSong.ArtistNames && gigSong.ArtistNames !== '-' ? ` - ${gigSong.ArtistNames}` : ''}
                          </span>
                          {origKey && <span className="orig-key-badge">({origKey} Tonu)</span>}
                          
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <button
                              type="button"
                              onClick={() => toggleSongPlayed(liveSongIndex)}
                              style={{
                                fontFamily: "'Montserrat', sans-serif",
                                height: '38px',
                                minWidth: '135px',
                                width: '135px',
                                padding: '0 0.5rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                border: gigSong.IsPlayed ? '1px solid #10b981' : '1px solid var(--border-strong)',
                                background: gigSong.IsPlayed ? 'rgba(16, 185, 129, 0.2)' : 'var(--surface)',
                                color: gigSong.IsPlayed ? '#10b981' : 'var(--text-main)',
                                fontSize: '0.88rem',
                                whiteSpace: 'nowrap',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {gigSong.IsPlayed ? '✓ Çalındı' : '◯ Çalınmadı'}
                            </button>

                            <button 
                              type="button" 
                              onClick={() => {
                                if (hasChordImg) {
                                  setLiveViewMode('image');
                                } else {
                                  alert("Bu şarkının akor görseli yoktur");
                                }
                              }}
                              style={{
                                height: '38px',
                                width: '38px',
                                minWidth: '38px',
                                padding: 0,
                                borderRadius: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '1.05rem',
                                cursor: 'pointer',
                                border: hasChordImg ? '1px solid #10b981' : '1px solid rgba(239, 68, 68, 0.4)',
                                background: hasChordImg ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.15)',
                                color: hasChordImg ? '#10b981' : '#f87171'
                              }}
                              title="Akor Görseline Geç (A)"
                            >
                              A
                            </button>

                            <button 
                              type="button" 
                              onClick={closeLiveMode}
                              style={{
                                height: '38px',
                                width: '38px',
                                minWidth: '38px',
                                padding: 0,
                                borderRadius: '8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171'
                              }}
                              title="Sahnem Ekranını Kapat (X / ESC)"
                            >
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="toolbar-controls-row">
                          <div className="control-group">
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveTransposeShift(prev => prev - 1)}>-1 Semiton</button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveTransposeShift(prev => prev + 1)}>+1 Semiton</button>
                            <button 
                              type="button" 
                              className="btn btn-sm btn-outline btn-danger-soft" 
                              onClick={() => setLiveTransposeShift(0)}
                            >
                              Sıfırla
                            </button>
                            <span className="transpose-badge">
                              {liveTransposeShift > 0 ? `+${liveTransposeShift}` : liveTransposeShift} Semiton
                            </span>
                          </div>

                          <div className="control-group">
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveFontSize(f => Math.max(10, f - 1))}>A-</button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveFontSize(f => Math.min(36, f + 1))}>A+</button>
                            <button type="button" className="btn btn-sm btn-outline" onClick={() => setLiveTheme(t => t === 'dark' ? 'light' : 'dark')}>
                              {liveTheme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
                            </button>
                          </div>

                          <div className="control-group autofit-group">
                            <label className="checkbox-label">
                              <input 
                                type="checkbox" 
                                checked={liveIsSingleScreen} 
                                onChange={(e) => setLiveIsSingleScreen(e.target.checked)} 
                              />
                              Tek Ekran
                            </label>
                            {liveIsSingleScreen && (
                              <button 
                                type="button" 
                                className="btn btn-sm btn-outline" 
                                onClick={triggerLiveAutoFit}
                              >
                                Sığdır
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Target Key Quick Jump */}
                        {origKey && origSemitone !== null && (
                          <div className="toolbar-target-keys">
                            <span className="target-key-label">Hedef Ton:</span>
                            <div className="target-key-buttons">
                              {standardScale.map(targetRoot => {
                                const targetSemitone = noteToSemitone[targetRoot];
                                let diff = targetSemitone - origSemitone;
                                if (diff < 0) diff += 12;
                                
                                const displayName = targetRoot + suffix;
                                const isActive = (liveTransposeShift % 12 + 12) % 12 === diff;

                                return (
                                  <button
                                    key={targetRoot}
                                    type="button"
                                    className={`target-key-btn ${isActive ? 'active' : ''}`}
                                    onClick={() => setLiveTransposeShift(diff)}
                                  >
                                    {displayName}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Chord Sheet Pre Area */}
                      <div className={`fullscreen-chord-sheet-box ${liveIsSingleScreen ? 'single-screen' : ''}`}>
                        <pre 
                          ref={liveChordContentRef}
                          className={liveIsSingleScreen ? 'chord-sheet-pre-single' : 'chord-sheet-pre'}
                          style={liveIsSingleScreen ? {} : { fontSize: `${liveFontSize}px` }}
                          dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                      </div>

                    </div>
                  )}

                </div>
              );
            })() : (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '1rem', padding: '2rem', position: 'relative' }}>
                <button 
                  type="button" 
                  onClick={closeLiveMode}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    height: '38px',
                    width: '38px',
                    borderRadius: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171'
                  }}
                  title="Kapat (X / ESC)"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
                <span style={{ fontSize: '2.5rem' }}>🎙️</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sahne listenizde henüz şarkı bulunmuyor.</span>
                <button type="button" className="btn btn-primary" onClick={() => setIsLiveDrawerOpen(true)}>
                  ☰ Şarkı Listesini Aç ve İstek Ara
                </button>
              </div>
            )}
          </div>

        </div>,
        document.body
      )}

      {/* GIG NOTES POPUP MODAL */}
      {noteModalGig && createPortal(
        <div className="modal-overlay" style={{ zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setNoteModalGig(null)}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
                📝 {noteModalGig.VenueName} ({new Date(noteModalGig.GigDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}) - Notlar
              </h2>
              <button className="close-btn" onClick={() => setNoteModalGig(null)}>&times;</button>
            </div>
            <div style={{ padding: '1rem', background: 'var(--canvas)', borderRadius: '8px', fontSize: '0.95rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-main)', lineHeight: '1.5', maxHeight: '60vh', overflowY: 'auto' }}>
              {noteModalGig.Notes || 'Herhangi bir not bulunmamaktadır.'}
            </div>
            <div className="modal-actions" style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setNoteModalGig(null)}>Kapat</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FULLSCREEN IMAGE MODAL */}
      {fullscreenImage && createPortal(
        <div 
          className="modal-overlay" 
          style={{ 
            backgroundColor: 'rgba(15, 23, 42, 0.9)', 
            zIndex: 2500, 
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
    </section>
  );
}
