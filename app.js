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

// Bulk Photo Processing state
let bulkSelectedPhotos = [];
let bulkSelectedGuestIds = new Set();
let bulkGuestFilter = '';

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



const DB = {
  artists: [],
  songs: [],
  guests: [],
  requests: [],
  song_artists: [],

  // Load all tables and construct in-memory lists
  loadFromFirestore: async function(force = false) {
    const cacheKey = 'flymony_db_cache';
    const cacheTimeKey = 'flymony_db_cache_time';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 dakikalık önbellek süresi

    if (!force) {
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
          duration: s.Duration || ""
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
        vardi: r.Vardi ? 1 : 0
      }));

      // Önbelleğe kaydet
      const dataToCache = {
        artists: this.artists,
        guests: this.guests,
        songs: this.songs,
        song_artists: this.song_artists,
        requests: this.requests
      };
      localStorage.setItem(cacheKey, JSON.stringify(dataToCache));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
    } catch (err) {
      console.error("API loading error:", err);
    }
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
      <td data-label="Telefon">${guest.phone || '-'}</td>
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
    
    const isGuestModalOpen = guestModal && guestModal.style.display !== 'none';
    const isBulkPanelVisible = bulkPhotoPanel && bulkPhotoPanel.style.display !== 'none';
    
    if (!isGuestModalOpen && !isBulkPanelVisible) return;

    // Do not hijack paste event if focus is in Notes textarea or search inputs
    if (document.activeElement && (document.activeElement.id === 'guestNotes' || document.activeElement.id === 'bulkGuestSearchInput')) {
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
      Photos: photos
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

  // Render previews
  renderVanillaProfilePreview();
  renderVanillaGalleryPreviews();

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

// ----------------- SONGS -----------------
function renderSongs() {
  const filteredSongs = DB.songs.filter(song => {
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
    }
    return songsSortDirection === 'asc' ? res : -res;
  });

  // Render header sorting indicators dynamically
  const keys = ['title', 'artists'];
  const ids = { title: 'sortIconSongTitle', artists: 'sortIconSongArtists' };
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

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Şarkı Adı">${song.title}</td>
      <td data-label="Sanatçılar">${artistNames || '-'}</td>
      <td data-label="İşlemler" class="action-btns">
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
    const songData = {
      SongTitle: title,
      Duration: "",
      ArtistIDs: selectedArtistIds.map(Number)
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
      
      const guestMatch = guestNames.includes(searchLower);
      const songMatch = songTitle.includes(searchLower);
      const artistMatch = artistNames.includes(searchLower);
      
      if (!guestMatch && !songMatch && !artistMatch) {
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
    
    const tickHtml = req.vardi ? `<span style="color: #059669; font-weight: bold; font-size: 1.2rem; margin-right: 0.35rem;" title="Vardı">✓</span>` : '';
    const statusHtml = `<div style="display: inline-flex; align-items: center;">${tickHtml}<span class="${getStatusClass(req.status)}">${req.status || 'Kayıtlı'}</span></div>`;

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
      Vardi: document.getElementById('reqVardi').checked ? 1 : 0
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
  const titleInput = document.getElementById('filterSongTitle');
  const artistInput = document.getElementById('filterSongArtist');

  filterSongTitle = titleInput ? titleInput.value : '';
  filterSongArtist = artistInput ? artistInput.value : '';

  renderSongs();
}

// Şarkı Filtrelerini Temizle
function clearAllSongFilters() {
  const titleInput = document.getElementById('filterSongTitle');
  const artistInput = document.getElementById('filterSongArtist');

  if (titleInput) titleInput.value = '';
  if (artistInput) artistInput.value = '';

  filterSongTitle = '';
  filterSongArtist = '';

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

// ----------------- BULK PHOTO PROCESSING -----------------
function showBulkPhotoPanel() {
  document.getElementById('otherOperationsHome').style.display = 'none';
  document.getElementById('bulkPhotoPanel').style.display = 'block';
  
  // Clear states
  bulkSelectedPhotos = [];
  bulkSelectedGuestIds.clear();
  bulkGuestFilter = '';
  
  // Reset search input
  const searchInput = document.getElementById('bulkGuestSearchInput');
  if (searchInput) searchInput.value = '';
  
  // Render views
  renderBulkPhotoPreviews();
  populateBulkGuestListbox();
}

function showOtherOperationsHome() {
  document.getElementById('bulkPhotoPanel').style.display = 'none';
  document.getElementById('otherOperationsHome').style.display = 'block';
}

function populateBulkGuestListbox() {
  const container = document.getElementById('bulkGuestListboxContainer');
  if (!container) return;
  
  const filteredGuests = DB.guests.filter(g => {
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
}

function bulkClearGuestSelection() {
  bulkSelectedGuestIds.clear();
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
window.removeVanillaProfilePicture = removeVanillaProfilePicture;
window.removeVanillaGalleryPhoto = removeVanillaGalleryPhoto;
window.populateBirthdateDropdowns = populateBirthdateDropdowns;
window.sortRequests = sortRequests;
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


