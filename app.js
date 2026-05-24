// LocalStorage tabanlı veritabanı simülasyonu
const DB = {
  artists: JSON.parse(localStorage.getItem('artists')) || [],
  songs: JSON.parse(localStorage.getItem('songs')) || [],
  guests: JSON.parse(localStorage.getItem('guests')) || [],
  requests: JSON.parse(localStorage.getItem('requests')) || [],
  song_artists: JSON.parse(localStorage.getItem('song_artists')) || [],

  save: function() {
    localStorage.setItem('artists', JSON.stringify(this.artists));
    localStorage.setItem('songs', JSON.stringify(this.songs));
    localStorage.setItem('guests', JSON.stringify(this.guests));
    localStorage.setItem('requests', JSON.stringify(this.requests));
    localStorage.setItem('song_artists', JSON.stringify(this.song_artists));
  },

  getId: function(table) {
    const records = this[table];
    return records.length > 0 ? Math.max(...records.map(r => r.id)) + 1 : 1;
  }
};

// Sayfa yüklendiğinde tabloları oluştur
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  renderAllTables();
  populateDropdowns();
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
}
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
  // Formları temizle
  const form = document.querySelector(`#${modalId} form`);
  if(form) form.reset();
  
  // Gizli ID alanlarını temizle
  const idFields = ['songID', 'artistID', 'guestID'];
  idFields.forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  
  // Başlıkları sıfırla
  if(document.getElementById('artistModalTitle')) document.getElementById('artistModalTitle').innerText = 'Yeni Sanatçı';
  if(document.getElementById('guestModalTitle')) document.getElementById('guestModalTitle').innerText = 'Yeni Misafir';
  if(document.getElementById('songModalTitle')) document.getElementById('songModalTitle').innerText = 'Yeni Şarkı';
}

// Dropdown'ları Doldur (Şarkılar, Sanatçılar, Misafirler)
function populateDropdowns() {
  const reqGuestSel = document.getElementById('reqGuestID');
  const reqSongSel = document.getElementById('reqSongID');
  const songArtistContainer = document.getElementById('songArtistContainer');

  reqGuestSel.innerHTML = '<option value="">-- Seçiniz --</option>' + DB.guests.map(g => `<option value="${g.id}">${g.firstName} ${g.lastName}</option>`).join('');
  
  reqSongSel.innerHTML = '<option value="">-- Seçiniz --</option>' + DB.songs.map(s => {
    const artistIds = DB.song_artists.filter(sa => sa.songId === s.id).map(sa => sa.artistId);
    const artistNames = DB.artists.filter(a => artistIds.includes(a.id)).map(a => a.name).join(', ');
    return `<option value="${s.id}">${s.title} ${artistNames ? `(${artistNames})` : ''}</option>`;
  }).join('');

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
      <td>${artist.id}</td>
      <td>${artist.name}</td>
      <td class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="editArtist(${artist.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteArtist(${artist.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveArtist(e) {
  e.preventDefault();
  const id = document.getElementById('artistID').value;
  const name = document.getElementById('artistName').value;

  if (id) {
    const artist = DB.artists.find(a => a.id == id);
    if (artist) artist.name = name;
  } else {
    DB.artists.push({ id: DB.getId('artists'), name });
  }

  DB.save();
  closeModal('artistModal');
  renderAllTables();
}

function editArtist(id) {
  const artist = DB.artists.find(a => a.id == id);
  if (!artist) return;
  document.getElementById('artistID').value = artist.id;
  document.getElementById('artistName').value = artist.name;
  document.getElementById('artistModalTitle').innerText = 'Sanatçı Düzenle';
  openModal('artistModal');
}

function deleteArtist(id) {
  if (confirm('Emin misiniz?')) {
    DB.artists = DB.artists.filter(a => a.id != id);
    DB.song_artists = DB.song_artists.filter(sa => sa.artistId != id);
    DB.save();
    renderAllTables();
  }
}

// ----------------- GUESTS -----------------
function renderGuests() {
  const tbody = document.querySelector('#guestsTable tbody');
  tbody.innerHTML = DB.guests.length === 0 ? '<tr><td colspan="4" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  DB.guests.forEach(guest => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${guest.firstName} ${guest.lastName}</td>
      <td>${guest.phone || '-'}</td>
      <td>${guest.instagram ? `<a href="${guest.instagram}" target="_blank">Profil</a>` : '-'}</td>
      <td class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="editGuest(${guest.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteGuest(${guest.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveGuest(e) {
  e.preventDefault();
  const id = document.getElementById('guestID').value;
  const firstName = document.getElementById('guestFirstName').value;
  const lastName = document.getElementById('guestLastName').value;
  const phone = document.getElementById('guestPhone').value;
  const instagram = document.getElementById('guestInstagram').value;

  if (id) {
    const guest = DB.guests.find(g => g.id == id);
    if (guest) {
      guest.firstName = firstName;
      guest.lastName = lastName;
      guest.phone = phone;
      guest.instagram = instagram;
    }
  } else {
    DB.guests.push({ id: DB.getId('guests'), firstName, lastName, phone, instagram });
  }

  DB.save();
  closeModal('guestModal');
  renderAllTables();
}

function editGuest(id) {
  const guest = DB.guests.find(g => g.id == id);
  if (!guest) return;
  document.getElementById('guestID').value = guest.id;
  document.getElementById('guestFirstName').value = guest.firstName;
  document.getElementById('guestLastName').value = guest.lastName;
  document.getElementById('guestPhone').value = guest.phone || '';
  document.getElementById('guestInstagram').value = guest.instagram || '';
  document.getElementById('guestModalTitle').innerText = 'Misafir Düzenle';
  openModal('guestModal');
}

function deleteGuest(id) {
  if (confirm('Emin misiniz?')) {
    DB.guests = DB.guests.filter(g => g.id != id);
    DB.requests = DB.requests.filter(r => r.guestId != id);
    DB.save();
    renderAllTables();
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
      <td>${song.title}</td>
      <td>${artistNames || '-'}</td>
      <td class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="editSong(${song.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSong(${song.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveSong(e) {
  e.preventDefault();
  const id = document.getElementById('songID').value;
  const title = document.getElementById('songTitle').value;
  
  const checkboxes = document.querySelectorAll('input[name="songArtists"]:checked');
  const selectedArtistIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  let songId = id;
  if (id) {
    const song = DB.songs.find(s => s.id == id);
    if (song) {
      song.title = title;
    }
    // Eski ilişkileri sil
    DB.song_artists = DB.song_artists.filter(sa => sa.songId != id);
  } else {
    songId = DB.getId('songs');
    DB.songs.push({ id: songId, title });
  }

  // Yeni ilişkileri ekle
  selectedArtistIds.forEach(artistId => {
    DB.song_artists.push({ songId: parseInt(songId), artistId });
  });

  DB.save();
  closeModal('songModal');
  renderAllTables();
}

function editSong(id) {
  const song = DB.songs.find(s => s.id == id);
  if (!song) return;
  
  document.getElementById('songID').value = song.id;
  document.getElementById('songTitle').value = song.title;
  
  // Önce dropdown'ları (checkbox'ları) oluştur ki check atabilelim
  populateDropdowns();
  
  const artistIds = DB.song_artists.filter(sa => sa.songId == id).map(sa => sa.artistId);
  const checkboxes = document.querySelectorAll('input[name="songArtists"]');
  checkboxes.forEach(cb => {
    cb.checked = artistIds.includes(parseInt(cb.value));
  });

  document.getElementById('songModalTitle').innerText = 'Şarkı Düzenle';
  openModal('songModal');
}

function deleteSong(id) {
  if (confirm('Emin misiniz?')) {
    DB.songs = DB.songs.filter(s => s.id != id);
    DB.song_artists = DB.song_artists.filter(sa => sa.songId != id);
    DB.requests = DB.requests.filter(r => r.songId != id);
    DB.save();
    renderAllTables();
  }
}

// ----------------- REQUESTS -----------------
function renderRequests() {
  const tbody = document.querySelector('#requestsTable tbody');
  tbody.innerHTML = DB.requests.length === 0 ? '<tr><td colspan="4" style="text-align:center">Kayıt bulunamadı.</td></tr>' : '';
  
  // Tarihe göre sırala (en yeni en üstte)
  const sortedReqs = [...DB.requests].sort((a,b) => b.date - a.date);

  sortedReqs.forEach(req => {
    const guest = DB.guests.find(g => g.id == req.guestId);
    const song = DB.songs.find(s => s.id == req.songId);
    
    if(!guest || !song) return; // Eksik veri varsa atla

    // Saat bilgisini kaldırdık, sadece Türkçe tarih formatı (örn. 24 Mayıs 2026) gösteriyoruz
    const dateStr = new Date(req.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${guest.firstName} ${guest.lastName}</td>
      <td>${song.title}</td>
      <td class="action-btns">
        <button class="btn btn-sm btn-danger" onclick="deleteRequest(${req.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveRequest(e) {
  e.preventDefault();
  const guestId = parseInt(document.getElementById('reqGuestID').value);
  const songId = parseInt(document.getElementById('reqSongID').value);

  DB.requests.push({
    id: DB.getId('requests'),
    guestId,
    songId,
    date: Date.now()
  });

  DB.save();
  closeModal('requestModal');
  renderAllTables();
}

function deleteRequest(id) {
  if (confirm('Emin misiniz?')) {
    DB.requests = DB.requests.filter(r => r.id != id);
    DB.save();
    renderAllTables();
  }
}

// Tüm Tabloları Güncelle
function renderAllTables() {
  renderArtists();
  renderGuests();
  renderSongs();
  renderRequests();
}
