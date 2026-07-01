const API_BASE_URL = (typeof window !== 'undefined' && (window.location.protocol === 'file:' || window.location.port === '5173'))
  ? 'http://localhost:5000/api'
  : '/api';

async function apiRequest(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}


// In-memory lists mapped dynamically from Firestore
let requestsSortKey = 'song';
let requestsSortDirection = 'asc';
let songsSortKey = 'title';
let songsSortDirection = 'asc';
let artistsSortKey = 'name';
let artistsSortDirection = 'asc';
let guestsSortKey = 'name';
let guestsSortDirection = 'asc';
let vanillaActivePasteSection = 'profile';
let vanillaRelatedGuestIDs = [];

// Bulk Photo Processing state
let bulkSelectedPhotos = [];
let bulkSelectedGuestIds = new Set();
let bulkGuestFilter = '';
let bulkShowOnlySelected = false;

// Filter variables
let filterGuest = '';
let filterSong = '';
let filterArtist = '';
let filterStatus = '';
let filterSearch = '';

// Guest Filter variables
let filterGuestName = '';
let filterGuestNotes = '';
let filterGuestMonth = '';

// Artist Filter variables
let filterArtistName = '';

// Song Filter variables
let filterSongTitle = '';
let filterSongArtist = '';
let filterSongLyrics = '';
let filterSongMinYear = '';
let filterSongMaxYear = '';



const DB = {
  artists: [],
  songs: [],
  guests: [],
  requests: [],
  song_artists: [],

  // Load all tables and construct in-memory lists
  loadFromFirestore: async function(force = false) {
    const cacheKey = 'flymony_db_cache_vanilla';
    const cacheTimeKey = 'flymony_db_cache_vanilla_time';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 dakikalık önbellek süresi
    const isLocalhost = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    if (!force && !isLocalhost) {
      const cachedData = localStorage.getItem(cacheKey);
      const cachedTime = localStorage.getItem(cacheTimeKey);
      if (cachedData && cachedTime && (Date.now() - Number(cachedTime) < CACHE_DURATION)) {
        try {
          const parsed = JSON.parse(cachedData);
          this.artists = parsed.artists || [];
          this.guests = parsed.guests || [];
          this.songs = parsed.songs || [];
          this.song_artists = parsed.song_artists || [];
          this.requests = parsed.requests || [];
          console.log("Veriler localStorage önbelleğinden yüklendi.");
          return;
        } catch (e) {
          console.warn("Önbellek çözümlenemedi, veritabanından okunuyor...", e);
        }
      }
    }

    try {
      const [artistsList, songsList, guestsList, requestsList] = await Promise.all([
        apiRequest('/artists'),
        apiRequest('/songs'),
        apiRequest('/guests'),
        apiRequest('/requests')
      ]);

      this.artists = artistsList.map(a => ({ id: Number(a.ArtistID), name: a.ArtistName }));

      this.guests = guestsList.map(g => ({
        id: Number(g.GuestID),
        firstName: g.FirstName || "",
        lastName: g.LastName || "",
        fullName: `${g.FirstName || ""} ${g.LastName || ""}`.trim(),
        phone: g.PhoneNumber || "",
        instagram: g.InstagramLink || "",
        notes: g.Notes || "",
        profilePicture: g.ProfilePicture || "",
        birthDateDay: g.BirthDateDay || "",
        birthDateMonth: g.BirthDateMonth || "",
        birthDateYear: g.BirthDateYear || "",
        photos: g.Photos || [],
        relatedGuestIDs: (g.RelatedGuestIDs || []).map(Number),
        createdAt: g.CreatedAt || "",
        updatedAt: g.UpdatedAt || ""
      }));
      // Sort guests ascending by FirstName & LastName (Turkish locale aware)
      this.guests.sort((a, b) => {
        const fNameCompare = a.firstName.toLocaleLowerCase('tr-TR').localeCompare(b.firstName.toLocaleLowerCase('tr-TR'), 'tr');
        if (fNameCompare !== 0) return fNameCompare;
        return a.lastName.toLocaleLowerCase('tr-TR').localeCompare(b.lastName.toLocaleLowerCase('tr-TR'), 'tr');
      });

      this.songs = [];
      this.song_artists = [];
      songsList.forEach(s => {
        const songId = Number(s.SongID);
        this.songs.push({
          id: songId,
          title: s.SongTitle,
          duration: s.Duration || "",
          year: s.SongYear || "",
          lyrics: s.Lyrics || "",
          audioPath: s.AudioPath || "",
          originalKey: s.OriginalKey || "",
          chordImagePath: s.ChordImagePath || ""
        });
        const artistIds = s.ArtistIDs || [];
        artistIds.forEach(aid => {
          this.song_artists.push({ songId, artistId: Number(aid) });
        });
      });
      // Sort songs alphabetically ascending (Turkish locale aware)
      this.songs.sort((a, b) => {
        return (a.title || "").toLocaleLowerCase('tr-TR').localeCompare((b.title || "").toLocaleLowerCase('tr-TR'), 'tr');
      });

      this.requests = requestsList.map(r => ({
        id: Number(r.RequestID),
        songId: Number(r.SongID),
        guestIds: (r.GuestIDs || []).map(Number),
        guestId: (r.GuestIDs || [])[0] || null,
        date: r.RequestDate ? new Date(r.RequestDate).getTime() : Date.now(),
        status: r.Status || 'Kayıtlı',
        link: r.Link || '',
        vardi: r.Vardi ? 1 : 0,
        statusChangeDate: r.StatusChangeDate || '',
        notes: r.Notes || ''
      }));

      // Önbelleğe kaydet
      const dataToCache = {
        artists: this.artists,
        guests: this.guests,
        songs: this.songs,
        song_artists: this.song_artists,
        requests: this.requests
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
        localStorage.setItem(cacheTimeKey, Date.now().toString());
      } catch (e) {
        console.warn("LocalStorage önbelleğe kaydetme hatası:", e);
      }
    } catch (err) {
      console.error("API loading error:", err);
    }
  }
};

// Sayfa yüklendiğinde tabloları oluştur
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupMobileMenu();
  await DB.loadFromFirestore();
  renderAllTables();
  populateDropdowns();
  setupArtistSearch();
  setupDropdownFilters();
  setupVanillaGlobalPasteListener();
});

// Tab Geçişleri
function setupTabs() {
  const buttons = document.querySelectorAll('.nav-btn');
  const tabs = document.querySelectorAll('.tab-content');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      tabs.forEach(t => t.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');

      closeMobileMenu();
    });
  });
}

// Mobil hamburger menü
function closeMobileMenu() {
  const navMenu = document.getElementById('navMenu');
  const backdrop = document.getElementById('menuBackdrop');
  const toggle = document.getElementById('menuToggle');
  if (navMenu) navMenu.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  if (toggle) {
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  document.body.style.overflow = '';
}

function setupMobileMenu() {
  const navMenu = document.getElementById('navMenu');
  const backdrop = document.getElementById('menuBackdrop');
  const toggle = document.getElementById('menuToggle');
  const closeBtn = document.getElementById('mobileNavClose');
  if (!navMenu || !toggle) return;

  toggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    if (backdrop) backdrop.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    // Lock body scroll when overlay is open
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  if (backdrop) {
    backdrop.addEventListener('click', closeMobileMenu);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeMobileMenu);
  }
}

// Modal Kontrolleri
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
  if(modalId === 'songModal' || modalId === 'requestModal') {
    populateDropdowns();
  }
  if(modalId === 'guestModal') {
    populateBirthdateDropdowns();
    if (!document.getElementById('guestID')?.value) {
      vanillaRelatedGuestIDs = [];
    }
    populateVanillaGuestRelationDropdown();
    renderVanillaGuestRelationsList();
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  // Formları temizle
  const form = document.querySelector(`#${modalId} form`);
  if(form) form.reset();
  
  // Gizli ID alanlarını temizle
  const idFields = ['songID', 'artistID', 'guestID', 'requestID'];
  idFields.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });

  // Arama kutusunu ve filtrelemeyi sıfırla
  if (modalId === 'songModal') {
    const searchInput = document.getElementById('artistSearchInput');
    if (searchInput) searchInput.value = '';
    const items = document.querySelectorAll('#songArtistContainer .checkbox-item');
    items.forEach(item => item.style.display = 'flex');
    const songYear = document.getElementById('songYear');
    if (songYear) songYear.value = '';
    const songLyricsRich = document.getElementById('songLyricsRich');
    if (songLyricsRich) songLyricsRich.innerHTML = '';
    const songOriginalKey = document.getElementById('songOriginalKey');
    if (songOriginalKey) songOriginalKey.value = '';
    
    // Clear audio inputs
    const songAudioPath = document.getElementById('songAudioPath');
    if (songAudioPath) songAudioPath.value = '';
    const songAudioData = document.getElementById('songAudioData');
    if (songAudioData) songAudioData.value = '';
    const songAudioFile = document.getElementById('songAudioFile');
    if (songAudioFile) songAudioFile.value = '';
    const songAudioPreview = document.getElementById('songAudioPreview');
    if (songAudioPreview) songAudioPreview.src = '';
    const songAudioPreviewContainer = document.getElementById('songAudioPreviewContainer');
    if (songAudioPreviewContainer) songAudioPreviewContainer.style.display = 'none';
    
    // Stop recording if active
    if (typeof mediaRecorder !== 'undefined' && mediaRecorder && mediaRecorder.state !== 'inactive') {
      stopVanillaAudioRecording();
    }
  }

  // İstek formu arama kutularını, gizli girdileri ve dropdown filtrelerini sıfırla
  if (modalId === 'requestModal') {
    const guestSearch = document.getElementById('guestSearchInput');
    const songSearch = document.getElementById('songSearchInput');
    if (guestSearch) guestSearch.value = '';
    if (songSearch) songSearch.value = '';
    document.getElementById('reqGuestID').value = '';
    document.getElementById('reqSongID').value = '';
    const reqLink = document.getElementById('reqLink');
    if (reqLink) reqLink.value = '';
    const reqVardi = document.getElementById('reqVardi');
    if (reqVardi) reqVardi.checked = false;
    document.getElementById('reqStatusChangeDate').value = '';
    const displaySpan = document.getElementById('reqStatusChangeDateDisplay');
    if (displaySpan) displaySpan.innerText = '';
    populateDropdowns(); // listenin tamamını geri getir
  }

  if (modalId === 'guestModal') {
    const profPic = document.getElementById('guestProfilePicture');
    if (profPic) profPic.value = '';
    const photosInput = document.getElementById('guestPhotos');
    if (photosInput) photosInput.value = '[]';
    
    const profPreview = document.getElementById('profilePreviewInner');
    if (profPreview) {
      profPreview.className = "profile-preview-placeholder";
      profPreview.innerHTML = '<span>RESİM YOK</span>';
    }
    const galleryPreview = document.getElementById('galleryPreviewsGrid');
    if (galleryPreview) {
      galleryPreview.innerHTML = `
        <div class="gallery-empty-placeholder">
          <span>Henüz fotoğraf eklenmemiş. Anlık çekebilir veya cihazınızdan seçebilirsiniz.</span>
        </div>
      `;
    }
    vanillaRelatedGuestIDs = [];
    const relationSearch = document.getElementById('guestRelationSearch');
    if (relationSearch) relationSearch.value = '';
    const relationSelect = document.getElementById('guestRelationSelect');
    if (relationSelect) relationSelect.value = '';
  }
  
  // Başlıkları sıfırla
  if(document.getElementById('artistModalTitle')) document.getElementById('artistModalTitle').innerText = 'Yeni Sanatçı';
  if(document.getElementById('guestModalTitle')) document.getElementById('guestModalTitle').innerText = 'Yeni Misafir';
  if(document.getElementById('songModalTitle')) document.getElementById('songModalTitle').innerText = 'Yeni Şarkı';
  if(document.getElementById('requestModalTitle')) document.getElementById('requestModalTitle').innerText = 'Yeni İstek';
}

// Listbox'ları ve Checkbox'ları Doldur (Şarkılar, Sanatçılar, Misafirler)
function populateDropdowns(guestFilter = '', songFilter = '') {
  const guestListboxContainer = document.getElementById('guestListboxContainer');
  const songListboxContainer = document.getElementById('songListboxContainer');
  const songArtistContainer = document.getElementById('songArtistContainer');

  if (guestListboxContainer) {
    const filteredGuests = DB.guests.filter(g => {
      const fullName = `${g.firstName} ${g.lastName}`.toLocaleLowerCase('tr-TR');
      return fullName.includes(guestFilter.toLocaleLowerCase('tr-TR'));
    });
    
    const selectedValue = document.getElementById('reqGuestID').value;
    const selectedIDs = selectedValue ? selectedValue.split(',').map(Number) : [];

    guestListboxContainer.innerHTML = filteredGuests.map(g => `
      <div class="listbox-item ${selectedIDs.includes(g.id) ? 'selected' : ''}" data-id="${g.id}" onclick="toggleListboxItem('reqGuestID', 'guestListboxContainer', ${g.id})">
        <span>${g.firstName} ${g.lastName}</span>
        ${selectedIDs.includes(g.id) ? '<span style="font-size:0.8rem;">✓</span>' : ''}
      </div>
    `).join('') || '<div style="color:var(--text-muted);font-size:0.9rem;padding:0.5rem;">Misafir bulunamadı.</div>';
  }
  
  if (songListboxContainer) {
    const filteredSongs = DB.songs.filter(s => {
      const artistIds = DB.song_artists.filter(sa => sa.songId === s.id).map(sa => sa.artistId);
      const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ');
      const fullText = `${s.title} ${artistNames}`.toLocaleLowerCase('tr-TR');
      return fullText.includes(songFilter.toLocaleLowerCase('tr-TR'));
    });
    
    // Sort songs alphabetically ascending
    filteredSongs.sort((a, b) => {
      const artistIdsA = DB.song_artists.filter(sa => sa.songId === a.id).map(sa => sa.artistId);
      const artistNamesA = DB.artists.filter(art => artistIdsA.includes(art.id)).map(art => art.name).join(', ');
      const titleA = (a.title + (artistNamesA ? ` (${artistNamesA})` : '')).toLocaleLowerCase('tr-TR');
      
      const artistIdsB = DB.song_artists.filter(sa => sa.songId === b.id).map(sa => sa.artistId);
      const artistNamesB = DB.artists.filter(art => artistIdsB.includes(art.id)).map(art => art.name).join(', ');
      const titleB = (b.title + (artistNamesB ? ` (${artistNamesB})` : '')).toLocaleLowerCase('tr-TR');
      
      return titleA.localeCompare(titleB, 'tr');
    });
    
    const selectedID = document.getElementById('reqSongID').value;

    songListboxContainer.innerHTML = filteredSongs.map(s => {
      const artistIds = DB.song_artists.filter(sa => sa.songId === s.id).map(sa => sa.artistId);
      const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ');
      return `
        <div class="listbox-item ${selectedID == s.id ? 'selected' : ''}" data-id="${s.id}" onclick="selectListboxItem('reqSongID', 'songListboxContainer', ${s.id})">
          <span>${s.title}</span>
          <span style="font-size: 0.8rem; opacity: 0.7;">${artistNames || '-'}</span>
        </div>
      `;
    }).join('') || '<div style="color:var(--text-muted);font-size:0.9rem;padding:0.5rem;">Şarkı bulunamadı.</div>';
  }

  // Geliştirilmiş, şık checkbox listesi
  if (songArtistContainer) {
    songArtistContainer.innerHTML = DB.artists.map(a => `
      <label class="checkbox-item">
        <input type="checkbox" name="songArtists" value="${a.id}">
        <span>${a.name}</span>
      </label>
    `).join('') || '<div style="color:var(--text-muted);font-size:0.9rem;padding:0.5rem;">Önce sanatçı eklemelisiniz.</div>';
  }
}

// ----------------- ARTISTS -----------------
function renderArtists() {
  const filteredArtists = DB.artists.filter(artist => {
    if (filterArtistName) {
      const searchName = filterArtistName.toLocaleLowerCase('tr-TR');
      return (artist.name || "").toLocaleLowerCase('tr-TR').includes(searchName);
    }
    return true;
  });

  const artistsTitleEl = document.getElementById('artistsTitle');
  if (artistsTitleEl) {
    artistsTitleEl.innerText = `Sanatçılar (${filteredArtists.length})`;
  }
  const tbody = document.querySelector('#artistsTable tbody');
  tbody.innerHTML = filteredArtists.length === 0 ? '<tr><td colspan="3" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  const sortedArtists = [...filteredArtists].sort((a, b) => {
    let res = (a.name || "").toLocaleLowerCase('tr-TR').localeCompare((b.name || "").toLocaleLowerCase('tr-TR'), 'tr');
    return artistsSortDirection === 'asc' ? res : -res;
  });

  const iconEl = document.getElementById('sortIconArtistName');
  if (iconEl) {
    iconEl.innerText = artistsSortDirection === 'asc' ? ' ▲' : ' ▼';
    iconEl.style.color = 'inherit';
  }

  sortedArtists.forEach(artist => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="ID">${artist.id}</td>
      <td data-label="Sanatçı Adı">${artist.name}</td>
      <td data-label="İşlemler" class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="editArtist(${artist.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteArtist(${artist.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function saveArtist(e) {
  e.preventDefault();
  const id = document.getElementById('artistID').value;
  const name = document.getElementById('artistName').value.trim();

  if (!name) {
    alert("Sanatçı adı boş olamaz!");
    return;
  }

  const isDuplicate = DB.artists.some(a => a.id != id && a.name.trim().toLowerCase() === name.toLowerCase());
  if (isDuplicate) {
    alert("Bu isimde bir sanatçı zaten var!");
    return;
  }

  try {
    let artistId = id;
    if (id) {
      await apiRequest(`/artists/${id}`, 'PUT', { ArtistName: name });
    } else {
      const result = await apiRequest('/artists', 'POST', { ArtistName: name });
      artistId = String(result.id);
    }
    closeModal('artistModal');
    await DB.loadFromFirestore(true);
    renderAllTables();

    if (window.openedFromSongModal) {
      // Get currently checked artist IDs
      const checkedIds = Array.from(document.querySelectorAll('input[name="songArtists"]:checked')).map(cb => Number(cb.value));
      // Add the new artist ID
      checkedIds.push(Number(artistId));
      
      // Repopulate checkboxes
      populateDropdowns();
      
      // Re-check them
      const checkboxes = document.querySelectorAll('input[name="songArtists"]');
      checkboxes.forEach(cb => {
        if (checkedIds.includes(Number(cb.value))) {
          cb.checked = true;
        }
      });
      
      // Clear search input
      const searchInput = document.getElementById('artistSearchInput');
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
      
      window.openedFromSongModal = false;
    }
  } catch (err) {
    alert("Kaydetme hatası: " + err.message);
  }
}

function editArtist(id) {
  const artist = DB.artists.find(a => a.id == id);
  if (!artist) return;
  document.getElementById('artistID').value = artist.id;
  document.getElementById('artistName').value = artist.name;
  document.getElementById('artistModalTitle').innerText = 'Sanatçı Düzenle';
  openModal('artistModal');
}

async function deleteArtist(id) {
  const isLinked = DB.song_artists.some(sa => sa.artistId == id);
  if (isLinked) {
    alert("Bu sanatçı bir şarkıda kayıtlı, sanatçıyı silmek için önce ilgili şarkı kaydınız silmeniz gerekir");
    return;
  }
  if (confirm('Emin misiniz?')) {
    try {
      await apiRequest(`/artists/${id}`, 'DELETE');
      await DB.loadFromFirestore(true);
      renderAllTables();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  }
}

// ----------------- GUESTS -----------------
function renderGuests() {
  const tbody = document.querySelector('#guestsTable tbody');
  
  const sortedGuests = [...DB.guests].sort((a, b) => {
    let res = 0;
    if (guestsSortKey === 'name') {
      const fNameCompare = (a.firstName || "").toLocaleLowerCase('tr-TR').localeCompare((b.firstName || "").toLocaleLowerCase('tr-TR'), 'tr');
      if (fNameCompare !== 0) {
        res = fNameCompare;
      } else {
        res = (a.lastName || "").toLocaleLowerCase('tr-TR').localeCompare((b.lastName || "").toLocaleLowerCase('tr-TR'), 'tr');
      }
    } else if (guestsSortKey === 'birthdate') {
      const hasA = a.birthDateDay && a.birthDateMonth;
      const hasB = b.birthDateDay && b.birthDateMonth;
      if (!hasA && !hasB) return 0;
      if (!hasA) return 1;
      if (!hasB) return -1;

      if (Number(a.birthDateMonth) !== Number(b.birthDateMonth)) {
        res = Number(a.birthDateMonth) - Number(b.birthDateMonth);
      } else {
        res = Number(a.birthDateDay) - Number(b.birthDateDay);
      }
    }
    return guestsSortDirection === 'asc' ? res : -res;
  });

  // Filter guests
  const filteredGuests = sortedGuests.filter(guest => {
    // 1. Name & Surname filter
    if (filterGuestName) {
      const searchName = filterGuestName.toLocaleLowerCase('tr-TR');
      if (!(guest.fullName || '').toLocaleLowerCase('tr-TR').includes(searchName)) {
        return false;
      }
    }

    // 2. Notes filter
    if (filterGuestNotes) {
      const searchNotes = filterGuestNotes.toLocaleLowerCase('tr-TR');
      if (!(guest.notes || '').toLocaleLowerCase('tr-TR').includes(searchNotes)) {
        return false;
      }
    }

    // 3. Birth Month filter
    if (filterGuestMonth) {
      if (Number(guest.birthDateMonth) !== Number(filterGuestMonth)) {
        return false;
      }
    }

    return true;
  });

  const guestsTitleEl = document.getElementById('guestsTitle');
  if (guestsTitleEl) {
    guestsTitleEl.innerText = `Misafirler (${filteredGuests.length})`;
  }
  tbody.innerHTML = filteredGuests.length === 0 ? '<tr><td colspan="6" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';

  // Render header sorting indicators dynamically
  const keys = ['name', 'birthdate'];
  const ids = { name: 'sortIconGuestName', birthdate: 'sortIconGuestBirthdate' };
  keys.forEach(k => {
    const iconEl = document.getElementById(ids[k]);
    if (iconEl) {
      if (guestsSortKey === k) {
        iconEl.innerText = guestsSortDirection === 'asc' ? ' ▲' : ' ▼';
        iconEl.style.color = 'inherit';
      } else {
        iconEl.innerText = ' ⇅';
        iconEl.style.color = 'var(--text-muted)';
      }
    }
  });

  filteredGuests.forEach(guest => {
    // Initials Avatar
    const getInitials = (first, last) => {
      const f = first ? first.charAt(0).toUpperCase() : '';
      const l = last ? last.charAt(0).toUpperCase() : '';
      return `${f}${l}`;
    };
    
    const initials = getInitials(guest.firstName, guest.lastName);
    const avatarHtml = guest.profilePicture
      ? `<img src="${guest.profilePicture}" alt="${guest.fullName}" class="guest-avatar-img">`
      : `<div class="guest-avatar-initials">${initials}</div>`;

    // Birth Date Formatter
    const formatBirthDate = (day, month, year) => {
      if (!day || !month) return '-';
      const months = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
      ];
      const monthName = months[parseInt(month) - 1] || month;
      return year ? `${day} ${monthName} ${year}` : `${day} ${monthName}`;
    };
    const birthDateStr = formatBirthDate(guest.birthDateDay, guest.birthDateMonth, guest.birthDateYear);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Misafir" class="td-guest-profile">
        <div class="guest-profile-content">
          <div class="guest-avatar-wrapper">${avatarHtml}</div>
          <span class="guest-name-text">${guest.firstName} ${guest.lastName}</span>
        </div>
      </td>
      <td data-label="Telefon">
        ${guest.phone ? `<span style="color: var(--primary); cursor: pointer; text-decoration: underline;" onclick="openGuestContactModal(${guest.id})">${guest.phone}</span>` : '-'}
      </td>
      <td data-label="Instagram">
        ${guest.instagram ? `<a href="${guest.instagram}" target="_blank" class="instagram-link-badge">Profil</a>` : '-'}
      </td>
      <td data-label="Doğum Tarihi">${birthDateStr}</td>
      <td data-label="Notlar" class="td-notes-preview" title="${guest.notes || ''}">
        <span class="notes-text">${guest.notes || '-'}</span>
      </td>
      <td data-label="İşlemler" class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="editGuest(${guest.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteGuest(${guest.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Populate Birthdate Dropdowns in Vanilla HTML dynamically
function populateBirthdateDropdowns() {
  const daySelect = document.getElementById('guestBirthDay');
  const yearSelect = document.getElementById('guestBirthYear');
  
  if (daySelect && daySelect.options.length <= 1) {
    for (let d = 1; d <= 31; d++) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.innerText = d;
      daySelect.appendChild(opt);
    }
  }
  
  if (yearSelect && yearSelect.options.length <= 1) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1920; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.innerText = y;
      yearSelect.appendChild(opt);
    }
  }
}

// Canvas-based image compression for Vanilla JS
async function compressVanillaImage(file, maxWidth, maxHeight, quality = 0.7) {
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
}

// Vanilla HTML profile picture upload handler
async function handleVanillaProfileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const compressedBase64 = await compressVanillaImage(file, 250, 250, 0.75);
    document.getElementById('guestProfilePicture').value = compressedBase64;
    renderVanillaProfilePreview();
  } catch (err) {
    alert("Profil resmi yüklenirken hata oluştu: " + err.message);
  }
  input.value = ""; // reset file input
}

function removeVanillaProfilePicture() {
  document.getElementById('guestProfilePicture').value = "";
  renderVanillaProfilePreview();
}

function renderVanillaProfilePreview() {
  const base64 = document.getElementById('guestProfilePicture').value;
  const container = document.getElementById('profilePreviewInner');
  if (base64) {
    container.className = "profile-img-preview-wrapper";
    container.innerHTML = `
      <img src="${base64}" alt="Profil Önizleme">
      <button type="button" class="profile-img-delete-badge" onclick="removeVanillaProfilePicture()" title="Resmi Sil">&times;</button>
    `;
  } else {
    container.className = "profile-preview-placeholder";
    container.innerHTML = `<span>RESİM YOK</span>`;
  }
}

// Vanilla HTML multi-photo gallery upload handler
async function handleVanillaGalleryUpload(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  try {
    const promises = files.map(file => compressVanillaImage(file, 800, 800, 0.7));
    const compressedImages = await Promise.all(promises);
    
    const photosInput = document.getElementById('guestPhotos');
    let currentPhotos = [];
    try {
      currentPhotos = JSON.parse(photosInput.value || "[]");
    } catch(e) {
      currentPhotos = [];
    }
    
    const updatedPhotos = [...currentPhotos, ...compressedImages];
    photosInput.value = JSON.stringify(updatedPhotos);
    renderVanillaGalleryPreviews();
  } catch (err) {
    alert("Görsel yüklenirken hata oluştu: " + err.message);
  }
  input.value = ""; // reset file input
}
async function pasteVanillaProfilePicture() {
  vanillaActivePasteSection = 'profile';
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
          const compressedBase64 = await compressVanillaImage(blob, 250, 250, 0.75);
          document.getElementById('guestProfilePicture').value = compressedBase64;
          renderVanillaProfilePreview();
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
}

async function pasteVanillaGalleryPhoto() {
  vanillaActivePasteSection = 'gallery';
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
          const compressedBase64 = await compressVanillaImage(blob, 800, 800, 0.7);
          
          const photosInput = document.getElementById('guestPhotos');
          let currentPhotos = [];
          try {
            currentPhotos = JSON.parse(photosInput.value || "[]");
          } catch(e) {
            currentPhotos = [];
          }
          
          const updatedPhotos = [...currentPhotos, compressedBase64];
          photosInput.value = JSON.stringify(updatedPhotos);
          renderVanillaGalleryPreviews();
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
}

function setupVanillaGlobalPasteListener() {
  document.addEventListener('paste', async (event) => {
    const guestModal = document.getElementById('guestModal');
    const bulkPhotoPanel = document.getElementById('bulkPhotoPanel');
    const songModal = document.getElementById('songModal');
    
    const isGuestModalOpen = guestModal && guestModal.style.display !== 'none';
    const isBulkPanelVisible = bulkPhotoPanel && bulkPhotoPanel.style.display !== 'none';
    const isSongModalOpen = songModal && songModal.style.display !== 'none';
    
    if (!isGuestModalOpen && !isBulkPanelVisible && !isSongModalOpen) return;

    // Do not hijack paste event if focus is in Notes textarea, search inputs, or rich lyrics editor
    if (document.activeElement && (document.activeElement.id === 'guestNotes' || document.activeElement.id === 'bulkGuestSearchInput' || document.activeElement.id === 'songLyricsRich')) {
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
      event.preventDefault(); // prevent default paste behavior if any
      try {
        if (isGuestModalOpen) {
          if (vanillaActivePasteSection === 'profile') {
            const compressedBase64 = await compressVanillaImage(imageFile, 250, 250, 0.75);
            document.getElementById('guestProfilePicture').value = compressedBase64;
            renderVanillaProfilePreview();
          } else if (vanillaActivePasteSection === 'gallery') {
            const compressedBase64 = await compressVanillaImage(imageFile, 800, 800, 0.7);
            const photosInput = document.getElementById('guestPhotos');
            let currentPhotos = [];
            try {
              currentPhotos = JSON.parse(photosInput.value || "[]");
            } catch(e) {
              currentPhotos = [];
            }
            currentPhotos.push(compressedBase64);
            photosInput.value = JSON.stringify(currentPhotos);
            renderVanillaGalleryPreviews();
          }
        } else if (isBulkPanelVisible) {
          const compressedBase64 = await compressVanillaImage(imageFile, 800, 800, 0.7);
          bulkSelectedPhotos.push(compressedBase64);
          renderBulkPhotoPreviews();
        } else if (isSongModalOpen) {
          const compressedBase64 = await compressVanillaImage(imageFile, 1200, 1200, 0.8);
          document.getElementById('songChordImageData').value = compressedBase64;
          document.getElementById('songChordImagePath').value = ''; // clear existing path
          
          const preview = document.getElementById('songChordImagePreview');
          preview.src = URL.createObjectURL(imageFile);
          document.getElementById('songChordImagePreviewContainer').style.display = 'flex';
        }
      } catch (err) {
        alert("Görsel yapıştırılırken hata oluştu: " + err.message);
      }
    }
  });
}

function removeVanillaGalleryPhoto(index) {
  const photosInput = document.getElementById('guestPhotos');
  let currentPhotos = [];
  try {
    currentPhotos = JSON.parse(photosInput.value || "[]");
  } catch(e) {
    currentPhotos = [];
  }
  currentPhotos.splice(index, 1);
  photosInput.value = JSON.stringify(currentPhotos);
  renderVanillaGalleryPreviews();
}

function renderVanillaGalleryPreviews() {
  const photosInput = document.getElementById('guestPhotos');
  const container = document.getElementById('galleryPreviewsGrid');
  let currentPhotos = [];
  try {
    currentPhotos = JSON.parse(photosInput.value || "[]");
  } catch(e) {
    currentPhotos = [];
  }

  if (currentPhotos.length > 0) {
    container.innerHTML = currentPhotos.map((photo, index) => `
      <div class="gallery-preview-item">
        <img src="${photo}" alt="Galeri Görsel ${index + 1}">
        <button type="button" class="gallery-preview-delete-badge" onclick="removeVanillaGalleryPhoto(${index})" title="Sil">&times;</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = `
      <div class="gallery-empty-placeholder">
        <span>Henüz fotoğraf eklenmemiş. Anlık çekebilir veya cihazınızdan seçebilirsiniz.</span>
      </div>
    `;
  }
}

function populateVanillaGuestRelationDropdown() {
  const select = document.getElementById('guestRelationSelect');
  if (!select) return;

  const currentGuestId = document.getElementById('guestID').value;
  const searchQuery = (document.getElementById('guestRelationSearch')?.value || '').toLowerCase().trim();

  // Get all guests except current guest and already linked guests
  let options = DB.guests.filter(g => {
    // Exclude self
    if (currentGuestId && String(g.id) === String(currentGuestId)) return false;
    // Exclude already added relations
    if (vanillaRelatedGuestIDs.includes(Number(g.id))) return false;
    
    // Filter by search query if present
    if (searchQuery) {
      const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
      return fullName.includes(searchQuery);
    }
    return true;
  });

  // Sort options alphabetically by name
  options.sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLocaleLowerCase('tr-TR');
    const nameB = `${b.firstName} ${b.lastName}`.toLocaleLowerCase('tr-TR');
    return nameA.localeCompare(nameB, 'tr-TR');
  });

  // Re-fill select
  select.innerHTML = '<option value="">Misafir Seçin...</option>';
  options.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.firstName} ${g.lastName}`;
    select.appendChild(opt);
  });
}

function filterVanillaGuestRelations() {
  populateVanillaGuestRelationDropdown();
}

function addVanillaGuestRelation() {
  const select = document.getElementById('guestRelationSelect');
  if (!select) return;
  const guestIdVal = select.value;
  if (!guestIdVal) return;

  const guestId = Number(guestIdVal);
  if (!vanillaRelatedGuestIDs.includes(guestId)) {
    vanillaRelatedGuestIDs.push(guestId);
    // Clear search
    const searchInput = document.getElementById('guestRelationSearch');
    if (searchInput) searchInput.value = '';
    
    // Refresh UI
    renderVanillaGuestRelationsList();
    populateVanillaGuestRelationDropdown();
  }
}

function removeVanillaGuestRelation(id) {
  vanillaRelatedGuestIDs = vanillaRelatedGuestIDs.filter(gid => gid !== Number(id));
  renderVanillaGuestRelationsList();
  populateVanillaGuestRelationDropdown();
}

function renderVanillaGuestRelationsList() {
  const container = document.getElementById('guestRelationsContainer');
  if (!container) return;

  if (vanillaRelatedGuestIDs.length === 0) {
    container.innerHTML = `<div style="color: #64748b; padding: 0.5rem; text-align: center; font-size: 0.9rem;">Henüz ilişkili misafir eklenmemiş.</div>`;
    const indirectGroup = document.getElementById('guestIndirectRelationsGroup');
    if (indirectGroup) indirectGroup.style.display = 'none';
    return;
  }

  // Find the guest objects for each ID
  const relatedGuests = vanillaRelatedGuestIDs.map(id => DB.guests.find(g => Number(g.id) === Number(id))).filter(Boolean);

  // Render them as visual items with a remove badge
  container.innerHTML = relatedGuests.map(g => `
    <div style="display: inline-flex; align-items: center; background: #f1f5f9; padding: 0.25rem 0.5rem; border-radius: 6px; margin: 0.25rem; font-size: 0.9rem; border: 1px solid #e2e8f0;">
      <span>${g.firstName} ${g.lastName}</span>
      <button type="button" onclick="removeVanillaGuestRelation(${g.id})" style="border: none; background: transparent; color: #ef4444; font-size: 1.1rem; cursor: pointer; margin-left: 0.5rem; padding: 0; line-height: 1; display: flex; align-items: center;">&times;</button>
    </div>
  `).join('');

  // Calculate indirect relations
  const currentGuestId = document.getElementById('guestID').value;
  const indirectIds = new Set();
  
  vanillaRelatedGuestIDs.forEach(directId => {
    const directGuest = DB.guests.find(g => Number(g.id) === Number(directId));
    if (directGuest && directGuest.relatedGuestIDs) {
      directGuest.relatedGuestIDs.forEach(indirectId => {
        const idNum = Number(indirectId);
        // Exclude self
        if (currentGuestId && Number(currentGuestId) === idNum) return;
        // Exclude direct relations of the current guest
        if (vanillaRelatedGuestIDs.includes(idNum)) return;
        
        indirectIds.add(idNum);
      });
    }
  });

  const indirectGuests = Array.from(indirectIds).map(id => DB.guests.find(g => Number(g.id) === Number(id))).filter(Boolean);
  
  const indirectGroup = document.getElementById('guestIndirectRelationsGroup');
  const indirectContainer = document.getElementById('guestIndirectRelationsContainer');
  
  if (indirectGroup && indirectContainer) {
    if (indirectGuests.length > 0) {
      indirectGroup.style.display = 'block';
      indirectContainer.innerHTML = indirectGuests.map(g => `
        <div style="display: inline-flex; align-items: center; background: #f1f5f9; color: #64748b; padding: 0.25rem 0.5rem; border-radius: 6px; margin: 0.25rem; font-size: 0.85rem; border: 1px solid #e2e8f0; gap: 0.4rem;">
          <span>${g.firstName} ${g.lastName}</span>
          <button type="button" class="btn btn-sm btn-primary" onclick="addVanillaGuestRelationById(${g.id})" style="padding: 0 0.25rem; font-size: 0.75rem; min-height: auto; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; height: 18px; line-height: 1;">İlişki Ekle</button>
        </div>
      `).join('');
    } else {
      indirectGroup.style.display = 'none';
    }
  }
}

function cleanPhoneNumberForWhatsapp(phone) {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, ''); // strip non-numeric
  if (cleaned.length === 10 && cleaned.startsWith('5')) {
    cleaned = '90' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = '90' + cleaned.substring(1);
  }
  return cleaned;
}

function getInstagramUsername(url) {
  if (!url) return '';
  const match = url.match(/(?:instagram\.com\/|instagr\.am\/)([a-zA-Z0-9_\.]+)/i);
  return match ? match[1] : '';
}

function addVanillaGuestRelationById(guestId) {
  const id = Number(guestId);
  if (!vanillaRelatedGuestIDs.includes(id)) {
    vanillaRelatedGuestIDs.push(id);
    renderVanillaGuestRelationsList();
    populateVanillaGuestRelationDropdown();
  }
}

function openGuestContactModal(guestId) {
  const guest = DB.guests.find(g => Number(g.id) === Number(guestId));
  if (!guest || !guest.phone) return;

  const phoneClean = cleanPhoneNumberForWhatsapp(guest.phone);
  const igUsername = getInstagramUsername(guest.instagram);

  const container = document.getElementById('guestContactOptionsBody');
  if (!container) return;

  let html = `
    <div style="font-weight: bold; font-size: 1.05rem; color: #1e293b; margin-bottom: 0.75rem; text-align: center;">
      ${guest.firstName} ${guest.lastName}
    </div>
    
    <!-- Mobil Arama -->
    <a href="tel:${guest.phone}" class="btn btn-outline" style="display: flex; align-items: center; justify-content: flex-start; padding: 0.75rem 1rem; text-decoration: none; color: inherit;" onclick="closeModal('guestContactModal')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px; color: #3b82f6;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
      Mobil Arama
    </a>
    
    <!-- WhatsApp Arama -->
    <a href="whatsapp://call?phone=${phoneClean}" class="btn btn-outline" style="display: flex; align-items: center; justify-content: flex-start; padding: 0.75rem 1rem; text-decoration: none; color: inherit;" onclick="closeModal('guestContactModal')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 10px; color: #22c55e;"><path d="M12.004 2C6.51 2 2.014 6.5 2.014 12c0 2.13.67 4.13 1.81 5.79l-1.2 4.41 4.54-1.18c1.58.86 3.38 1.3 5.24 1.3 5.494 0 9.99-4.5 9.99-10S17.498 2 12.004 2zm0 1.95c4.43 0 8.04 3.61 8.04 8.05s-3.61 8.05-8.04 8.05c-1.63 0-3.19-.5-4.52-1.42l-.33-.21-2.73.71.73-2.67-.25-.37c-1.02-1.42-1.57-3.12-1.57-4.89 0-4.44 3.61-8.05 8.04-8.05zM9.474 8.01c-.18 0-.46.07-.7.33-.25.26-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.19 1.9 2.9 4.62 4.08.65.28 1.15.45 1.54.57.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.82-1.29.23-.63.23-1.18.16-1.29-.07-.11-.25-.18-.53-.32-.28-.14-1.19-.44-2.27-1.4-.84-.75-1.4-1.67-1.57-1.95-.17-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.27.28-.46.09-.18.05-.35-.02-.48-.07-.14-.61-1.48-.84-2.02-.22-.54-.45-.46-.61-.47h-.49z"/></svg>
      WhatsApp Arama
    </a>
    
    <!-- WhatsApp Mesaj -->
    <a href="https://wa.me/${phoneClean}" target="_blank" class="btn btn-outline" style="display: flex; align-items: center; justify-content: flex-start; padding: 0.75rem 1rem; text-decoration: none; color: inherit;" onclick="closeModal('guestContactModal')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 10px; color: #22c55e;"><path d="M12.004 2C6.51 2 2.014 6.5 2.014 12c0 2.13.67 4.13 1.81 5.79l-1.2 4.41 4.54-1.18c1.58.86 3.38 1.3 5.24 1.3 5.494 0 9.99-4.5 9.99-10S17.498 2 12.004 2zm0 1.95c4.43 0 8.04 3.61 8.04 8.05s-3.61 8.05-8.04 8.05c-1.63 0-3.19-.5-4.52-1.42l-.33-.21-2.73.71.73-2.67-.25-.37c-1.02-1.42-1.57-3.12-1.57-4.89 0-4.44 3.61-8.05 8.04-8.05zM9.474 8.01c-.18 0-.46.07-.7.33-.25.26-.95.93-.95 2.27 0 1.34.98 2.63 1.11 2.81.14.19 1.9 2.9 4.62 4.08.65.28 1.15.45 1.54.57.65.21 1.25.18 1.72.11.52-.08 1.6-.65 1.82-1.29.23-.63.23-1.18.16-1.29-.07-.11-.25-.18-.53-.32-.28-.14-1.19-.44-2.27-1.4-.84-.75-1.4-1.67-1.57-1.95-.17-.28-.02-.43.12-.57.13-.13.28-.32.42-.48.14-.16.19-.27.28-.46.09-.18.05-.35-.02-.48-.07-.14-.61-1.48-.84-2.02-.22-.54-.45-.46-.61-.47h-.49z"/></svg>
      WhatsApp Mesaj
    </a>
  `;

  if (guest.instagram && igUsername) {
    html += `
      <!-- Instagram DM Mesaj -->
      <a href="https://instagram.com/direct/t/${igUsername}" target="_blank" class="btn btn-outline" style="display: flex; align-items: center; justify-content: flex-start; padding: 0.75rem 1rem; text-decoration: none; color: inherit;" onclick="closeModal('guestContactModal')">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 10px; color: #ec4899;"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
        Instagram DM Mesaj
      </a>
    `;
  }

  container.innerHTML = html;
  openModal('guestContactModal');
}

async function saveGuest(e) {
  e.preventDefault();
  const id = document.getElementById('guestID').value;
  const firstName = document.getElementById('guestFirstName').value.trim();
  const lastName = document.getElementById('guestLastName').value.trim();
  const phone = document.getElementById('guestPhone').value;
  const instagram = document.getElementById('guestInstagram').value;
  const notes = document.getElementById('guestNotes').value;
  const profilePicture = document.getElementById('guestProfilePicture').value;
  const birthDay = document.getElementById('guestBirthDay').value;
  const birthMonth = document.getElementById('guestBirthMonth').value;
  const birthYear = document.getElementById('guestBirthYear').value;
  
  let photos = [];
  try {
    photos = JSON.parse(document.getElementById('guestPhotos').value || "[]");
  } catch(e) {
    photos = [];
  }

  if (!firstName || !lastName) {
    alert("Ad ve Soyad alanları boş bırakılamaz!");
    return;
  }

  // Birth date validation:
  if (birthDay || birthMonth || birthYear) {
    if (!birthDay || !birthMonth) {
      alert("Doğum tarihi giriliyorsa Gün ve Ay alanları zorunludur!");
      return;
    }
  }

  const duplicateGuest = DB.guests.find(g => g.id != id && 
    g.firstName.trim().toLowerCase() === firstName.toLowerCase() && 
    g.lastName.trim().toLowerCase() === lastName.toLowerCase()
  );
  if (duplicateGuest) {
    alert("Bu isimde bir misafir zaten kayıtlı!");
    const goToExisting = confirm("İlgili kayda gitmek ister misiniz?");
    if (goToExisting) {
      closeModal('guestModal');
      editGuest(duplicateGuest.id);
    } else {
      closeModal('guestModal');
    }
    return;
  }

  try {
    let guestId = id;
    const nowStr = new Date().toISOString();
    
    let createdAtVal = nowStr;
    if (id) {
      const existingGuest = DB.guests.find(g => g.id == id);
      if (existingGuest && existingGuest.createdAt) {
        createdAtVal = existingGuest.createdAt;
      }
    }

    const guestData = {
      FirstName: firstName,
      LastName: lastName,
      PhoneNumber: phone || "",
      InstagramLink: instagram || "",
      Notes: notes || "",
      ProfilePicture: profilePicture || "",
      BirthDateDay: birthDay ? Number(birthDay) : null,
      BirthDateMonth: birthMonth ? Number(birthMonth) : null,
      BirthDateYear: birthYear ? Number(birthYear) : null,
      Photos: photos,
      RelatedGuestIDs: vanillaRelatedGuestIDs
    };

    if (id) {
      await apiRequest(`/guests/${id}`, 'PUT', guestData);
    } else {
      const result = await apiRequest('/guests', 'POST', guestData);
      guestId = String(result.id);
    }
    closeModal('guestModal');
    await DB.loadFromFirestore(true);
    renderAllTables();

    if (window.openedFromRequestModalGuest) {
      let selectedIDs = document.getElementById('reqGuestID').value ? document.getElementById('reqGuestID').value.split(',').map(Number) : [];
      if (!selectedIDs.includes(Number(guestId))) {
        selectedIDs.push(Number(guestId));
      }
      document.getElementById('reqGuestID').value = selectedIDs.join(',');
      
      populateDropdowns();
      
      const searchInput = document.getElementById('guestSearchInput');
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
      
      window.openedFromRequestModalGuest = false;
    }
  } catch (err) {
    alert("Kaydetme hatası: " + err.message);
  }
}

function editGuest(id) {
  const guest = DB.guests.find(g => g.id == id);
  if (!guest) return;
  
  // Fill in standard inputs
  document.getElementById('guestID').value = guest.id;
  document.getElementById('guestFirstName').value = guest.firstName;
  document.getElementById('guestLastName').value = guest.lastName;
  document.getElementById('guestPhone').value = guest.phone || '';
  document.getElementById('guestInstagram').value = guest.instagram || '';
  document.getElementById('guestNotes').value = guest.notes || '';
  
  // Fill in hidden image inputs
  document.getElementById('guestProfilePicture').value = guest.profilePicture || '';
  document.getElementById('guestPhotos').value = JSON.stringify(guest.photos || []);

  // Fill dropdowns
  populateBirthdateDropdowns();
  document.getElementById('guestBirthDay').value = guest.birthDateDay || '';
  document.getElementById('guestBirthMonth').value = guest.birthDateMonth || '';
  document.getElementById('guestBirthYear').value = guest.birthDateYear || '';

  // Fill in related guest IDs
  vanillaRelatedGuestIDs = (guest.relatedGuestIDs || []).map(Number);

  // Render previews
  renderVanillaProfilePreview();
  renderVanillaGalleryPreviews();
  populateVanillaGuestRelationDropdown();
  renderVanillaGuestRelationsList();

  document.getElementById('guestModalTitle').innerText = 'Misafir Düzenle';
  openModal('guestModal');
}

async function deleteGuest(id) {
  const isLinked = DB.requests.some(r => (r.guestIds || []).includes(Number(id)));
  if (isLinked) {
    alert("Bu şarkıyı veya misafiri silmek için önce bu şarkının ve misafirin kayıtlı olduğu tüm istek kayıtlarını silmelisiniz");
    return;
  }
  if (confirm('Emin misiniz?')) {
    try {
      await apiRequest(`/guests/${id}`, 'DELETE');
      await DB.loadFromFirestore(true);
      renderAllTables();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  }
}

function hasLyricsContent(html) {
  if (!html) return false;
  const clean = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .replace(/[\s\uFEFF\xA0]+/g, '');
  return clean.length > 0;
}

// ----------------- SONGS -----------------
function renderSongs() {
  const filteredSongs = DB.songs.filter(song => {
    // 0. Song Lyrics filter (Serbest Arama - Şarkı Sözleri)
    if (filterSongLyrics) {
      const searchLyrics = filterSongLyrics.toLocaleLowerCase('tr-TR');
      if (!(song.lyrics || '').toLocaleLowerCase('tr-TR').includes(searchLyrics)) {
        return false;
      }
    }

    // 1. Song Title filter
    if (filterSongTitle) {
      const searchTitle = filterSongTitle.toLocaleLowerCase('tr-TR');
      if (!(song.title || '').toLocaleLowerCase('tr-TR').includes(searchTitle)) {
        return false;
      }
    }

    // 2. Song Artist filter
    if (filterSongArtist) {
      const searchArtist = filterSongArtist.toLocaleLowerCase('tr-TR');
      const artistIds = DB.song_artists.filter(sa => sa.songId === song.id).map(sa => sa.artistId);
      const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ').toLocaleLowerCase('tr-TR');
      if (!artistNames.includes(searchArtist)) {
        return false;
      }
    }

    // 3. Min/Max Year filters
    const songYearNum = song.year ? parseInt(song.year) : null;
    
    if (filterSongMinYear || filterSongMaxYear) {
      if (songYearNum === null || isNaN(songYearNum)) {
        return false;
      }
      if (filterSongMinYear) {
        const minVal = parseInt(filterSongMinYear);
        if (!isNaN(minVal) && songYearNum <= minVal) {
          return false;
        }
      }
      if (filterSongMaxYear) {
        const maxVal = parseInt(filterSongMaxYear);
        if (!isNaN(maxVal) && songYearNum >= maxVal) {
          return false;
        }
      }
    }

    return true;
  });

  const songsTitleEl = document.getElementById('songsTitle');
  if (songsTitleEl) {
    songsTitleEl.innerText = `Şarkılar (${filteredSongs.length})`;
  }
  const tbody = document.querySelector('#songsTable tbody');
  tbody.innerHTML = filteredSongs.length === 0 ? '<tr><td colspan="3" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  const sortedSongs = [...filteredSongs].sort((a, b) => {
    let res = 0;
    if (songsSortKey === 'title') {
      res = (a.title || "").toLocaleLowerCase('tr-TR').localeCompare((b.title || "").toLocaleLowerCase('tr-TR'), 'tr');
    } else if (songsSortKey === 'artists') {
      const artistIdsA = DB.song_artists.filter(sa => sa.songId === a.id).map(sa => sa.artistId);
      const artistNamesA = DB.artists.filter(art => artistIdsA.includes(art.id)).map(art => art.name).join(', ');
      const artistIdsB = DB.song_artists.filter(sa => sa.songId === b.id).map(sa => sa.artistId);
      const artistNamesB = DB.artists.filter(art => artistIdsB.includes(art.id)).map(art => art.name).join(', ');
      res = artistNamesA.toLocaleLowerCase('tr-TR').localeCompare(artistNamesB.toLocaleLowerCase('tr-TR'), 'tr');
    } else if (songsSortKey === 'year') {
      const yearA = a.year ? parseInt(a.year) : 0;
      const yearB = b.year ? parseInt(b.year) : 0;
      res = yearA - yearB;
    }
    return songsSortDirection === 'asc' ? res : -res;
  });

  // Render header sorting indicators dynamically
  const keys = ['title', 'artists', 'year'];
  const ids = { title: 'sortIconSongTitle', artists: 'sortIconSongArtists', year: 'sortIconSongYear' };
  keys.forEach(k => {
    const iconEl = document.getElementById(ids[k]);
    if (iconEl) {
      if (songsSortKey === k) {
        iconEl.innerText = songsSortDirection === 'asc' ? ' ▲' : ' ▼';
        iconEl.style.color = 'inherit';
      } else {
        iconEl.innerText = ' ⇅';
        iconEl.style.color = 'var(--text-muted)';
      }
    }
  });

  sortedSongs.forEach(song => {
    const artistIds = DB.song_artists.filter(sa => sa.songId === song.id).map(sa => sa.artistId);
    const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ');

    const playBtnHtml = song.audioPath 
      ? `<button type="button" class="audio-play-btn" onclick="playVanillaSongAudio(event, '${song.audioPath}', '${song.title.replace(/'/g, "\\'")}')" title="Ses Kaydını Oynat" style="background: none; border: none; cursor: pointer; padding: 0; margin-left: 0.5rem; font-size: 1.1rem; line-height: 1;">▶️</button>`
      : '';

    let songBtnHtml = '';
    const hasChord = !!song.chordImagePath;
    const hasTranspose = hasLyricsContent(song.lyrics);

    if (hasChord && hasTranspose) {
      songBtnHtml = `<button class="btn btn-sm btn-outline btn-added-style" onclick="openChordImageModal(${song.id})">A/T</button>`;
    } else if (hasChord) {
      songBtnHtml = `<button class="btn btn-sm btn-outline btn-added-style" onclick="openChordImageModal(${song.id})">Akor</button>`;
    } else if (hasTranspose) {
      songBtnHtml = `<button class="btn btn-sm btn-outline" onclick="openChordViewer(${song.id})">Trans.</button>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Şarkı Adı">
        <div class="song-title-wrapper">
          <span>${song.title}</span>
          ${playBtnHtml}
        </div>
      </td>
      <td data-label="Sanatçılar">${artistNames || '-'}</td>
      <td data-label="Yıl">${song.year || '-'}</td>
      <td data-label="İşlemler" class="action-btns">
        ${songBtnHtml}
        <button class="btn btn-sm btn-outline" onclick="editSong(${song.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSong(${song.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}


async function saveSong(e) {
  e.preventDefault();
  const id = document.getElementById('songID').value;
  const title = document.getElementById('songTitle').value.trim();
  
  const checkboxes = document.querySelectorAll('input[name="songArtists"]:checked');
  const selectedArtistIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  const yearVal = document.getElementById('songYear').value.trim();
  const lyricsVal = document.getElementById('songLyricsRich').innerHTML.trim();
  const originalKeyVal = document.getElementById('songOriginalKey').value;

  if (!title) {
    alert("Şarkı adı boş olamaz!");
    return;
  }

  const isDuplicate = DB.songs.some(s => {
    if (s.id != id) {
      const titleMatch = s.title && s.title.trim().toLowerCase() === title.toLowerCase();
      if (!titleMatch) return false;
      
      const existingArtistIDs = DB.song_artists.filter(sa => sa.songId === s.id).map(sa => sa.artistId);
      const newArtistIDs = selectedArtistIds.map(Number);
      
      if (existingArtistIDs.length === 0 && newArtistIDs.length === 0) return true;
      return newArtistIDs.some(aid => existingArtistIDs.includes(aid));
    }
    return false;
  });

  if (isDuplicate) {
    alert("Bu şarkı zaten kayıtlı!");
    return;
  }

  try {
    let songId = id;
    const audioPathVal = document.getElementById('songAudioPath').value;
    const audioDataVal = document.getElementById('songAudioData').value;
    const chordImagePathVal = document.getElementById('songChordImagePath').value;
    const chordImageDataVal = document.getElementById('songChordImageData').value;
    
    const songData = {
      SongTitle: title,
      Duration: "",
      SongYear: yearVal ? parseInt(yearVal) : null,
      Lyrics: lyricsVal || "",
      ArtistIDs: selectedArtistIds.map(Number),
      AudioPath: audioPathVal || "",
      AudioData: audioDataVal || "",
      OriginalKey: originalKeyVal || "",
      ChordImagePath: chordImagePathVal || "",
      ChordImageData: chordImageDataVal || ""
    };

    if (id) {
      await apiRequest(`/songs/${id}`, 'PUT', songData);
    } else {
      const result = await apiRequest('/songs', 'POST', songData);
      songId = String(result.id);
    }
    closeModal('songModal');
    await DB.loadFromFirestore(true);
    renderAllTables();

    if (window.openedFromRequestModalSong) {
      document.getElementById('reqSongID').value = Number(songId);
      
      populateDropdowns();
      
      const searchInput = document.getElementById('songSearchInput');
      if (searchInput) {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
      
      window.openedFromRequestModalSong = false;
    }
  } catch (err) {
    alert("Kaydetme hatası: " + err.message);
  }
}

function editSong(id) {
  const song = DB.songs.find(s => s.id == id);
  if (!song) return;
  
  document.getElementById('songID').value = song.id;
  document.getElementById('songTitle').value = song.title;
  document.getElementById('songYear').value = song.year || '';
  document.getElementById('songLyricsRich').innerHTML = song.lyrics || '';
  document.getElementById('songOriginalKey').value = song.originalKey || '';
  
  // Set audio fields
  const UPLOADS_BASE_URL = API_BASE_URL.replace('/api', '');
  document.getElementById('songAudioPath').value = song.audioPath || '';
  document.getElementById('songAudioData').value = '';
  document.getElementById('songAudioFile').value = '';
  
  const audioPreview = document.getElementById('songAudioPreview');
  const previewContainer = document.getElementById('songAudioPreviewContainer');
  
  if (song.audioPath) {
    audioPreview.src = `${UPLOADS_BASE_URL}${song.audioPath}`;
    previewContainer.style.display = 'flex';
  } else {
    audioPreview.src = '';
    previewContainer.style.display = 'none';
  }

  // Set chord image fields
  document.getElementById('songChordImagePath').value = song.chordImagePath || '';
  document.getElementById('songChordImageData').value = '';
  document.getElementById('songChordImageFile').value = '';
  
  const chordImagePreview = document.getElementById('songChordImagePreview');
  const chordPreviewContainer = document.getElementById('songChordImagePreviewContainer');
  
  if (song.chordImagePath) {
    chordImagePreview.src = `${UPLOADS_BASE_URL}${song.chordImagePath}`;
    chordPreviewContainer.style.display = 'flex';
  } else {
    chordImagePreview.src = '';
    chordPreviewContainer.style.display = 'none';
  }
  
  document.getElementById('songModalTitle').innerText = 'Şarkı Düzenle';
  openModal('songModal');
  
  const artistIds = DB.song_artists.filter(sa => sa.songId == id).map(sa => sa.artistId);
  const checkboxes = document.querySelectorAll('input[name="songArtists"]');
  checkboxes.forEach(cb => {
    cb.checked = artistIds.includes(parseInt(cb.value));
  });
}

async function deleteSong(id) {
  const isLinked = DB.requests.some(r => r.songId == id);
  if (isLinked) {
    alert("Bu şarkıyı veya misafiri silmek için önce bu şarkının ve misafirin kayıtlı olduğu tüm istek kayıtlarını silmelisiniz");
    return;
  }
  if (confirm('Emin misiniz?')) {
    try {
      await apiRequest(`/songs/${id}`, 'DELETE');
      await DB.loadFromFirestore(true);
      renderAllTables();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  }
}

// ----------------- REQUESTS -----------------
function renderRequests() {
  // Sort requests dynamically based on requestsSortKey and requestsSortDirection
  const sortedReqs = [...DB.requests].sort((a, b) => {
    let res = 0;
    if (requestsSortKey === 'date') {
      res = a.date - b.date;
    } else if (requestsSortKey === 'guest') {
      const guestIdsA = a.guestIds || (a.guestId ? [a.guestId] : []);
      const guestIdsB = b.guestIds || (b.guestId ? [b.guestId] : []);
      const guestsA = DB.guests.filter(g => guestIdsA.includes(g.id));
      const guestsB = DB.guests.filter(g => guestIdsB.includes(g.id));
      const aVal = guestsA.map(g => `${g.firstName} ${g.lastName}`).join(', ').toLocaleLowerCase('tr-TR');
      const bVal = guestsB.map(g => `${g.firstName} ${g.lastName}`).join(', ').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    } else if (requestsSortKey === 'song') {
      const songA = DB.songs.find(s => s.id == a.songId);
      const songB = DB.songs.find(s => s.id == b.songId);
      
      const artistIdsA = songA ? DB.song_artists.filter(sa => sa.songId === songA.id).map(sa => sa.artistId) : [];
      const artistNamesA = DB.artists.filter(art => artistIdsA.includes(art.id)).map(art => art.name).join(', ');
      const songDisplayA = songA ? (songA.title + (artistNamesA ? ` (${artistNamesA})` : '')) : '';
      
      const artistIdsB = songB ? DB.song_artists.filter(sa => sa.songId === songB.id).map(sa => sa.artistId) : [];
      const artistNamesB = DB.artists.filter(art => artistIdsB.includes(art.id)).map(art => art.name).join(', ');
      const songDisplayB = songB ? (songB.title + (artistNamesB ? ` (${artistNamesB})` : '')) : '';
      
      res = songDisplayA.toLocaleLowerCase('tr-TR').localeCompare(songDisplayB.toLocaleLowerCase('tr-TR'), 'tr');
    } else if (requestsSortKey === 'status') {
      const aVal = (a.status || 'Kayıtlı').toLocaleLowerCase('tr-TR');
      const bVal = (b.status || 'Kayıtlı').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    }
    return requestsSortDirection === 'asc' ? res : -res;
  });

  // Filter requests dynamically based on filter variables
  const filteredReqs = sortedReqs.filter(req => {
    const guestIds = req.guestIds || (req.guestId ? [req.guestId] : []);
    
    // 1. Guest filter
    if (filterGuest && !guestIds.includes(Number(filterGuest))) {
      return false;
    }
    
    // Get the song details for this request
    const song = DB.songs.find(s => s.id == req.songId);
    
    // 2. Song filter
    if (filterSong && req.songId !== Number(filterSong)) {
      return false;
    }
    
    // 3. Artist filter
    if (filterArtist) {
      if (!song) return false;
      const artistIds = DB.song_artists.filter(sa => sa.songId === song.id).map(sa => sa.artistId);
      if (!artistIds.includes(Number(filterArtist))) {
        return false;
      }
    }
    
    // 4. Status filter
    const statusVal = req.status || 'Kayıtlı';
    if (filterStatus && statusVal !== filterStatus) {
      return false;
    }
    
    // 5. Search query (Free text)
    if (filterSearch) {
      const searchLower = filterSearch.toLocaleLowerCase('tr-TR');
      
      const guests = DB.guests.filter(g => guestIds.includes(g.id));
      const guestNames = guests.map(g => `${g.firstName} ${g.lastName}`).join(', ').toLocaleLowerCase('tr-TR');
      
      const songTitle = song ? (song.title || '').toLocaleLowerCase('tr-TR') : '';
      
      const artistIds = song ? DB.song_artists.filter(sa => sa.songId === song.id).map(sa => sa.artistId) : [];
      const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ').toLocaleLowerCase('tr-TR');
      
      const notesTitle = (req.notes || '').toLocaleLowerCase('tr-TR');
      const guestMatch = guestNames.includes(searchLower);
      const songMatch = songTitle.includes(searchLower);
      const artistMatch = artistNames.includes(searchLower);
      const notesMatch = notesTitle.includes(searchLower);
      
      if (!guestMatch && !songMatch && !artistMatch && !notesMatch) {
        return false;
      }
    }
    
    return true;
  });

  const reqTitleEl = document.getElementById('requestsTitle');
  if (reqTitleEl) {
    reqTitleEl.innerText = `Şarkı İstekleri (${filteredReqs.length})`;
  }
  const tbody = document.querySelector('#requestsTable tbody');
  tbody.innerHTML = filteredReqs.length === 0 ? '<tr><td colspan="5" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';

  // Render header sorting indicators dynamically
  const keys = ['date', 'guest', 'song', 'status'];
  const ids = { date: 'sortIconDate', guest: 'sortIconGuest', song: 'sortIconSong', status: 'sortIconStatus' };
  keys.forEach(k => {
    const iconEl = document.getElementById(ids[k]);
    if (iconEl) {
      if (requestsSortKey === k) {
        iconEl.innerText = requestsSortDirection === 'asc' ? ' ▲' : ' ▼';
        iconEl.style.color = 'inherit';
      } else {
        iconEl.innerText = ' ⇅';
        iconEl.style.color = 'var(--text-muted)';
      }
    }
  });

  filteredReqs.forEach(req => {
    const guestIds = req.guestIds || (req.guestId ? [req.guestId] : []);
    const guests = DB.guests.filter(g => guestIds.includes(g.id));
    const song = DB.songs.find(s => s.id == req.songId);
    
    if(guests.length === 0 || !song) return; // Eksik veri varsa atla

    const guestNames = guests.map(g => `${g.firstName} ${g.lastName}`).join(', ');
    const dateStr = new Date(req.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: 'numeric' });

    // Resolve Song Artist names
    const artistIds = DB.song_artists.filter(sa => sa.songId === song.id).map(sa => sa.artistId);
    const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ');
    const songDisplay = song.title + (artistNames ? ` (${artistNames})` : '');

    // Status Badge Class
    const getStatusClass = (status) => {
      switch(status) {
        case 'Kayıtlı': return 'status-badge status-registered';
        case 'Denemede': return 'status-badge status-trial';
        case 'Eklendi': return 'status-badge status-added';
        case 'Bakalım': return 'status-badge status-existed';
        case 'İptal': return 'status-badge status-cancelled';
        default: return 'status-badge';
      }
    };
    
    const tickHtml = req.vardi ? `<span style="color: #059669; font-weight: bold; font-size: 1.2rem; margin-left: 0.35rem;" title="Vardı">✓</span>` : '';
    const statusHtml = `<div style="display: inline-flex; align-items: center;"><span class="${getStatusClass(req.status)}">${req.status || 'Kayıtlı'}</span>${tickHtml}</div>`;

    let songBtnHtml = '';
    const hasChord = !!song.chordImagePath;
    const hasTranspose = hasLyricsContent(song.lyrics);

    if (hasChord && hasTranspose) {
      songBtnHtml = `<button class="btn btn-sm btn-outline btn-added-style" onclick="openChordImageModal(${song.id})">A/T</button>`;
    } else if (hasChord) {
      songBtnHtml = `<button class="btn btn-sm btn-outline btn-added-style" onclick="openChordImageModal(${song.id})">Akor</button>`;
    } else if (hasTranspose) {
      songBtnHtml = `<button class="btn btn-sm btn-outline" onclick="openChordViewer(${song.id})">Trans.</button>`;
    } else {
      songBtnHtml = `<span style="color: #991b1b; font-weight: 600; font-size: 0.82rem; padding: 3px 6px; background: rgba(153, 27, 27, 0.1); border-radius: 4px; border: 1px solid rgba(153, 27, 27, 0.2); display: inline-flex; align-items: center; justify-content: center; height: 28px; box-sizing: border-box; white-space: nowrap;">Akor Yok</span>`;
    }

    const editSongBtnHtml = `<button class="btn btn-sm btn-outline" onclick="editSong(${song.id})">Şarkı</button>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Tarih">${dateStr}</td>
      <td data-label="Misafir">${guestNames}</td>
      <td data-label="İstenen Şarkı">
        <span class="song-title-wrapper">
          <span>${songDisplay}</span>
          ${req.link ? `<a href="${req.link}" target="_blank" class="song-link-icon" title="Şarkı Bağlantısı">🔗</a>` : ''}
        </span>
      </td>
      <td data-label="Durum">${statusHtml}</td>
      <td data-label="İşlemler" class="action-btns">
        ${songBtnHtml}
        ${editSongBtnHtml}
        <button class="btn btn-sm btn-outline" onclick="editRequest(${req.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteRequest(${req.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function sortRequests(key) {
  if (requestsSortKey === key) {
    requestsSortDirection = requestsSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    requestsSortKey = key;
    requestsSortDirection = 'asc';
  }
  renderRequests();
}

function sortSongs(key) {
  if (songsSortKey === key) {
    songsSortDirection = songsSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    songsSortKey = key;
    songsSortDirection = 'asc';
  }
  renderSongs();
}

function sortArtists(key) {
  if (artistsSortKey === key) {
    artistsSortDirection = artistsSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    artistsSortKey = key;
    artistsSortDirection = 'asc';
  }
  renderArtists();
}

function sortGuests(key) {
  if (guestsSortKey === key) {
    guestsSortDirection = guestsSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    guestsSortKey = key;
    guestsSortDirection = 'asc';
  }
  renderGuests();
}


async function saveRequest(e) {
  e.preventDefault();
  const id = document.getElementById('requestID').value;
  const guestIDsVal = document.getElementById('reqGuestID').value;
  const songId = parseInt(document.getElementById('reqSongID').value);
  const status = document.getElementById('reqStatus').value;
  const link = document.getElementById('reqLink').value.trim();

  if (!guestIDsVal) {
    alert("Lütfen en az bir misafir seçin.");
    return;
  }
  if (!songId) {
    alert("Lütfen bir şarkı seçin.");
    return;
  }

  const guestIds = guestIDsVal.split(',').map(Number);

  // Custom duplicate check: Same SongID (representing Song+Artists combo) across all requests
  const existingReq = DB.requests.find(r => r.id != id && r.songId === songId);
  if (existingReq) {
    alert("Bu istek zaten kayıtlı");
    const goToExisting = confirm("İlgili kayda gitmek ister misiniz?");
    if (goToExisting) {
      editRequest(existingReq.id);
    } else {
      closeModal('requestModal');
    }
    return;
  }

  try {
    let requestId = id;
    const reqData = {
      SongID: Number(songId),
      GuestIDs: guestIds.map(Number),
      Status: status || 'Kayıtlı',
      Link: link || '',
      Vardi: document.getElementById('reqVardi').checked ? 1 : 0,
      StatusChangeDate: document.getElementById('reqStatusChangeDate').value || null
    };

    if (id) {
      await apiRequest(`/requests/${id}`, 'PUT', reqData);
    } else {
      await apiRequest('/requests', 'POST', reqData);
    }
    closeModal('requestModal');
    await DB.loadFromFirestore(true);
    renderAllTables();
  } catch (err) {
    alert("Kaydetme hatası: " + err.message);
  }
}

async function deleteRequest(id) {
  if (confirm('Emin misiniz?')) {
    try {
      await apiRequest(`/requests/${id}`, 'DELETE');
      await DB.loadFromFirestore(true);
      renderAllTables();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  }
}

function editRequest(id) {
  const req = DB.requests.find(r => r.id == id);
  if (!req) return;

  document.getElementById('requestID').value = req.id;
  
  const guestIds = req.guestIds || (req.guestId ? [req.guestId] : []);
  document.getElementById('reqGuestID').value = guestIds.join(',');
  document.getElementById('reqSongID').value = req.songId;
  document.getElementById('reqStatus').value = req.status || 'Kayıtlı';
  document.getElementById('reqLink').value = req.link || '';
  document.getElementById('reqVardi').checked = req.vardi ? true : false;
  document.getElementById('reqStatusChangeDate').value = req.statusChangeDate || '';
  
  const displaySpan = document.getElementById('reqStatusChangeDateDisplay');
  if (displaySpan) {
    if (req.statusChangeDate) {
      const d = new Date(req.statusChangeDate);
      displaySpan.innerText = d.toLocaleString('tr-TR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } else {
      displaySpan.innerText = '';
    }
  }
 
  document.getElementById('requestModalTitle').innerText = 'İstek Düzenle';
  openModal('requestModal');

  // Şarkı listbox'ından seç
  selectListboxItem('reqSongID', 'songListboxContainer', req.songId);
  
  // Misafir listbox'ından seç
  const container = document.getElementById('guestListboxContainer');
  if (container) {
    const items = container.querySelectorAll('.listbox-item');
    items.forEach(item => {
      const gid = parseInt(item.dataset.id);
      if (guestIds.includes(gid)) {
        item.classList.add('selected');
        if (!item.querySelector('span:nth-child(2)')) {
          const checkSpan = document.createElement('span');
          checkSpan.style.fontSize = '0.8rem';
          checkSpan.innerText = '✓';
          item.appendChild(checkSpan);
        }
      } else {
        item.classList.remove('selected');
        const checkSpan = item.querySelector('span:nth-child(2)');
        if (checkSpan && checkSpan.innerText === '✓') {
          checkSpan.remove();
        }
      }
    });
  }
}

// Sidebar üzerindeki menü kayıt sayılarını güncelle
function updateSidebarCounts() {
  const reqBtn = document.querySelector('#navMenu button[data-target="requests"]');
  const songsBtn = document.querySelector('#navMenu button[data-target="songs"]');
  const artistsBtn = document.querySelector('#navMenu button[data-target="artists"]');
  const guestsBtn = document.querySelector('#navMenu button[data-target="guests"]');

  if (reqBtn) reqBtn.innerText = `İstekler (${DB.requests.length})`;
  if (songsBtn) songsBtn.innerText = `Şarkılar (${DB.songs.length})`;
  if (artistsBtn) artistsBtn.innerText = `Sanatçılar (${DB.artists.length})`;
  if (guestsBtn) guestsBtn.innerText = `Misafirler (${DB.guests.length})`;
}

// Tüm Tabloları Güncelle
function renderAllTables() {
  renderArtists();
  renderGuests();
  renderSongs();
  populateFilterDropdowns();
  renderRequests();
  updateSidebarCounts();
}

// Filtre açılır kutularını doldur
function populateFilterDropdowns() {
  const guestSelect = document.getElementById('filterGuestSelect');
  const songSelect = document.getElementById('filterSongSelect');
  const artistSelect = document.getElementById('filterArtistSelect');

  if (guestSelect) {
    const currentVal = guestSelect.value;
    
    // Sort guests alphabetically ascending
    const sortedGuests = [...DB.guests].sort((a, b) => {
      return (a.fullName || "").toLocaleLowerCase('tr-TR').localeCompare((b.fullName || "").toLocaleLowerCase('tr-TR'), 'tr');
    });
    
    guestSelect.innerHTML = '<option value="">Tüm Misafirler</option>' + 
      sortedGuests.map(g => `<option value="${g.id}">${g.firstName} ${g.lastName}</option>`).join('');
    guestSelect.value = currentVal;
  }

  if (songSelect) {
    const currentVal = songSelect.value;
    
    // Sort songs alphabetically ascending
    const sortedSongs = [...DB.songs].sort((a, b) => {
      return (a.title || "").toLocaleLowerCase('tr-TR').localeCompare((b.title || "").toLocaleLowerCase('tr-TR'), 'tr');
    });

    songSelect.innerHTML = '<option value="">Tüm Şarkılar</option>' + 
      sortedSongs.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
    songSelect.value = currentVal;
  }

  if (artistSelect) {
    const currentVal = artistSelect.value;
    
    // Sort artists alphabetically ascending
    const sortedArtists = [...DB.artists].sort((a, b) => {
      return (a.name || "").toLocaleLowerCase('tr-TR').localeCompare((b.name || "").toLocaleLowerCase('tr-TR'), 'tr');
    });

    artistSelect.innerHTML = '<option value="">Tüm Sanatçılar</option>' + 
      sortedArtists.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
    artistSelect.value = currentVal;
  }
}

// Filtre Değişim Olayı
function handleFilterChange() {
  const searchInput = document.getElementById('filterSearch');
  const guestSelect = document.getElementById('filterGuestSelect');
  const songSelect = document.getElementById('filterSongSelect');
  const artistSelect = document.getElementById('filterArtistSelect');
  const statusSelect = document.getElementById('filterStatusSelect');

  filterSearch = searchInput ? searchInput.value : '';
  filterGuest = guestSelect ? guestSelect.value : '';
  filterSong = songSelect ? songSelect.value : '';
  filterArtist = artistSelect ? artistSelect.value : '';
  filterStatus = statusSelect ? statusSelect.value : '';
  
  renderRequests();
}

// Filtreleri Temizle
function clearAllFilters() {
  const searchInput = document.getElementById('filterSearch');
  const guestSelect = document.getElementById('filterGuestSelect');
  const songSelect = document.getElementById('filterSongSelect');
  const artistSelect = document.getElementById('filterArtistSelect');
  const statusSelect = document.getElementById('filterStatusSelect');

  if (searchInput) searchInput.value = '';
  if (guestSelect) guestSelect.value = '';
  if (songSelect) songSelect.value = '';
  if (artistSelect) artistSelect.value = '';
  if (statusSelect) statusSelect.value = '';
  
  filterSearch = '';
  filterGuest = '';
  filterSong = '';
  filterArtist = '';
  filterStatus = '';
  
  renderRequests();
}

// Misafir Filtre Değişim Olayı
function handleGuestFilterChange() {
  const nameInput = document.getElementById('filterGuestName');
  const notesInput = document.getElementById('filterGuestNotes');
  const monthSelect = document.getElementById('filterGuestMonth');

  filterGuestName = nameInput ? nameInput.value : '';
  filterGuestNotes = notesInput ? notesInput.value : '';
  filterGuestMonth = monthSelect ? monthSelect.value : '';

  renderGuests();
}

// Misafir Filtrelerini Temizle
function clearAllGuestFilters() {
  const nameInput = document.getElementById('filterGuestName');
  const notesInput = document.getElementById('filterGuestNotes');
  const monthSelect = document.getElementById('filterGuestMonth');

  if (nameInput) nameInput.value = '';
  if (notesInput) notesInput.value = '';
  if (monthSelect) monthSelect.value = '';

  filterGuestName = '';
  filterGuestNotes = '';
  filterGuestMonth = '';

  renderGuests();
}

// Sanatçı Filtre Değişim Olayı
function handleArtistFilterChange() {
  const nameInput = document.getElementById('filterArtistName');
  filterArtistName = nameInput ? nameInput.value : '';
  renderArtists();
}

// Sanatçı Filtrelerini Temizle
function clearAllArtistFilters() {
  const nameInput = document.getElementById('filterArtistName');
  if (nameInput) nameInput.value = '';
  filterArtistName = '';
  renderArtists();
}

// Şarkı Filtre Değişim Olayı
function handleSongFilterChange() {
  const lyricsInput = document.getElementById('filterSongLyrics');
  const titleInput = document.getElementById('filterSongTitle');
  const artistInput = document.getElementById('filterSongArtist');
  const minYearInput = document.getElementById('filterSongMinYear');
  const maxYearInput = document.getElementById('filterSongMaxYear');

  filterSongLyrics = lyricsInput ? lyricsInput.value : '';
  filterSongTitle = titleInput ? titleInput.value : '';
  filterSongArtist = artistInput ? artistInput.value : '';
  filterSongMinYear = minYearInput ? minYearInput.value : '';
  filterSongMaxYear = maxYearInput ? maxYearInput.value : '';

  renderSongs();
}

// Şarkı Filtrelerini Temizle
function clearAllSongFilters() {
  const lyricsInput = document.getElementById('filterSongLyrics');
  const titleInput = document.getElementById('filterSongTitle');
  const artistInput = document.getElementById('filterSongArtist');
  const minYearInput = document.getElementById('filterSongMinYear');
  const maxYearInput = document.getElementById('filterSongMaxYear');

  if (lyricsInput) lyricsInput.value = '';
  if (titleInput) titleInput.value = '';
  if (artistInput) artistInput.value = '';
  if (minYearInput) minYearInput.value = '';
  if (maxYearInput) maxYearInput.value = '';

  filterSongLyrics = '';
  filterSongTitle = '';
  filterSongArtist = '';
  filterSongMinYear = '';
  filterSongMaxYear = '';

  renderSongs();
}

// Sanatçı Arama Filtresi
function setupArtistSearch() {
  const searchInput = document.getElementById('artistSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLocaleLowerCase('tr-TR');
      const items = document.querySelectorAll('#songArtistContainer .checkbox-item');
      items.forEach(item => {
        const name = item.querySelector('span').innerText.toLocaleLowerCase('tr-TR');
        if (name.includes(term)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }
}

// Dropdown Arama Filtreleri (Misafir ve Şarkı seçimi için)
function setupDropdownFilters() {
  const guestSearch = document.getElementById('guestSearchInput');
  const songSearch = document.getElementById('songSearchInput');
  
  if (guestSearch) {
    guestSearch.addEventListener('input', (e) => {
      populateDropdowns(e.target.value, songSearch ? songSearch.value : '');
    });
  }
  if (songSearch) {
    songSearch.addEventListener('input', (e) => {
      populateDropdowns(guestSearch ? guestSearch.value : '', e.target.value);
    });
  }
}

// Listbox elemanı seçildiğinde çalışacak fonksiyon (Tekli seçim)
function selectListboxItem(hiddenInputId, containerId, id) {
  const hiddenInput = document.getElementById(hiddenInputId);
  const container = document.getElementById(containerId);
  
  // Input değerini güncelle
  hiddenInput.value = id;
  
  // Görsel olarak seçili olanı vurgula
  const items = container.querySelectorAll('.listbox-item');
  items.forEach(item => {
    if (item.dataset.id == id) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

// Listbox elemanı çoklu seçildiğinde/kaldırıldığında çalışacak fonksiyon (Çoklu seçim)
function toggleListboxItem(hiddenInputId, containerId, id) {
  const hiddenInput = document.getElementById(hiddenInputId);
  const container = document.getElementById(containerId);
  
  let selectedIDs = hiddenInput.value ? hiddenInput.value.split(',').map(Number) : [];
  
  if (selectedIDs.includes(id)) {
    // Varsa çıkar
    selectedIDs = selectedIDs.filter(x => x !== id);
  } else {
    // Yoksa ekle
    selectedIDs.push(id);
  }
  
  // Input değerini güncelle
  hiddenInput.value = selectedIDs.join(',');
  
  // Sadece tıklanan öğenin görsel vurgusunu ve check işaretini toggle et (tüm listeyi bozmamak için)
  const item = container.querySelector(`.listbox-item[data-id="${id}"]`);
  if (item) {
    if (selectedIDs.includes(id)) {
      item.classList.add('selected');
      if (!item.querySelector('span:nth-child(2)')) {
        const checkSpan = document.createElement('span');
        checkSpan.style.fontSize = '0.8rem';
        checkSpan.innerText = '✓';
        item.appendChild(checkSpan);
      }
    } else {
      item.classList.remove('selected');
      const checkSpan = item.querySelector('span:nth-child(2)');
      if (checkSpan && checkSpan.innerText === '✓') {
        checkSpan.remove();
      }
    }
  }
}

function updateBulkGuestSelectionCount() {
  const el = document.getElementById('bulkGuestSelectionCount');
  if (el) {
    if (bulkSelectedGuestIds.size > 0) {
      el.innerText = ` (${bulkSelectedGuestIds.size} misafir seçildi)`;
    } else {
      el.innerText = '';
    }
  }
}

// ----------------- BULK PHOTO PROCESSING -----------------
function showBulkPhotoPanel() {
  document.getElementById('otherOperationsHome').style.display = 'none';
  document.getElementById('bulkPhotoPanel').style.display = 'block';
  
  // Clear states
  bulkSelectedPhotos = [];
  bulkSelectedGuestIds.clear();
  bulkGuestFilter = '';
  bulkShowOnlySelected = false;
  
  const toggleBtn = document.getElementById('btnBulkToggleSelected');
  if (toggleBtn) {
    toggleBtn.innerText = 'Seçilenler';
    toggleBtn.className = 'btn btn-sm btn-outline';
    toggleBtn.style.backgroundColor = '';
    toggleBtn.style.color = '';
    toggleBtn.style.borderColor = '';
  }
  
  // Reset search input
  const searchInput = document.getElementById('bulkGuestSearchInput');
  if (searchInput) searchInput.value = '';
  
  // Render views
  renderBulkPhotoPreviews();
  populateBulkGuestListbox();
  updateBulkGuestSelectionCount();
}

function showOtherOperationsHome() {
  document.getElementById('bulkPhotoPanel').style.display = 'none';
  document.getElementById('otherOperationsHome').style.display = 'block';
}

function populateBulkGuestListbox() {
  const container = document.getElementById('bulkGuestListboxContainer');
  if (!container) return;
  
  const filteredGuests = DB.guests.filter(g => {
    if (bulkShowOnlySelected && !bulkSelectedGuestIds.has(g.id)) {
      return false;
    }
    const fullName = `${g.firstName} ${g.lastName}`.toLocaleLowerCase('tr-TR');
    return fullName.includes(bulkGuestFilter.toLocaleLowerCase('tr-TR'));
  });
  
  container.innerHTML = filteredGuests.map(g => `
    <div class="listbox-item ${bulkSelectedGuestIds.has(g.id) ? 'selected' : ''}" data-id="${g.id}" onclick="toggleBulkGuestSelection(${g.id})">
      <span>${g.firstName} ${g.lastName}</span>
      ${bulkSelectedGuestIds.has(g.id) ? '<span style="font-size:0.8rem;">✓</span>' : ''}
    </div>
  `).join('') || '<div style="color:var(--text-muted);font-size:0.9rem;padding:0.5rem;">Misafir bulunamadı.</div>';
}

function toggleBulkGuestSelection(id) {
  const container = document.getElementById('bulkGuestListboxContainer');
  if (!container) return;
  
  if (bulkSelectedGuestIds.has(id)) {
    bulkSelectedGuestIds.delete(id);
  } else {
    bulkSelectedGuestIds.add(id);
  }
  
  const item = container.querySelector(`.listbox-item[data-id="${id}"]`);
  if (item) {
    if (bulkSelectedGuestIds.has(id)) {
      item.classList.add('selected');
      if (!item.querySelector('span:nth-child(2)')) {
        const checkSpan = document.createElement('span');
        checkSpan.style.fontSize = '0.8rem';
        checkSpan.innerText = '✓';
        item.appendChild(checkSpan);
      }
    } else {
      item.classList.remove('selected');
      const checkSpan = item.querySelector('span:nth-child(2)');
      if (checkSpan && checkSpan.innerText === '✓') {
        checkSpan.remove();
      }
    }
  }
  updateBulkGuestSelectionCount();
}

function handleBulkGuestSearch() {
  const searchInput = document.getElementById('bulkGuestSearchInput');
  bulkGuestFilter = searchInput ? searchInput.value : '';
  populateBulkGuestListbox();
}

function bulkSelectAllGuests() {
  const filteredGuests = DB.guests.filter(g => {
    const fullName = `${g.firstName} ${g.lastName}`.toLocaleLowerCase('tr-TR');
    return fullName.includes(bulkGuestFilter.toLocaleLowerCase('tr-TR'));
  });
  
  filteredGuests.forEach(g => bulkSelectedGuestIds.add(g.id));
  populateBulkGuestListbox();
  updateBulkGuestSelectionCount();
}

function bulkClearGuestSelection() {
  bulkSelectedGuestIds.clear();
  bulkShowOnlySelected = false;
  const toggleBtn = document.getElementById('btnBulkToggleSelected');
  if (toggleBtn) {
    toggleBtn.innerText = 'Seçilenler';
    toggleBtn.className = 'btn btn-sm btn-outline';
    toggleBtn.style.backgroundColor = '';
    toggleBtn.style.color = '';
    toggleBtn.style.borderColor = '';
  }
  populateBulkGuestListbox();
  updateBulkGuestSelectionCount();
}

function toggleBulkShowOnlySelected() {
  const btn = document.getElementById('btnBulkToggleSelected');
  if (!btn) return;
  
  bulkShowOnlySelected = !bulkShowOnlySelected;
  
  if (bulkShowOnlySelected) {
    // Clear search
    const searchInput = document.getElementById('bulkGuestSearchInput');
    if (searchInput) searchInput.value = '';
    bulkGuestFilter = '';
    
    // Change label and styling
    btn.innerText = 'Tümü';
    btn.className = 'btn btn-sm';
    btn.style.backgroundColor = 'var(--primary-color)';
    btn.style.color = '#ffffff';
    btn.style.borderColor = 'var(--primary-color)';
  } else {
    // Change label and styling
    btn.innerText = 'Seçilenler';
    btn.className = 'btn btn-sm btn-outline';
    btn.style.backgroundColor = '';
    btn.style.color = '';
    btn.style.borderColor = '';
  }
  
  populateBulkGuestListbox();
}

async function handleVanillaBulkPhotoUpload(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  try {
    const promises = files.map(file => compressVanillaImage(file, 800, 800, 0.7));
    const compressedImages = await Promise.all(promises);
    bulkSelectedPhotos = [...bulkSelectedPhotos, ...compressedImages];
    renderBulkPhotoPreviews();
  } catch (err) {
    alert("Görsel yüklenirken hata oluştu: " + err.message);
  }
  input.value = "";
}

async function pasteVanillaBulkPhoto() {
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
          const compressedBase64 = await compressVanillaImage(blob, 800, 800, 0.7);
          bulkSelectedPhotos.push(compressedBase64);
          renderBulkPhotoPreviews();
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      alert("Panoda doğrudan okunabilir bir görsel bulunamadı.\n\nEğer Windows Explorer'dan bir dosya kopyaladıysanız, lütfen bu sekme açıkken klavyenizden CTRL+V tuşlarına basarak yapıştırın!");
    }
  } catch (err) {
    alert("Doğrudan pano okuma engellendi (Güvenlik Kısıtlaması).\n\nLütfen görselinizi yapıştırmak için klavyenizden CTRL+V kısayolunu kullanın!");
  }
}

function removeVanillaBulkPhoto(index) {
  bulkSelectedPhotos.splice(index, 1);
  renderBulkPhotoPreviews();
}

function renderBulkPhotoPreviews() {
  const container = document.getElementById('bulkPhotoPreviewsGrid');
  if (!container) return;
  
  if (bulkSelectedPhotos.length > 0) {
    container.innerHTML = bulkSelectedPhotos.map((photo, index) => `
      <div class="gallery-preview-item">
        <img src="${photo}" alt="Toplu Görsel ${index + 1}">
        <button type="button" class="gallery-preview-delete-badge" onclick="removeVanillaBulkPhoto(${index})" title="Sil">&times;</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = `
      <div class="gallery-empty-placeholder">
        <span>Henüz fotoğraf eklenmemiş. Fotoğraf çekebilir, galeriden seçebilir veya panodan yapıştırabilirsiniz (CTRL+V).</span>
      </div>
    `;
  }
}

function cancelBulkPhotoProcessing() {
  if (confirm("Yapılan tüm seçimler iptal edilecektir. Emin misiniz?")) {
    showOtherOperationsHome();
  }
}

async function saveBulkPhotos() {
  if (bulkSelectedPhotos.length === 0) {
    alert("Lütfen en az bir fotoğraf ekleyin.");
    return;
  }
  if (bulkSelectedGuestIds.size === 0) {
    alert("Lütfen en az bir misafir seçin.");
    return;
  }
  
  const saveBtn = document.getElementById('btnSaveBulkPhotos');
  const originalText = saveBtn.innerText;
  saveBtn.disabled = true;
  saveBtn.innerText = "Kaydediliyor...";
  
  try {
    const savePromises = Array.from(bulkSelectedGuestIds).map(async (guestId) => {
      const guest = DB.guests.find(g => g.id == guestId);
      if (!guest) return;
      const currentPhotos = guest.photos || [];
      const updatedPhotos = [...currentPhotos, ...bulkSelectedPhotos];
      const guestData = {
        FirstName: guest.firstName,
        LastName: guest.lastName,
        PhoneNumber: guest.phone || "",
        InstagramLink: guest.instagram || "",
        Notes: guest.notes || "",
        ProfilePicture: guest.profilePicture || "",
        BirthDateDay: guest.birthDateDay ? Number(guest.birthDateDay) : null,
        BirthDateMonth: guest.birthDateMonth ? Number(guest.birthDateMonth) : null,
        BirthDateYear: guest.birthDateYear ? Number(guest.birthDateYear) : null,
        Photos: updatedPhotos
      };
      return apiRequest(`/guests/${guestId}`, 'PUT', guestData);
    });
    
    await Promise.all(savePromises);
    alert(`Fotoğraflar seçilen ${bulkSelectedGuestIds.size} misafirin albümüne başarıyla ayrı ayrı kaydedildi!`);
    
    // Clear state
    bulkSelectedPhotos = [];
    bulkSelectedGuestIds.clear();
    updateBulkGuestSelectionCount();
    
    // Reload and redraw
    await DB.loadFromFirestore(true);
    renderAllTables();
    
    // Go back to other operations home dashboard
    showOtherOperationsHome();
  } catch (err) {
    alert("Kaydetme işlemi sırasında hata oluştu: " + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = originalText;
  }
}

function openArtistModalFromSongModal() {
  window.openedFromSongModal = true;
  openModal('artistModal');
}

function openGuestModalFromRequestModal() {
  window.openedFromRequestModalGuest = true;
  openModal('guestModal');
}

function openSongModalFromRequestModal() {
  window.openedFromRequestModalSong = true;
  openModal('songModal');
}

// Bind compat functions to global window for HTML inline actions support
window.openArtistModalFromSongModal = openArtistModalFromSongModal;
window.openGuestModalFromRequestModal = openGuestModalFromRequestModal;
window.openSongModalFromRequestModal = openSongModalFromRequestModal;
window.openModal = openModal;
window.closeModal = closeModal;
window.saveArtist = saveArtist;
window.editArtist = editArtist;
window.toggleBulkShowOnlySelected = toggleBulkShowOnlySelected;
window.deleteArtist = deleteArtist;
window.saveGuest = saveGuest;
window.editGuest = editGuest;
window.deleteGuest = deleteGuest;
window.saveSong = saveSong;
window.editSong = editSong;
window.deleteSong = deleteSong;
window.saveRequest = saveRequest;
window.deleteRequest = deleteRequest;
window.editRequest = editRequest;
window.toggleListboxItem = toggleListboxItem;
window.selectListboxItem = selectListboxItem;
window.handleVanillaProfileUpload = handleVanillaProfileUpload;
window.handleVanillaGalleryUpload = handleVanillaGalleryUpload;
window.removeVanillaGalleryPhoto = removeVanillaGalleryPhoto;
window.populateBirthdateDropdowns = populateBirthdateDropdowns;
window.addVanillaGuestRelationById = addVanillaGuestRelationById;
window.openGuestContactModal = openGuestContactModal;
window.filterVanillaGuestRelations = filterVanillaGuestRelations;
window.addVanillaGuestRelation = addVanillaGuestRelation;
window.removeVanillaGuestRelation = removeVanillaGuestRelation;
window.sortRequests = sortRequests;
window.clearAllSongFilters = clearAllSongFilters;
window.handleSongFilterChange = handleSongFilterChange;
window.sortSongs = sortSongs;
window.sortArtists = sortArtists;
window.sortGuests = sortGuests;
window.pasteVanillaProfilePicture = pasteVanillaProfilePicture;
window.pasteVanillaGalleryPhoto = pasteVanillaGalleryPhoto;
window.handleFilterChange = handleFilterChange;
window.clearAllFilters = clearAllFilters;
window.populateFilterDropdowns = populateFilterDropdowns;
window.handleGuestFilterChange = handleGuestFilterChange;
window.clearAllGuestFilters = clearAllGuestFilters;
window.handleArtistFilterChange = handleArtistFilterChange;
window.clearAllArtistFilters = clearAllArtistFilters;
window.handleSongFilterChange = handleSongFilterChange;
window.clearAllSongFilters = clearAllSongFilters;
window.showBulkPhotoPanel = showBulkPhotoPanel;
window.showOtherOperationsHome = showOtherOperationsHome;
window.toggleBulkGuestSelection = toggleBulkGuestSelection;
window.handleBulkGuestSearch = handleBulkGuestSearch;
window.bulkSelectAllGuests = bulkSelectAllGuests;
window.bulkClearGuestSelection = bulkClearGuestSelection;
window.handleVanillaBulkPhotoUpload = handleVanillaBulkPhotoUpload;
window.pasteVanillaBulkPhoto = pasteVanillaBulkPhoto;
window.removeVanillaBulkPhoto = removeVanillaBulkPhoto;
window.cancelBulkPhotoProcessing = cancelBulkPhotoProcessing;
window.saveBulkPhotos = saveBulkPhotos;

// Durum Değişiklik Tarihi İşlemleri
function getLocalDatetimeString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function setReqStatusDateToNow() {
  const input = document.getElementById('statusChangeDateInput');
  if (input) {
    input.value = getLocalDatetimeString();
  }
}

function openStatusDateModal() {
  const currentVal = document.getElementById('reqStatusChangeDate').value;
  const input = document.getElementById('statusChangeDateInput');
  if (input) {
    if (currentVal) {
      const d = new Date(currentVal);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
      input.value = '';
    }
  }
  openModal('statusDateModal');
}

function saveStatusDateFromModal() {
  const input = document.getElementById('statusChangeDateInput').value;
  const hiddenInput = document.getElementById('reqStatusChangeDate');
  const displaySpan = document.getElementById('reqStatusChangeDateDisplay');
  
  if (input) {
    const d = new Date(input);
    hiddenInput.value = d.toISOString();
    displaySpan.innerText = d.toLocaleString('tr-TR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } else {
    hiddenInput.value = '';
    displaySpan.innerText = '';
  }
  closeModal('statusDateModal');
}

window.getLocalDatetimeString = getLocalDatetimeString;
window.setReqStatusDateToNow = setReqStatusDateToNow;
window.openStatusDateModal = openStatusDateModal;
window.saveStatusDateFromModal = saveStatusDateFromModal;

// ========================
// AUDIO ATTACHMENT & RECORDING
// ========================
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;

async function startVanillaAudioRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Tarayıcınız ses kaydını desteklemiyor!");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    
    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/ogg' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/mp4' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: '' };
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };
    mediaRecorder.onstop = () => {
      const mime = mediaRecorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunks, { type: mime });
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = () => {
        document.getElementById('songAudioData').value = reader.result;
        document.getElementById('songAudioPath').value = '';
        
        const preview = document.getElementById('songAudioPreview');
        preview.src = URL.createObjectURL(audioBlob);
        document.getElementById('songAudioPreviewContainer').style.display = 'flex';
      };
      
      stream.getTracks().forEach(track => track.stop());
    };
    
    mediaRecorder.start();
    
    document.getElementById('songAudioControls').style.display = 'none';
    document.getElementById('songRecordingStatus').style.display = 'flex';
    
    recordingSeconds = 0;
    document.getElementById('songRecordingTime').innerText = '00:00';
    recordingInterval = setInterval(() => {
      recordingSeconds++;
      const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
      const secs = String(recordingSeconds % 60).padStart(2, '0');
      document.getElementById('songRecordingTime').innerText = `${mins}:${secs}`;
    }, 1000);
  } catch (err) {
    alert("Mikrofon izni alınamadı veya ses kaydı başlatılamadı: " + err.message);
  }
}

function stopVanillaAudioRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  document.getElementById('songRecordingStatus').style.display = 'none';
  document.getElementById('songAudioControls').style.display = 'flex';
}

function toggleVanillaAudioRecording() {
  startVanillaAudioRecording();
}

function handleVanillaAudioUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  if (file.size > 15 * 1024 * 1024) {
    alert("Ses dosyası 15MB'tan büyük olamaz!");
    event.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    document.getElementById('songAudioData').value = reader.result;
    document.getElementById('songAudioPath').value = ''; // clear path
    
    const preview = document.getElementById('songAudioPreview');
    preview.src = URL.createObjectURL(file);
    document.getElementById('songAudioPreviewContainer').style.display = 'flex';
  };
}

function clearVanillaSongAudio() {
  document.getElementById('songAudioData').value = '';
  document.getElementById('songAudioPath').value = '';
  document.getElementById('songAudioFile').value = '';
  document.getElementById('songAudioPreview').src = '';
  document.getElementById('songAudioPreviewContainer').style.display = 'none';
}

// Global player functions
function playVanillaSongAudio(event, audioPath, songTitle) {
  if (event) event.stopPropagation();
  
  const UPLOADS_BASE_URL = API_BASE_URL.replace('/api', '');
  const player = document.getElementById('globalAudioPlayer');
  const audioElement = document.getElementById('globalAudioElement');
  const titleSpan = document.getElementById('globalAudioTitle');
  const toggleBtn = document.getElementById('globalAudioPlayToggleBtn');
  
  titleSpan.innerText = songTitle;
  titleSpan.title = songTitle;
  
  // Set source
  audioElement.src = `${UPLOADS_BASE_URL}${audioPath}`;
  player.style.display = 'flex';
  
  // Setup audio events
  audioElement.onloadedmetadata = () => {
    updateGlobalAudioTimer();
  };
  audioElement.ontimeupdate = () => {
    updateGlobalAudioTimer();
  };
  audioElement.onended = () => {
    toggleBtn.innerText = '▶';
    document.getElementById('globalAudioProgress').value = 0;
  };
  
  audioElement.play().then(() => {
    toggleBtn.innerText = '⏸';
  }).catch(err => {
    console.error("Audio playback error:", err);
  });
}

function togglePlayGlobalAudio() {
  const audioElement = document.getElementById('globalAudioElement');
  const toggleBtn = document.getElementById('globalAudioPlayToggleBtn');
  if (!audioElement) return;
  
  if (audioElement.paused) {
    audioElement.play();
    toggleBtn.innerText = '⏸';
  } else {
    audioElement.pause();
    toggleBtn.innerText = '▶';
  }
}

function seekGlobalAudio(event) {
  const audioElement = document.getElementById('globalAudioElement');
  if (audioElement && audioElement.duration) {
    const percent = event.target.value;
    audioElement.currentTime = (percent / 100) * audioElement.duration;
  }
}

function closeGlobalAudio() {
  const player = document.getElementById('globalAudioPlayer');
  const audioElement = document.getElementById('globalAudioElement');
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
  }
  if (player) {
    player.style.display = 'none';
  }
}

function updateGlobalAudioTimer() {
  const audioElement = document.getElementById('globalAudioElement');
  const progressBar = document.getElementById('globalAudioProgress');
  const timeSpan = document.getElementById('globalAudioTime');
  
  if (!audioElement || isNaN(audioElement.duration)) return;
  
  const current = audioElement.currentTime;
  const total = audioElement.duration;
  
  const currentMins = Math.floor(current / 60);
  const currentSecs = String(Math.floor(current % 60)).padStart(2, '0');
  const totalMins = Math.floor(total / 60);
  const totalSecs = String(Math.floor(total % 60)).padStart(2, '0');
  
  timeSpan.innerText = `${currentMins}:${currentSecs} / ${totalMins}:${totalSecs}`;
  progressBar.value = (current / total) * 100;
}

window.handleVanillaAudioUpload = handleVanillaAudioUpload;
window.toggleVanillaAudioRecording = toggleVanillaAudioRecording;
window.stopVanillaAudioRecording = stopVanillaAudioRecording;
window.clearVanillaSongAudio = clearVanillaSongAudio;
window.playVanillaSongAudio = playVanillaSongAudio;
window.togglePlayGlobalAudio = togglePlayGlobalAudio;
window.seekGlobalAudio = seekGlobalAudio;
window.closeGlobalAudio = closeGlobalAudio;

// ==========================================================================
// CHORD SHEET VIEWER & DYNAMIC TRANSPOSER STATE & FUNCTIONS
// ==========================================================================

let chordViewerSong = null;
let chordViewerShift = 0;
let chordViewerFontSize = 16;
let chordViewerTheme = 'dark';
let chordViewerSingleScreen = false;

const noteToSemitone = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

const sharpScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const flatScale  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function getScaleForTargetKey(targetKey) {
  if (!targetKey) return sharpScale;
  const keyUpper = targetKey.toUpperCase();
  if (['F', 'BB', 'EB', 'AB', 'DB', 'GB', 'Fm', 'Bbm', 'Ebm', 'Abm', 'Dbm', 'Gbm'].some(k => keyUpper.startsWith(k))) {
    return flatScale;
  }
  return sharpScale;
}

function isChord(token) {
  const chordTokenRegex = /^[A-G][#b]?(?:maj|min|m|sus|add|dim|aug|alt|omit|[0-9]|\+|-|b|#)*(?:\/[A-G][#b]?(?:maj|min|m|sus|add|dim|aug|alt|omit|[0-9]|\+|-|b|#)*)?$/;
  return chordTokenRegex.test(token);
}

function transposeNote(note, semitones, targetScale = sharpScale) {
  const firstChar = note.charAt(0).toUpperCase();
  const rest = note.slice(1);
  const normalizedNote = firstChar + rest;
  
  const semitone = noteToSemitone[normalizedNote];
  if (semitone === undefined) return note;
  
  let newSemitone = (semitone + semitones) % 12;
  if (newSemitone < 0) newSemitone += 12;
  
  return targetScale[newSemitone];
}

function transposeChord(chord, semitones, targetScale = sharpScale) {
  return chord.split('/').map(part => {
    const match = part.match(/^([A-G][#b]?)(.*)$/i);
    if (!match) return part;
    
    const root = match[1];
    const suffix = match[2];
    
    const transposedRoot = transposeNote(root, semitones, targetScale);
    return transposedRoot + suffix;
  }).join('/');
}

// Check if DOM element is colored red (designates a chord)
function isElementRed(el) {
  if (!el || el.nodeType !== 1) return false;
  
  const styleColor = el.style.color;
  if (styleColor) {
    const cleanColor = styleColor.replace(/\s+/g, '').toLowerCase();
    if (cleanColor === 'red' || cleanColor === '#ff0000' || cleanColor === '#f00' || cleanColor.includes('rgb(255,0,0)')) {
      return true;
    }
  }
  
  if (el.tagName.toLowerCase() === 'font') {
    const fontColor = el.getAttribute('color');
    if (fontColor) {
      const cleanFontColor = fontColor.replace(/\s+/g, '').toLowerCase();
      if (cleanFontColor === 'red' || cleanFontColor === '#ff0000' || cleanFontColor === '#f00' || cleanFontColor.includes('rgb(255,0,0)')) {
        return true;
      }
    }
  }
  
  return false;
}

// Recursively traverse leaf text nodes and transpose chords inside them
function transposeLeafTextNodes(node, semitones, targetScale) {
  if (node.nodeType === 3) { // Node.TEXT_NODE
    const text = node.nodeValue;
    const transposed = text.replace(/[A-G][#b]?(?:maj|min|m|sus|add|dim|aug|alt|omit|[0-9]|\+|-|b|#)*(?:\/[A-G][#b]?(?:maj|min|m|sus|add|dim|aug|alt|omit|[0-9]|\+|-|b|#)*)?/g, (match) => {
      if (isChord(match)) {
        return transposeChord(match, semitones, targetScale);
      }
      return match;
    });
    node.nodeValue = transposed;
  } else {
    node.childNodes.forEach(child => transposeLeafTextNodes(child, semitones, targetScale));
  }
}

// Find red elements and transpose them
function traverseAndTranspose(node, semitones, targetScale) {
  if (node.nodeType === 1) { // Node.ELEMENT_NODE
    if (isElementRed(node)) {
      transposeLeafTextNodes(node, semitones, targetScale);
      return;
    }
  }
  node.childNodes.forEach(child => traverseAndTranspose(child, semitones, targetScale));
}

function renderTransposedTextAsHTML(htmlText, semitones, targetScale = sharpScale) {
  if (!htmlText) return '<div style="color:var(--text-muted); text-align:center; padding: 2rem;">Bu şarkı için henüz akor/not girilmemiş. Düzenle butonundan ekleyebilirsiniz.</div>';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  
  if (semitones !== 0) {
    traverseAndTranspose(doc.body, semitones, targetScale);
  }
  
  return doc.body.innerHTML;
}

function execEditorCommand(command, value = null) {
  document.execCommand(command, false, value);
}

function openChordViewer(songId) {
  const song = DB.songs.find(s => s.id == songId);
  if (!song) return;

  chordViewerSong = song;
  chordViewerShift = 0;
  
  // Set title and details
  const artistIds = DB.song_artists.filter(sa => sa.songId == song.id).map(sa => sa.artistId);
  const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ');
  const titleDisplay = song.title + (artistNames ? ` - ${artistNames}` : '') + (song.originalKey ? ` (${song.originalKey} Tonu)` : '');
  
  document.getElementById('chordViewerSongTitle').innerText = titleDisplay;
  document.getElementById('transposeOffsetDisplay').innerText = '0 Semiton';
  
  // Reset single screen mode
  chordViewerSingleScreen = false;
  const singleScreenCheckbox = document.getElementById('chordViewerSingleScreen');
  if (singleScreenCheckbox) singleScreenCheckbox.checked = false;
  
  const container = document.getElementById('chordViewerContainer');
  const pre = document.getElementById('chordViewerContent');
  const autoFitBtn = document.getElementById('chordViewerAutoFitBtn');
  if (container) container.classList.remove('chord-sheet-container-single');
  if (pre) pre.classList.remove('chord-sheet-pre-single');
  if (autoFitBtn) autoFitBtn.style.display = 'none';

  // Initialize font size style
  pre.style.fontSize = chordViewerFontSize + 'px';
  
  // Update the toggle button style for "A" (Akor Görseli)
  const toggleBtn = document.getElementById('vanillaChordViewerToggleBtn');
  if (toggleBtn) {
    if (song.chordImagePath) {
      toggleBtn.className = 'vanilla-viewer-btn-float btn-status-success';
    } else {
      toggleBtn.className = 'vanilla-viewer-btn-float btn-status-danger';
    }
  }

  updateChordViewerContent();
  document.getElementById('chordViewerModal').style.display = 'flex';
}

function closeChordViewer() {
  document.getElementById('chordViewerModal').style.display = 'none';
  chordViewerSong = null;
}

function updateChordViewerContent() {
  if (!chordViewerSong) return;
  
  // Determine target scale
  let targetScale = sharpScale;
  if (chordViewerSong.originalKey) {
    const origKey = chordViewerSong.originalKey;
    const match = origKey.match(/^([A-G][#b]?)(.*)$/i);
    if (match) {
      const origRoot = match[1];
      const origRootUpper = origRoot.charAt(0).toUpperCase() + origRoot.slice(1).toLowerCase();
      const origSemitone = noteToSemitone[origRootUpper];
      
      let targetSemitone = (origSemitone + chordViewerShift) % 12;
      if (targetSemitone < 0) targetSemitone += 12;
      const targetRoot = sharpScale[targetSemitone];
      targetScale = getScaleForTargetKey(targetRoot);
    }
  }

  const htmlContent = renderTransposedTextAsHTML(chordViewerSong.lyrics, chordViewerShift, targetScale);
  document.getElementById('chordViewerContent').innerHTML = htmlContent;
  
  drawTransposeKeyButtons();
  
  // If single screen mode is active, trigger auto fit after layout reflow
  if (chordViewerSingleScreen) {
    setTimeout(triggerAutoFit, 50);
  }
}

function drawTransposeKeyButtons() {
  const container = document.getElementById('transposeKeyButtons');
  container.innerHTML = '';
  
  if (!chordViewerSong || !chordViewerSong.originalKey) {
    document.getElementById('transposeKeyRow').style.display = 'none';
    return;
  }
  
  document.getElementById('transposeKeyRow').style.display = 'flex';
  
  const origKey = chordViewerSong.originalKey;
  const match = origKey.match(/^([A-G][#b]?)(.*)$/i);
  if (!match) return;
  const origRoot = match[1];
  const suffix = match[2];
  
  const origRootUpper = origRoot.charAt(0).toUpperCase() + origRoot.slice(1).toLowerCase();
  const origSemitone = noteToSemitone[origRootUpper];
  if (origSemitone === undefined) return;
  
  const standardScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  standardScale.forEach(targetRoot => {
    const targetSemitone = noteToSemitone[targetRoot];
    
    let diff = targetSemitone - origSemitone;
    if (diff < 0) diff += 12;
    
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'transpose-btn';
    
    const displayName = targetRoot + suffix;
    btn.innerText = displayName;
    
    let normalizedShift = chordViewerShift % 12;
    if (normalizedShift < 0) normalizedShift += 12;
    if (diff === normalizedShift) {
      btn.classList.add('active');
    }
    
    btn.onclick = () => {
      chordViewerShift = diff;
      document.getElementById('transposeOffsetDisplay').innerText = (chordViewerShift > 0 ? '+' : '') + chordViewerShift + ' Semiton';
      updateChordViewerContent();
    };
    
    container.appendChild(btn);
  });
}

function changeTransposeSemitones(delta) {
  chordViewerShift = chordViewerShift + delta;
  document.getElementById('transposeOffsetDisplay').innerText = (chordViewerShift > 0 ? '+' : '') + chordViewerShift + ' Semiton';
  updateChordViewerContent();
}

// Single screen layout triggers
function toggleSingleScreenMode(checked) {
  chordViewerSingleScreen = checked;
  const container = document.getElementById('chordViewerContainer');
  const pre = document.getElementById('chordViewerContent');
  const autoFitBtn = document.getElementById('chordViewerAutoFitBtn');
  
  if (checked) {
    container.classList.add('chord-sheet-container-single');
    pre.classList.add('chord-sheet-pre-single');
    if (autoFitBtn) autoFitBtn.style.display = 'inline-block';
    
    // Automatically trigger fit to screen when entering this mode
    setTimeout(triggerAutoFit, 100);
  } else {
    container.classList.remove('chord-sheet-container-single');
    pre.classList.remove('chord-sheet-pre-single');
    if (autoFitBtn) autoFitBtn.style.display = 'none';
    
    // Reset font size to standard chordViewerFontSize
    pre.style.fontSize = chordViewerFontSize + 'px';
  }
}

function triggerAutoFit() {
  const pre = document.getElementById('chordViewerContent');
  if (!pre) return;
  
  let fontSize = 24; // Start normal
  pre.style.fontSize = fontSize + 'px';
  
  const maxIterations = 50;
  let iterations = 0;
  
  // Decrease font size until there is no vertical/horizontal scrollbar, or font size is too small
  while ((pre.scrollWidth > pre.clientWidth || pre.scrollHeight > pre.clientHeight) && fontSize > 8 && iterations < maxIterations) {
    fontSize--;
    pre.style.fontSize = fontSize + 'px';
    iterations++;
  }
}

function resetTranspose() {
  chordViewerShift = 0;
  document.getElementById('transposeOffsetDisplay').innerText = '0 Semiton';
  updateChordViewerContent();
}

function adjustFontSize(delta) {
  chordViewerFontSize = Math.max(10, Math.min(32, chordViewerFontSize + delta));
  if (!chordViewerSingleScreen) {
    document.getElementById('chordViewerContent').style.fontSize = chordViewerFontSize + 'px';
  }
}

function toggleChordViewerTheme() {
  const label = document.getElementById('chordViewerThemeLabel');
  const container = document.getElementById('chordViewerContainer');
  
  if (chordViewerTheme === 'dark') {
    chordViewerTheme = 'light';
    label.innerText = 'Açık';
    container.classList.add('chord-sheet-light');
  } else {
    chordViewerTheme = 'dark';
    label.innerText = 'Koyu';
    container.classList.remove('chord-sheet-light');
  }
}

// Chord Image Upload, Paste and View Functions
async function handleVanillaChordImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const compressedBase64 = await compressVanillaImage(file, 1200, 1200, 0.8);
    document.getElementById('songChordImageData').value = compressedBase64;
    document.getElementById('songChordImagePath').value = ''; // clear path
    
    const preview = document.getElementById('songChordImagePreview');
    preview.src = URL.createObjectURL(file);
    document.getElementById('songChordImagePreviewContainer').style.display = 'flex';
  } catch (err) {
    alert("Akor görseli yüklenirken hata oluştu: " + err.message);
  }
}

async function pasteVanillaChordImage() {
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
          const compressedBase64 = await compressVanillaImage(blob, 1200, 1200, 0.8);
          document.getElementById('songChordImageData').value = compressedBase64;
          document.getElementById('songChordImagePath').value = ''; // clear path
          
          const preview = document.getElementById('songChordImagePreview');
          preview.src = URL.createObjectURL(blob);
          document.getElementById('songChordImagePreviewContainer').style.display = 'flex';
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) {
      alert("Panoda doğrudan okunabilir bir görsel bulunamadı.\n\nEğer bir dosya kopyaladıysanız, lütfen modal açıkken klavyenizden CTRL+V tuşlarına basarak yapıştırın!");
    }
  } catch (err) {
    alert("Doğrudan pano okuma engellendi (Güvenlik Kısıtlaması).\n\nLütfen görselinizi yapıştırmak için klavyenizden CTRL+V kısayolunu kullanın!");
  }
}

function clearVanillaSongChordImage() {
  document.getElementById('songChordImageData').value = '';
  document.getElementById('songChordImagePath').value = '';
  document.getElementById('songChordImageFile').value = '';
  document.getElementById('songChordImagePreview').src = '';
  document.getElementById('songChordImagePreviewContainer').style.display = 'none';
}

function openChordImageModal(songId) {
  const song = DB.songs.find(s => s.id == songId);
  if (!song || !song.chordImagePath) return;

  chordViewerSong = song; // set it!

  // Update the toggle button style for "T" (Transpoze)
  const toggleBtn = document.getElementById('vanillaChordImageToggleBtn');
  if (toggleBtn) {
    if (hasLyricsContent(song.lyrics)) {
      toggleBtn.className = 'vanilla-viewer-btn-float btn-status-success';
    } else {
      toggleBtn.className = 'vanilla-viewer-btn-float btn-status-danger';
    }
  }

  const UPLOADS_BASE_URL = API_BASE_URL.replace('/api', '');
  const modal = document.getElementById('chordImageModal');
  const img = document.getElementById('chordImageModalImg');
  const title = document.getElementById('chordImageModalTitle');

  // Find artist names to show in the title
  const artistIds = DB.song_artists.filter(sa => sa.songId === song.id).map(sa => sa.artistId);
  const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ');

  title.innerText = `${song.title} ${artistNames ? ` - ${artistNames}` : ''}`;
  img.src = `${UPLOADS_BASE_URL}${song.chordImagePath}`;
  modal.style.display = 'flex';
}

function closeChordImageModal() {
  const modal = document.getElementById('chordImageModal');
  const img = document.getElementById('chordImageModalImg');
  if (modal) modal.style.display = 'none';
  if (img) img.src = '';
}

function toggleVanillaViewerMode() {
  if (!chordViewerSong) return;
  const isChordViewerOpen = document.getElementById('chordViewerModal').style.display === 'flex';
  if (isChordViewerOpen) {
    if (chordViewerSong.chordImagePath) {
      closeChordViewer();
      openChordImageModal(chordViewerSong.id);
    } else {
      alert("Bu şarkının akor görseli yoktur");
    }
  } else {
    if (hasLyricsContent(chordViewerSong.lyrics)) {
      closeChordImageModal();
      openChordViewer(chordViewerSong.id);
    } else {
      alert("Bu şarkının transpoze bilgisi yoktur");
    }
  }
}

// Window Exports
window.openChordViewer = openChordViewer;
window.closeChordViewer = closeChordViewer;
window.changeTransposeSemitones = changeTransposeSemitones;
window.resetTranspose = resetTranspose;
window.adjustFontSize = adjustFontSize;
window.toggleChordViewerTheme = toggleChordViewerTheme;
window.execEditorCommand = execEditorCommand;
window.toggleSingleScreenMode = toggleSingleScreenMode;
window.triggerAutoFit = triggerAutoFit;
window.handleVanillaChordImageUpload = handleVanillaChordImageUpload;
window.pasteVanillaChordImage = pasteVanillaChordImage;
window.clearVanillaSongChordImage = clearVanillaSongChordImage;
window.openChordImageModal = openChordImageModal;
window.closeChordImageModal = closeChordImageModal;
window.toggleVanillaViewerMode = toggleVanillaViewerMode;


