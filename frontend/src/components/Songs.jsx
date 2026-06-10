import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import store from '../store';

const getUploadsUrl = (path) => {
  if (!path) return '';
  const apiBase = typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:5000/api'
    : '/api';
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};

// ==========================================================================
// CHORD SHEET TRANSPOSITION HELPER FUNCTIONS FOR REACT
// ==========================================================================

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

function isChordLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === "") return false;
  
  let chordCount = 0;
  let ignoredCount = 0;
  
  const ignoredTokens = ['|', ':', '-', 'x', 'intro', 'solo', 'nakarat', 'köprü', 'bridge', 'outro', 'söz', 'sözler', 've', 'ritim', 'ritm', 'kapo', 'capo', 'arpaj', 'fill'];
  
  for (const token of tokens) {
    const cleanToken = token.toLowerCase().replace(/[:|()]/g, '');
    if (isChord(token)) {
      chordCount++;
    } else if (ignoredTokens.includes(cleanToken) || /^[0-9]+$/.test(cleanToken)) {
      ignoredCount++;
    }
  }
  
  const totalMeaningfulTokens = tokens.length - ignoredCount;
  if (totalMeaningfulTokens <= 0) return chordCount > 0;
  
  return (chordCount / totalMeaningfulTokens) >= 0.7;
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

function renderChordLineAsHTML(line, semitones, targetScale) {
  const tokenRegex = /\S+/g;
  let match;
  let output = "";
  let lastIndex = 0;
  
  while ((match = tokenRegex.exec(line)) !== null) {
    const token = match[0];
    const origStart = match.index;
    
    if (origStart > lastIndex) {
      output += " ".repeat(origStart - lastIndex);
    }
    
    let processedToken = token;
    if (isChord(token)) {
      processedToken = transposeChord(token, semitones, targetScale);
      output += `<span class="chord-highlight">${escapeHTML(processedToken)}</span>`;
    } else {
      output += escapeHTML(processedToken);
    }
    
    lastIndex = origStart + token.length;
  }
  
  if (lastIndex < line.length) {
    output += line.substring(lastIndex);
  }
  
  return output;
}

function renderTransposedTextAsHTML(text, semitones, targetScale = sharpScale) {
  if (!text) return '<div style="color:var(--text-muted); text-align:center; padding: 2rem;">Bu şarkı için akor veya söz eklenmemiş. Düzenle butonundan ekleyebilirsiniz.</div>';
  const lines = text.split('\n');
  const htmlLines = lines.map(line => {
    if (isChordLine(line)) {
      return renderChordLineAsHTML(line, semitones, targetScale);
    } else {
      return escapeHTML(line);
    }
  });
  return htmlLines.join('\n');
}

function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function Songs() {
  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);

  // Sorting configuration
  const [sortConfig, setSortConfig] = useState({ key: 'SongTitle', direction: 'asc' });

  // Filter States
  const [filterSong, setFilterSong] = useState('');
  const [filterArtist, setFilterArtist] = useState('');
  const [filterLyricsSearch, setFilterLyricsSearch] = useState('');
  const [filterMinYear, setFilterMinYear] = useState('');
  const [filterMaxYear, setFilterMaxYear] = useState('');

  // Audio Preview & Live Recording States
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaRecorderInstance, setMediaRecorderInstance] = useState(null);

  // Floating Global Player States
  const [currentPlaying, setCurrentPlaying] = useState(null); // { path, title }
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [playTimeStr, setPlayTimeStr] = useState('0:00 / 0:00');

  const globalAudioRef = useRef(null);

  // Chord Viewer Modal States
  const [isChordViewerOpen, setIsChordViewerOpen] = useState(false);
  const [viewerSong, setViewerSong] = useState(null);
  const [transposeShift, setTransposeShift] = useState(0);
  const [viewerFontSize, setViewerFontSize] = useState(16);
  const [viewerTheme, setViewerTheme] = useState('dark');

  const clearAllFilters = () => {
    setFilterSong('');
    setFilterArtist('');
    setFilterLyricsSearch('');
    setFilterMinYear('');
    setFilterMaxYear('');
  };

  const [formData, setFormData] = useState({
    SongTitle: '',
    Duration: '',
    SongYear: '',
    Lyrics: '',
    AudioPath: '',
    AudioData: '',
    OriginalKey: '',
    ArtistIDs: []
  });

  const [artistSearch, setArtistSearch] = useState('');
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);
  const [newArtistName, setNewArtistName] = useState('');

  useEffect(() => {
    const syncFromStore = () => {
      setSongs([...store.songs]);
      setArtists([...store.artists]);
    };
    if (store.isLoaded) {
      syncFromStore();
    } else {
      store.load().then(syncFromStore);
    }
    window.addEventListener('store-updated', syncFromStore);
    return () => window.removeEventListener('store-updated', syncFromStore);
  }, []);

  const openModal = (song = null) => {
    if (song) {
      setEditingSong(song);
      setFormData({
        SongTitle: song.SongTitle,
        Duration: song.Duration || '',
        SongYear: song.SongYear || '',
        Lyrics: song.Lyrics || '',
        AudioPath: song.AudioPath || '',
        AudioData: '',
        OriginalKey: song.OriginalKey || '',
        ArtistIDs: (song.ArtistIDs || []).map(String)
      });
      if (song.AudioPath) {
        setAudioPreviewUrl(getUploadsUrl(song.AudioPath));
      } else {
        setAudioPreviewUrl('');
      }
    } else {
      setEditingSong(null);
      setFormData({ SongTitle: '', Duration: '', SongYear: '', Lyrics: '', AudioPath: '', AudioData: '', OriginalKey: '', ArtistIDs: [] });
      setAudioPreviewUrl('');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSong(null);
    setArtistSearch('');
    setAudioPreviewUrl('');
    if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
      mediaRecorderInstance.stop();
    }
    setIsRecording(false);
  };

  const openChordViewer = (song) => {
    setViewerSong(song);
    setTransposeShift(0);
    setIsChordViewerOpen(true);
  };

  const closeChordViewer = () => {
    setIsChordViewerOpen(false);
    setViewerSong(null);
  };

  // Recording timer effect
  useEffect(() => {
    let interval = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Tarayıcınız ses kaydını desteklemiyor!");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];

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

      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(chunks, { type: mime });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setFormData(prev => ({
            ...prev,
            AudioData: reader.result,
            AudioPath: '' // new recording, clear path
          }));
          setAudioPreviewUrl(URL.createObjectURL(audioBlob));
        };

        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorderInstance(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
    } catch (err) {
      alert("Mikrofon erişimi alınamadı veya kayıt başlatılamadı: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderInstance && mediaRecorderInstance.state !== 'inactive') {
      mediaRecorderInstance.stop();
    }
    setIsRecording(false);
  };

  const handleAudioFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert("Ses dosyası 15MB'tan büyük olamaz!");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        AudioData: reader.result,
        AudioPath: '' // clear existing path
      }));
      setAudioPreviewUrl(URL.createObjectURL(file));
    };
  };

  const clearAudio = () => {
    setFormData(prev => ({
      ...prev,
      AudioData: '',
      AudioPath: ''
    }));
    setAudioPreviewUrl('');
  };

  // Player controls
  const playSongAudio = (song) => {
    if (!song.AudioPath) return;
    const uploadsUrl = getUploadsUrl(song.AudioPath);
    setCurrentPlaying({
      path: uploadsUrl,
      title: song.SongTitle
    });
    setIsPlaying(true);
  };

  const togglePlayGlobal = () => {
    if (!globalAudioRef.current) return;
    if (isPlaying) {
      globalAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      globalAudioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    const audio = globalAudioRef.current;
    if (!audio || isNaN(audio.duration)) return;

    const current = audio.currentTime;
    const total = audio.duration;

    const currentMins = Math.floor(current / 60);
    const currentSecs = String(Math.floor(current % 60)).padStart(2, '0');
    const totalMins = Math.floor(total / 60);
    const totalSecs = String(Math.floor(total % 60)).padStart(2, '0');

    setPlayTimeStr(`${currentMins}:${currentSecs} / ${totalMins}:${totalSecs}`);
    setPlayProgress((current / total) * 100);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlayProgress(0);
  };

  const seekGlobalAudioReact = (e) => {
    const audio = globalAudioRef.current;
    if (audio && audio.duration) {
      const percent = e.target.value;
      audio.currentTime = (percent / 100) * audio.duration;
      setPlayProgress(percent);
    }
  };

  const closeGlobalAudioReact = () => {
    const audio = globalAudioRef.current;
    if (audio) {
      audio.pause();
    }
    setCurrentPlaying(null);
    setIsPlaying(false);
  };

  useEffect(() => {
    const audio = globalAudioRef.current;
    if (audio && currentPlaying) {
      audio.src = currentPlaying.path;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Playback error:", err);
      });
    }
  }, [currentPlaying]);

  const handleCreateArtistInline = async (e) => {
    e.preventDefault();
    const trimmed = newArtistName.trim();
    if (!trimmed) {
      alert("Sanatçı adı boş olamaz!");
      return;
    }

    const isDuplicate = artists.some(a => a.ArtistName.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      alert("Bu isimde bir sanatçı zaten var!");
      return;
    }

    try {
      const newArtist = await api.createArtist({ ArtistName: trimmed });
      store.addArtist({ ArtistID: newArtist.ArtistID, ArtistName: trimmed });

      setFormData(prev => ({
        ...prev,
        ArtistIDs: [...prev.ArtistIDs, String(newArtist.ArtistID)]
      }));

      setArtistSearch('');
      setNewArtistName('');
      setIsArtistModalOpen(false);
    } catch (err) {
      alert("Sanatçı ekleme hatası: " + err.message);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleArtistChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData({ ...formData, ArtistIDs: selectedOptions });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const isDuplicate = songs.some(s => {
      if (editingSong && s.SongID === editingSong.SongID) return false;
      const titleMatch = s.SongTitle && s.SongTitle.trim().toLowerCase() === formData.SongTitle.trim().toLowerCase();
      if (!titleMatch) return false;

      const existingArtistIDs = s.ArtistIDs || [];
      const newArtistIDs = formData.ArtistIDs.map(Number);

      if (existingArtistIDs.length === 0 && newArtistIDs.length === 0) return true;
      return newArtistIDs.some(id => existingArtistIDs.includes(id));
    });

    if (isDuplicate) {
      alert("Bu şarkı zaten kayıtlı!");
      return;
    }

    const dataToSend = {
      ...formData,
      SongYear: formData.SongYear ? Number(formData.SongYear) : null,
      Lyrics: formData.Lyrics || '',
      AudioPath: formData.AudioPath || '',
      AudioData: formData.AudioData || '',
      OriginalKey: formData.OriginalKey || '',
      ArtistIDs: formData.ArtistIDs.map(Number)
    };

    try {
      if (editingSong) {
        await api.updateSong(editingSong.SongID, dataToSend);
      } else {
        await api.createSong(dataToSend);
      }
      await store.load(true); // reload to get dynamic uploads path from backend
      closeModal();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const isLinked = store.requests.some(r => r.SongID === Number(id));
      if (isLinked) {
        alert("Bu şarkıyı veya misafiri silmek için önce bu şarkının ve misafirin kayıtlı olduğu tüm istek kayıtlarını silmelisiniz");
        return;
      }
      if (window.confirm('Bu şarkıyı silmek istediğinize emin misiniz?')) {
        await api.deleteSong(id);
        store.removeSong(Number(id));
      }
    } catch (err) {
      alert("Silme hatası: " + err.message);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedSongs = [...songs].sort((a, b) => {
    let res = 0;
    if (sortConfig.key === 'SongTitle') {
      const aVal = (a.SongTitle || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.SongTitle || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    } else if (sortConfig.key === 'ArtistNames') {
      const aVal = (a.ArtistNames || '').toLocaleLowerCase('tr-TR');
      const bVal = (b.ArtistNames || '').toLocaleLowerCase('tr-TR');
      res = aVal.localeCompare(bVal, 'tr');
    } else if (sortConfig.key === 'SongYear') {
      const aVal = Number(a.SongYear) || 0;
      const bVal = Number(b.SongYear) || 0;
      res = aVal - bVal;
    }
    return sortConfig.direction === 'asc' ? res : -res;
  });

  const filteredSongs = sortedSongs.filter(song => {
    if (filterLyricsSearch) {
      const searchLyrics = filterLyricsSearch.toLocaleLowerCase('tr-TR');
      const lyricsVal = (song.Lyrics || '').toLocaleLowerCase('tr-TR');
      if (!lyricsVal.includes(searchLyrics)) return false;
    }
    if (filterSong) {
      const searchSong = filterSong.toLocaleLowerCase('tr-TR');
      const title = (song.SongTitle || '').toLocaleLowerCase('tr-TR');
      if (!title.includes(searchSong)) return false;
    }
    if (filterArtist) {
      const searchArtist = filterArtist.toLocaleLowerCase('tr-TR');
      const artistsVal = (song.ArtistNames || '').toLocaleLowerCase('tr-TR');
      if (!artistsVal.includes(searchArtist)) return false;
    }
    const songYearNum = song.SongYear ? parseInt(song.SongYear) : null;
    if (filterMinYear || filterMaxYear) {
      if (songYearNum === null || isNaN(songYearNum)) return false;
      if (filterMinYear) {
        const minVal = parseInt(filterMinYear);
        if (!isNaN(minVal) && songYearNum <= minVal) return false;
      }
      if (filterMaxYear) {
        const maxVal = parseInt(filterMaxYear);
        if (!isNaN(maxVal) && songYearNum >= maxVal) return false;
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
        <h2>Şarkılar ({filteredSongs.length})</h2>
        <button className="btn btn-primary" onClick={() => openModal()}>
          + Yeni Şarkı
        </button>
      </div>

      <div className="filters-panel">
        <div className="filter-group-row">
          <div className="filter-item">
            <label htmlFor="filterSongLyricsReact">Serbest Arama (Şarkı Sözü)</label>
            <input 
              type="text" 
              id="filterSongLyricsReact" 
              placeholder="Şarkı sözlerinde ara..." 
              value={filterLyricsSearch}
              onChange={(e) => setFilterLyricsSearch(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label htmlFor="filterSongTitleReact">Şarkı Adı</label>
            <input 
              type="text" 
              id="filterSongTitleReact" 
              placeholder="Şarkı adı ara..." 
              value={filterSong}
              onChange={(e) => setFilterSong(e.target.value)}
            />
          </div>
          <div className="filter-item">
            <label htmlFor="filterSongArtistReact">Sanatçı</label>
            <input 
              type="text" 
              id="filterSongArtistReact" 
              placeholder="Sanatçı adı ara..." 
              value={filterArtist}
              onChange={(e) => setFilterArtist(e.target.value)}
            />
          </div>
          <div className="filter-item" style={{ flex: '0 1 120px' }}>
            <label htmlFor="filterSongMinYearReact">Min Yıl</label>
            <input 
              type="number" 
              id="filterSongMinYearReact" 
              placeholder="Min" 
              value={filterMinYear}
              onChange={(e) => setFilterMinYear(e.target.value)}
              style={{ padding: '0.6rem 0.5rem' }}
            />
          </div>
          <div className="filter-item" style={{ flex: '0 1 120px' }}>
            <label htmlFor="filterSongMaxYearReact">Max Yıl</label>
            <input 
              type="number" 
              id="filterSongMaxYearReact" 
              placeholder="Max" 
              value={filterMaxYear}
              onChange={(e) => setFilterMaxYear(e.target.value)}
              style={{ padding: '0.6rem 0.5rem' }}
            />
          </div>
          <div className="filter-item filter-actions">
            <button className="btn btn-outline btn-sm" onClick={clearAllFilters}>Temizle</button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('SongTitle')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Şarkı Adı
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'SongTitle' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('SongTitle')}
                </span>
              </th>
              <th onClick={() => handleSort('ArtistNames')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Sanatçılar
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'ArtistNames' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('ArtistNames')}
                </span>
              </th>
              <th onClick={() => handleSort('SongYear')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                Yıl
                <span style={{ fontSize: '0.8rem', color: sortConfig.key === 'SongYear' ? 'inherit' : 'var(--text-muted)' }}>
                  {renderSortArrow('SongYear')}
                </span>
              </th>
              <th style={{ width: '150px' }}>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {filteredSongs.map(song => (
              <tr key={song.SongID}>
                <td data-label="Şarkı Adı">
                  <div className="song-title-wrapper">
                    <span>{song.SongTitle}</span>
                    {song.AudioPath && (
                      <button 
                        type="button" 
                        className="audio-play-btn" 
                        onClick={() => playSongAudio(song)} 
                        title="Ses Kaydını Oynat" 
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: '0.5rem', fontSize: '1.1rem', lineHeight: 1 }}
                      >
                        ▶️
                      </button>
                    )}
                  </div>
                </td>
                <td data-label="Sanatçılar">{song.ArtistNames || '-'}</td>
                <td data-label="Yıl">{song.SongYear || '-'}</td>
                <td data-label="İşlemler" className="action-btns">
                  <button className="btn btn-sm btn-outline" onClick={() => openChordViewer(song)}>Akorlar</button>
                  <button className="btn btn-sm btn-outline" onClick={() => openModal(song)}>Düzenle</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(song.SongID)}>Sil</button>
                </td>
              </tr>
            ))}
            {filteredSongs.length === 0 && (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>Kayıt bulunamadı.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingSong ? 'Şarkı Düzenle' : 'Yeni Şarkı Ekle'}</h2>
              <button className="close-btn" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Şarkı Adı</label>
                <input type="text" name="SongTitle" value={formData.SongTitle} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Yılı</label>
                <input type="number" name="SongYear" value={formData.SongYear} onChange={handleChange} placeholder="Örn: 2005" />
              </div>
              <div className="form-group">
                <label>Orijinal Ton</label>
                <select
                  name="OriginalKey"
                  value={formData.OriginalKey || ''}
                  onChange={handleChange}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '1rem',
                    outline: 'none',
                    backgroundColor: 'white'
                  }}
                >
                  <option value="">Orijinal Ton Yok (Sadece +/- ile transpoze edilebilir)</option>
                  <option value="C">C</option>
                  <option value="Cm">Cm</option>
                  <option value="C#">C#</option>
                  <option value="C#m">C#m</option>
                  <option value="D">D</option>
                  <option value="Dm">Dm</option>
                  <option value="D#">D#</option>
                  <option value="D#m">D#m</option>
                  <option value="E">E</option>
                  <option value="Em">Em</option>
                  <option value="F">F</option>
                  <option value="Fm">Fm</option>
                  <option value="F#">F#</option>
                  <option value="F#m">F#m</option>
                  <option value="G">G</option>
                  <option value="Gm">Gm</option>
                  <option value="G#">G#</option>
                  <option value="G#m">G#m</option>
                  <option value="A">A</option>
                  <option value="Am">Am</option>
                  <option value="A#">A#</option>
                  <option value="A#m">A#m</option>
                  <option value="B">B</option>
                  <option value="Bm">Bm</option>
                </select>
              </div>
              <div className="form-group">
                <label>Akorlar, Sözler ve Sahne Notları</label>
                <textarea
                  name="Lyrics"
                  value={formData.Lyrics}
                  onChange={handleChange}
                  placeholder="Akorları, sözleri ve notları buraya yazın veya yapıştırın. Örn:&#10;[Giriş]&#10;Am   G   F   E&#10;&#10;Am             Dm&#10;Hani benim gençliğim anne..."
                  rows={8}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontFamily: 'monospace',
                    fontSize: '0.95rem',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>
              <div className="form-group">
                <label>Ses Kaydı</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {audioPreviewUrl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                      <audio src={audioPreviewUrl} controls style={{ flex: 1, height: '36px' }}></audio>
                      <button type="button" className="btn btn-sm btn-danger" onClick={clearAudio} style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', fontSize: '1.1rem', lineHeight: 1, borderRadius: '6px' }} title="Ses Kaydını Sil">&times;</button>
                    </div>
                  )}

                  {!isRecording ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <label className="btn btn-outline" style={{ flex: 1, textAlign: 'center', cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.9rem', borderRadius: '8px' }}>
                        📁 Dosya Seç
                        <input type="file" accept="audio/*" onChange={handleAudioFileUpload} style={{ display: 'none' }} />
                      </label>
                      <button type="button" className="btn btn-outline" onClick={startRecording} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontSize: '0.9rem', borderRadius: '8px' }}>
                        🎤 Canlı Kaydet
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fee2e2', border: '1px solid #fca5a5', padding: '0.5rem', borderRadius: '8px', color: '#dc2626', fontSize: '0.9rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="recording-pulsate" style={{ width: '10px', height: '10px', backgroundColor: '#dc2626', borderRadius: '50%', display: 'inline-block' }}></span>
                        <span>
                          {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                          {String(recordingSeconds % 60).padStart(2, '0')}
                        </span>
                      </div>
                      <button type="button" className="btn btn-sm btn-danger" onClick={stopRecording} style={{ padding: '0.25rem 0.5rem', minHeight: 'auto', fontWeight: 600, borderRadius: '6px' }}>Durdur</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label>Süre (örn: 3:45)</label>
                <input type="text" name="Duration" value={formData.Duration} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Sanatçılar (Birden fazla seçmek için CTRL/CMD basılı tutun)</label>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Sanatçı ara..."
                    value={artistSearch}
                    onChange={(e) => setArtistSearch(e.target.value)}
                    style={{ flex: 1, margin: 0, padding: '0.5rem 0.75rem', fontSize: '0.9rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setIsArtistModalOpen(true)}
                    style={{ padding: '0.5rem 1rem', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: 1 }}
                  >
                    +
                  </button>
                </div>
                <select multiple name="ArtistIDs" value={formData.ArtistIDs} onChange={handleArtistChange} style={{ height: '100px' }}>
                  {artists.map(artist => {
                    const isVisible = (artist.ArtistName || '').toLocaleLowerCase('tr-TR').includes(artistSearch.toLocaleLowerCase('tr-TR'));
                    return (
                      <option 
                        key={artist.ArtistID} 
                        value={String(artist.ArtistID)}
                        style={{ display: isVisible ? 'block' : 'none' }}
                      >
                        {artist.ArtistName}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isArtistModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Yeni Sanatçı Ekle</h2>
              <button className="close-btn" onClick={() => setIsArtistModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateArtistInline}>
              <div className="form-group">
                <label>Sanatçı Adı</label>
                <input 
                  type="text" 
                  value={newArtistName} 
                  onChange={e => setNewArtistName(e.target.value)} 
                  required 
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setIsArtistModalOpen(false)}>İptal</button>
                <button type="submit" className="btn btn-primary">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* React Global Floating Player */}
      {currentPlaying && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid #cbd5e1', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', padding: '0.75rem 1rem', borderRadius: '12px', zIndex: 2000, display: 'flex', alignItems: 'center', gap: '0.75rem', width: '320px', transition: 'all 0.3s ease' }}>
          <button 
            type="button" 
            onClick={togglePlayGlobal} 
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--primary-color)', color: 'white' }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }} title={currentPlaying.title}>
              {currentPlaying.title}
            </span>
            <audio 
              ref={globalAudioRef} 
              onTimeUpdate={handleAudioTimeUpdate} 
              onEnded={handleAudioEnded} 
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={playProgress} 
                onChange={seekGlobalAudioReact} 
                style={{ flex: 1, height: '4px', cursor: 'pointer', margin: 0, padding: 0 }} 
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>
                {playTimeStr}
              </span>
            </div>
          </div>
          <button 
            type="button" 
            onClick={closeGlobalAudioReact} 
            style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Akor Görüntüleme Modalı */}
      {isChordViewerOpen && viewerSong && (() => {
        const origKey = viewerSong.OriginalKey || viewerSong.originalKey;
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
          let targetSemitone = (origSemitone + transposeShift) % 12;
          if (targetSemitone < 0) targetSemitone += 12;
          const targetRoot = sharpScale[targetSemitone];
          targetScale = getScaleForTargetKey(targetRoot);
        }

        const htmlContent = renderTransposedTextAsHTML(viewerSong.Lyrics || viewerSong.lyrics, transposeShift, targetScale);
        const standardScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        return (
          <div className="modal-overlay" style={{ zIndex: 1500 }}>
            <div className="modal-content" style={{ maxWidth: '900px', width: '95%', maxHeight: '90vh' }}>
              <div className="modal-header">
                <h2>
                  {viewerSong.SongTitle || viewerSong.title}
                  {viewerSong.ArtistNames && viewerSong.ArtistNames !== '-' && ` - ${viewerSong.ArtistNames}`}
                  {origKey && ` (${origKey} Tonu)`}
                </h2>
                <button className="close-btn" onClick={closeChordViewer}>&times;</button>
              </div>

              <div className="transpose-controls-container">
                <div className="transpose-row">
                  <label>Transpoze:</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setTransposeShift(prev => prev - 1)}>-1 Semiton</button>
                    <button type="button" className="btn btn-sm btn-outline" onClick={() => setTransposeShift(prev => prev + 1)}>+1 Semiton</button>
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline btn-danger" 
                      onClick={() => setTransposeShift(0)}
                      style={{ padding: '0.35rem 0.5rem', color: '#dc2626', borderColor: '#fca5a5' }}
                    >
                      Sıfırla
                    </button>
                    <span className="transpose-info-badge">
                      {transposeShift > 0 ? `+${transposeShift}` : transposeShift} Semiton
                    </span>
                  </div>
                </div>

                {origKey && origSemitone !== null && (
                  <div className="transpose-row" style={{ marginTop: '0.5rem' }}>
                    <label>Hedef Ton:</label>
                    <div className="transpose-btn-group">
                      {standardScale.map(targetRoot => {
                        const targetSemitone = noteToSemitone[targetRoot];
                        let diff = targetSemitone - origSemitone;
                        if (diff < 0) diff += 12;
                        
                        const displayName = targetRoot + suffix;
                        const isActive = (transposeShift % 12 + 12) % 12 === diff;

                        return (
                          <button
                            key={targetRoot}
                            type="button"
                            className={`transpose-btn ${isActive ? 'active' : ''}`}
                            onClick={() => setTransposeShift(diff)}
                          >
                            {displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <pre 
                className={`chord-sheet-pre ${viewerTheme === 'light' ? 'chord-sheet-light' : ''}`}
                style={{ fontSize: `${viewerFontSize}px` }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />

              <div className="chord-viewer-actions">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="chord-action-btn" onClick={() => setViewerFontSize(f => Math.max(10, f - 1))}>Yazı A-</button>
                  <button type="button" className="chord-action-btn" onClick={() => setViewerFontSize(f => Math.min(32, f + 1))}>Yazı A+</button>
                  <button type="button" className="chord-action-btn" onClick={() => setViewerTheme(t => t === 'dark' ? 'light' : 'dark')}>
                    Görünüm: {viewerTheme === 'dark' ? 'Koyu' : 'Açık'}
                  </button>
                </div>
                <button type="button" className="btn btn-outline" onClick={closeChordViewer}>Kapat</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
