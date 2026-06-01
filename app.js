// Your Firebase Config embedded directly for zero-install and direct file:/// support
const firebaseConfig = {
  apiKey: "AIzaSyDO05wXUd6u3yBJy_z17LMe0nNq81kzoKw",
  authDomain: "flymony2026.firebaseapp.com",
  projectId: "flymony2026",
  storageBucket: "flymony2026.firebasestorage.app",
  messagingSenderId: "581166285049",
  appId: "1:581166285049:web:b5c2ebc6b2305c80ad2228",
  measurementId: "G-RJMF0R9BVK"
};

// Initialize Firebase using classic global compat wrapper (supports direct file:/// loading)
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);

// In-memory lists mapped dynamically from Firestore
const DB = {
  artists: [],
  songs: [],
  guests: [],
  requests: [],
  song_artists: [],

  // Load all tables from Firestore and construct in-memory lists
  loadFromFirestore: async function() {
    try {
      // 1. Fetch artists
      const artistsSnapshot = await db.collection("artists").get();
      this.artists = [];
      artistsSnapshot.forEach((doc) => {
        this.artists.push({ 
          id: Number(doc.id), 
          name: doc.data().ArtistName 
        });
      });

      // 2. Fetch guests
      const guestsSnapshot = await db.collection("guests").get();
      this.guests = [];
      guestsSnapshot.forEach((doc) => {
        const data = doc.data();
        this.guests.push({
          id: Number(doc.id),
          firstName: data.FirstName || "",
          lastName: data.LastName || "",
          fullName: `${data.FirstName || ""} ${data.LastName || ""}`.trim(),
          phone: data.PhoneNumber || "",
          instagram: data.InstagramLink || "",
          notes: data.Notes || "",
          profilePicture: data.ProfilePicture || "",
          birthDateDay: data.BirthDateDay || "",
          birthDateMonth: data.BirthDateMonth || "",
          birthDateYear: data.BirthDateYear || "",
          photos: data.Photos || []
        });
      });

      // Sort guests ascending by FirstName & LastName (Turkish locale aware)
      this.guests.sort((a, b) => {
        const fNameCompare = a.firstName.toLocaleLowerCase('tr-TR').localeCompare(b.firstName.toLocaleLowerCase('tr-TR'), 'tr');
        if (fNameCompare !== 0) return fNameCompare;
        return a.lastName.toLocaleLowerCase('tr-TR').localeCompare(b.lastName.toLocaleLowerCase('tr-TR'), 'tr');
      });

      // 3. Fetch songs
      const songsSnapshot = await db.collection("songs").get();
      this.songs = [];
      this.song_artists = [];
      songsSnapshot.forEach((doc) => {
        const data = doc.data();
        const songId = Number(doc.id);
        this.songs.push({
          id: songId,
          title: data.SongTitle,
          duration: data.Duration || ""
        });
        const artistIds = data.ArtistIDs || [];
        artistIds.forEach(aid => {
          this.song_artists.push({ songId, artistId: Number(aid) });
        });
      });

      // 4. Fetch requests
      const requestsSnapshot = await db.collection("requests").get();
      this.requests = [];
      requestsSnapshot.forEach((doc) => {
        const data = doc.data();
        const guestIds = data.GuestIDs || [];
        this.requests.push({
          id: Number(doc.id),
          songId: Number(data.SongID),
          guestIds: guestIds.map(Number),
          guestId: guestIds[0] || null, // backward compatibility
          date: data.RequestDate ? new Date(data.RequestDate).getTime() : Date.now()
        });
      });
    } catch (err) {
      console.error("Firestore loading error:", err);
    }
  }
};

// Sayfa yüklendiğinde tabloları oluştur
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  await DB.loadFromFirestore();
  renderAllTables();
  populateDropdowns();
  setupArtistSearch();
  setupDropdownFilters();
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
    });
  });
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
  const tbody = document.querySelector('#artistsTable tbody');
  tbody.innerHTML = DB.artists.length === 0 ? '<tr><td colspan="3" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  DB.artists.forEach(artist => {
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
    const artistId = id || String(Date.now());
    await db.collection("artists").doc(artistId).set({
      ArtistName: name
    });
    closeModal('artistModal');
    await DB.loadFromFirestore();
    renderAllTables();
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
  if (confirm('Emin misiniz?')) {
    try {
      await db.collection("artists").doc(String(id)).delete();
      await DB.loadFromFirestore();
      renderAllTables();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  }
}

// ----------------- GUESTS -----------------
function renderGuests() {
  const tbody = document.querySelector('#guestsTable tbody');
  tbody.innerHTML = DB.guests.length === 0 ? '<tr><td colspan="6" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  DB.guests.forEach(guest => {
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

    // Notes summary
    const notesSummary = guest.notes
      ? (guest.notes.length > 30 ? guest.notes.substring(0, 30) + '...' : guest.notes)
      : '-';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Misafir" class="td-guest-profile">
        <div class="guest-avatar-wrapper">${avatarHtml}</div>
        <span class="guest-name-text">${guest.firstName} ${guest.lastName}</span>
      </td>
      <td data-label="Telefon">${guest.phone || '-'}</td>
      <td data-label="Instagram">
        ${guest.instagram ? `<a href="${guest.instagram}" target="_blank" class="instagram-link-badge">Profil</a>` : '-'}
      </td>
      <td data-label="Doğum Tarihi">${birthDateStr}</td>
      <td data-label="Notlar" class="td-notes-preview" title="${guest.notes || ''}">${notesSummary}</td>
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

  const isDuplicate = DB.guests.some(g => g.id != id && 
    g.firstName.trim().toLowerCase() === firstName.toLowerCase() && 
    g.lastName.trim().toLowerCase() === lastName.toLowerCase()
  );
  if (isDuplicate) {
    alert("Bu isimde bir misafir zaten var!");
    return;
  }

  try {
    const guestId = id || String(Date.now());
    await db.collection("guests").doc(guestId).set({
      FirstName: firstName,
      LastName: lastName,
      PhoneNumber: phone || "",
      InstagramLink: instagram || "",
      Notes: notes || "",
      ProfilePicture: profilePicture || "",
      BirthDateDay: birthDay ? Number(birthDay) : "",
      BirthDateMonth: birthMonth ? Number(birthMonth) : "",
      BirthDateYear: birthYear ? Number(birthYear) : "",
      Photos: photos
    });
    closeModal('guestModal');
    await DB.loadFromFirestore();
    renderAllTables();
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
  if (confirm('Emin misiniz?')) {
    try {
      await db.collection("guests").doc(String(id)).delete();
      await DB.loadFromFirestore();
      renderAllTables();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  }
}

// ----------------- SONGS -----------------
function renderSongs() {
  const tbody = document.querySelector('#songsTable tbody');
  tbody.innerHTML = DB.songs.length === 0 ? '<tr><td colspan="3" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  DB.songs.forEach(song => {
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

  const isDuplicate = DB.songs.some(s => s.id != id && s.title.trim().toLowerCase() === title.toLowerCase());
  if (isDuplicate) {
    alert("Bu isimde bir şarkı zaten var!");
    return;
  }

  try {
    const songId = id || String(Date.now());
    await db.collection("songs").doc(songId).set({
      SongTitle: title,
      Duration: "",
      ArtistIDs: selectedArtistIds.map(Number)
    });
    closeModal('songModal');
    await DB.loadFromFirestore();
    renderAllTables();
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
  if (confirm('Emin misiniz?')) {
    try {
      await db.collection("songs").doc(String(id)).delete();
      await DB.loadFromFirestore();
      renderAllTables();
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  }
}

// ----------------- REQUESTS -----------------
function renderRequests() {
  const tbody = document.querySelector('#requestsTable tbody');
  tbody.innerHTML = DB.requests.length === 0 ? '<tr><td colspan="4" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  // Tarihe göre sırala (en yeni en üstte)
  const sortedReqs = [...DB.requests].sort((a,b) => b.date - a.date);

  sortedReqs.forEach(req => {
    const guestIds = req.guestIds || (req.guestId ? [req.guestId] : []);
    const guests = DB.guests.filter(g => guestIds.includes(g.id));
    const song = DB.songs.find(s => s.id == req.songId);
    
    if(guests.length === 0 || !song) return; // Eksik veri varsa atla

    const guestNames = guests.map(g => `${g.firstName} ${g.lastName}`).join(', ');
    const dateStr = new Date(req.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Tarih">${dateStr}</td>
      <td data-label="Misafir">${guestNames}</td>
      <td data-label="İstenen Şarkı">${song.title}</td>
      <td data-label="İşlemler" class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="editRequest(${req.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteRequest(${req.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function saveRequest(e) {
  e.preventDefault();
  const id = document.getElementById('requestID').value;
  const guestIDsVal = document.getElementById('reqGuestID').value;
  const songId = parseInt(document.getElementById('reqSongID').value);

  if (!guestIDsVal) {
    alert("Lütfen en az bir misafir seçin.");
    return;
  }
  if (!songId) {
    alert("Lütfen bir şarkı seçin.");
    return;
  }

  const guestIds = guestIDsVal.split(',').map(Number);
  const isDuplicate = DB.requests.some(req => {
    if (req.id == id) return false;
    if (req.songId !== songId) return false;
    const reqGuestIds = req.guestIds || (req.guestId ? [req.guestId] : []);
    if (reqGuestIds.length !== guestIds.length) return false;
    return guestIds.every(gid => reqGuestIds.includes(gid));
  });

  if (isDuplicate) {
    alert("Bu şarkı isteği zaten mevcut!");
    return;
  }

  try {
    const requestId = id || String(Date.now());
    await db.collection("requests").doc(requestId).set({
      SongID: Number(songId),
      GuestIDs: guestIds.map(Number),
      RequestDate: id 
        ? (DB.requests.find(r => r.id == id)?.date ? new Date(DB.requests.find(r => r.id == id).date).toISOString() : new Date().toISOString()) 
        : new Date().toISOString()
    });
    closeModal('requestModal');
    await DB.loadFromFirestore();
    renderAllTables();
  } catch (err) {
    alert("Kaydetme hatası: " + err.message);
  }
}

async function deleteRequest(id) {
  if (confirm('Emin misiniz?')) {
    try {
      await db.collection("requests").doc(String(id)).delete();
      await DB.loadFromFirestore();
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

// Tüm Tabloları Güncelle
function renderAllTables() {
  renderArtists();
  renderGuests();
  renderSongs();
  renderRequests();
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

// Bind compat functions to global window for HTML inline actions support
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
