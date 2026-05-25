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
  if (DB.artists.length === 0) {
    autoSeedArtists();
  } else {
    renderAllTables();
    populateDropdowns();
    setupArtistSearch();
    setupDropdownFilters();
  }
});

function autoSeedArtists() {
  fetch('frontend/public/sanatcilar.txt')
    .then(res => {
      if (!res.ok) throw new Error('File not found');
      return res.text();
    })
    .then(text => {
      const names = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
        
      if (names.length > 0) {
        names.forEach(name => {
          const isDuplicate = DB.artists.some(a => a.name.trim().toLowerCase() === name.toLowerCase());
          if (!isDuplicate) {
            DB.artists.push({ id: DB.getId('artists'), name });
          }
        });
        DB.save();
        console.log(`[Auto-Seed] Successfully loaded ${names.length} artists into LocalStorage.`);
      }
      renderAllTables();
      populateDropdowns();
      setupArtistSearch();
      setupDropdownFilters();
    })
    .catch(err => {
      console.warn('[Auto-Seed] Failed to fetch sanatcilar.txt, starting with empty artists.', err);
      renderAllTables();
      populateDropdowns();
      setupArtistSearch();
      setupDropdownFilters();
    });
}

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
  const firstName = document.getElementById('guestFirstName').value.trim();
  const lastName = document.getElementById('guestLastName').value.trim();
  const phone = document.getElementById('guestPhone').value;
  const instagram = document.getElementById('guestInstagram').value;

  if (!firstName || !lastName) {
    alert("Ad ve Soyad alanları boş bırakılamaz!");
    return;
  }

  const isDuplicate = DB.guests.some(g => g.id != id && 
    g.firstName.trim().toLowerCase() === firstName.toLowerCase() && 
    g.lastName.trim().toLowerCase() === lastName.toLowerCase()
  );
  if (isDuplicate) {
    alert("Bu isimde bir misafir zaten var!");
    return;
  }

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
  
  document.getElementById('songModalTitle').innerText = 'Şarkı Düzenle';
  openModal('songModal'); // openModal calls populateDropdowns, creating the checkboxes
  
  // Set checked states after checkboxes are generated
  const artistIds = DB.song_artists.filter(sa => sa.songId == id).map(sa => sa.artistId);
  const checkboxes = document.querySelectorAll('input[name="songArtists"]');
  checkboxes.forEach(cb => {
    cb.checked = artistIds.includes(parseInt(cb.value));
  });
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
    const guestIds = req.guestIds || (req.guestId ? [req.guestId] : []);
    const guests = DB.guests.filter(g => guestIds.includes(g.id));
    const song = DB.songs.find(s => s.id == req.songId);
    
    if(guests.length === 0 || !song) return; // Eksik veri varsa atla

    const guestNames = guests.map(g => `${g.firstName} ${g.lastName}`).join(', ');
    const dateStr = new Date(req.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${guestNames}</td>
      <td>${song.title}</td>
      <td class="action-btns">
        <button class="btn btn-sm btn-outline" onclick="editRequest(${req.id})">Düzenle</button>
        <button class="btn btn-sm btn-danger" onclick="deleteRequest(${req.id})">Sil</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function saveRequest(e) {
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

  // Check duplicate request
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

  if (id) {
    const req = DB.requests.find(r => r.id == id);
    if (req) {
      req.guestIds = guestIds;
      req.guestId = guestIds[0]; // backward compatibility
      req.songId = songId;
    }
  } else {
    DB.requests.push({
      id: DB.getId('requests'),
      guestIds,
      guestId: guestIds[0], // backward compatibility
      songId,
      date: Date.now()
    });
  }

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

function editRequest(id) {
  const req = DB.requests.find(r => r.id == id);
  if (!req) return;

  document.getElementById('requestID').value = req.id;
  
  const guestIds = req.guestIds || (req.guestId ? [req.guestId] : []);
  document.getElementById('reqGuestID').value = guestIds.join(',');
  document.getElementById('reqSongID').value = req.songId;

  document.getElementById('requestModalTitle').innerText = 'İstek Düzenle';
  openModal('requestModal'); // openModal calls populateDropdowns

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
