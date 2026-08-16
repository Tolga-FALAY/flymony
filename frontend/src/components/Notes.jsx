import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api';
import store from '../store';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filters & Search
  const [viewTab, setViewTab] = useState('active'); // 'active' | 'trash' | 'all'
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting
  const [sortField, setSortField] = useState('CreatedAt'); // 'CreatedAt' | 'NoteText' | 'Photos' | 'IsDeleted'
  const [sortAsc, setSortAsc] = useState(false); // Default: newest first (DESC)

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const syncNotes = () => {
      setNotes([...(store.notes || [])]);
    };
    syncNotes();
    window.addEventListener('store-updated', syncNotes);
    return () => window.removeEventListener('store-updated', syncNotes);
  }, []);

  const compressImage = (file, maxWidth = 1000, maxHeight = 1000, quality = 0.75) => {
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const promises = files.map(file => compressImage(file));
    const compressedImages = await Promise.all(promises);
    setPhotos(prev => [...prev, ...compressedImages]);
    e.target.value = '';
  };

  const handlePaste = async (e) => {
    const clipboardData = e.clipboardData || window.clipboardData;
    if (!clipboardData) return;
    const items = clipboardData.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const compressed = await compressImage(file);
          setPhotos(prev => [...prev, compressed]);
        }
      }
    }
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
            const compressed = await compressImage(blob, 1000, 1000, 0.75);
            setPhotos(prev => [...prev, compressed]);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) {
        alert("Panoda kopyalanmış bir görsel bulunamadı. Metin alanına tıklayıp CTRL+V kısayolunu da kullanabilirsiniz!");
      }
    } catch (err) {
      alert("Pano okuma izni verilmedi veya desteklenmiyor. Metin alanına tıklayıp klavyenizden CTRL+V kısayolunu kullanabilirsiniz!");
    }
  };

  const removePhoto = (idxToRemove) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== idxToRemove));
  };

  const resetForm = () => {
    setNoteText('');
    setPhotos([]);
    setEditingNoteId(null);
  };

  const handleSaveNote = async () => {
    if (!noteText.trim() && photos.length === 0) {
      alert('Lütfen bir not metni yazın veya fotoğraf ekleyin.');
      return;
    }

    try {
      setIsSaving(true);
      const nowIso = new Date().toISOString();

      if (editingNoteId) {
        await api.updateNote(editingNoteId, {
          NoteText: noteText,
          Photos: photos
        });
        store.updateNote(editingNoteId, {
          NoteText: noteText,
          Photos: photos,
          UpdatedAt: nowIso
        });
      } else {
        const res = await api.createNote({
          NoteText: noteText,
          Photos: photos
        });
        store.addNote({
          NoteID: res.NoteID,
          NoteText: noteText,
          Photos: photos,
          IsDeleted: 0,
          CreatedAt: nowIso,
          UpdatedAt: nowIso
        });
      }
      resetForm();
    } catch (err) {
      console.error('Not kaydetme hatası:', err);
      alert('Not kaydedilirken bir hata oluştu: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.NoteID);
    setNoteText(note.NoteText || '');
    setPhotos(note.Photos || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleSoftDelete = async (noteId) => {
    if (!window.confirm('Bu notu silmek (çöp kutusuna taşımak) istediğinize emin misiniz?')) return;
    try {
      await api.deleteNote(noteId);
      store.removeNote(noteId);
      if (editingNoteId === noteId) {
        resetForm();
      }
    } catch (err) {
      console.error('Not silme hatası:', err);
      alert('Hata: ' + err.message);
    }
  };

  const handleRestore = async (noteId) => {
    try {
      await api.restoreNote(noteId);
      store.restoreNote(noteId);
    } catch (err) {
      console.error('Geri yükleme hatası:', err);
      alert('Hata: ' + err.message);
    }
  };

  const handlePermanentDelete = async (noteId) => {
    if (!window.confirm('Bu notu KALICI olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
    try {
      await api.permanentDeleteNote(noteId);
      store.permanentDeleteNote(noteId);
    } catch (err) {
      console.error('Kalıcı silme hatası:', err);
      alert('Hata: ' + err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Counts
  const activeCount = useMemo(() => notes.filter(n => !n.IsDeleted).length, [notes]);
  const trashCount = useMemo(() => notes.filter(n => !!n.IsDeleted).length, [notes]);

  // Filtered & Sorted Notes
  const displayedNotes = useMemo(() => {
    let list = [...notes];

    // Filter by tab
    if (viewTab === 'active') {
      list = list.filter(n => !n.IsDeleted);
    } else if (viewTab === 'trash') {
      list = list.filter(n => !!n.IsDeleted);
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLocaleLowerCase('tr-TR');
      list = list.filter(n => 
        (n.NoteText || '').toLocaleLowerCase('tr-TR').includes(q) ||
        formatDate(n.CreatedAt).toLocaleLowerCase('tr-TR').includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA, valB;
      if (sortField === 'CreatedAt') {
        valA = new Date(a.CreatedAt || 0).getTime();
        valB = new Date(b.CreatedAt || 0).getTime();
      } else if (sortField === 'NoteText') {
        valA = (a.NoteText || '').toLocaleLowerCase('tr-TR');
        valB = (b.NoteText || '').toLocaleLowerCase('tr-TR');
      } else if (sortField === 'Photos') {
        valA = (a.Photos || []).length;
        valB = (b.Photos || []).length;
      } else if (sortField === 'IsDeleted') {
        valA = a.IsDeleted ? 1 : 0;
        valB = b.IsDeleted ? 1 : 0;
      } else {
        valA = a.NoteID;
        valB = b.NoteID;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [notes, viewTab, searchQuery, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'NoteText'); // Text default A-Z, dates default newest (DESC)
    }
  };

  return (
    <div className="tab-content active" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* SECTION HEADER */}
      <div className="section-header" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📝</span>
          <h2 style={{ margin: 0 }}>Hızlı Notlar & Fotoğraflar</h2>
          <span 
            style={{
              background: activeCount > 0 ? '#ef4444' : '#0284c7',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '0.78rem',
              fontWeight: 'bold',
              boxShadow: activeCount > 0 ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none'
            }}
          >
            {activeCount} Aktif Not
          </span>
        </div>

        {/* VIEW TABS */}
        <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewTab === 'active' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewTab('active')}
            style={{ border: 'none', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600 }}
          >
            📌 Aktif Notlar ({activeCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewTab === 'trash' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewTab('trash')}
            style={{ border: 'none', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600 }}
          >
            🗑️ Çöp Kutusu ({trashCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewTab('all')}
            style={{ border: 'none', padding: '4px 10px', fontSize: '0.8rem', fontWeight: 600 }}
          >
            Tümü ({notes.length})
          </button>
        </div>
      </div>

      {/* NEW / EDIT NOTE CARD */}
      <div className="card" style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem', boxShadow: '0 2px 5px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              {editingNoteId ? '✏️ Notu Düzenle' : '✍️ Yeni Not Ekle'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              🕒 Tarih & Saat: Otomatik Kaydedilir
            </span>
          </div>

          {editingNoteId && (
            <button 
              type="button" 
              className="btn btn-outline btn-sm" 
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
              onClick={resetForm}
            >
              ➕ Yeni Nota Dön
            </button>
          )}
        </div>

        {/* TEXTAREA (MULTILINE, ENTER KEY PERMITTED) */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={noteText}
          onChange={e => setNoteText(e.target.value)}
          onPaste={handlePaste}
          placeholder="Notunuzu buraya yazın... (Enter tuşu ile yeni satıra geçebilirsiniz, panodan görsel yapıştırabilirsiniz)"
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '0.92rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            resize: 'vertical',
            minHeight: '85px',
            fontFamily: 'inherit',
            lineHeight: 1.45,
            marginBottom: '0.75rem'
          }}
        />

        {/* ATTACHED PHOTOS PREVIEW */}
        {photos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            {photos.map((imgSrc, idx) => (
              <div key={idx} style={{ position: 'relative', width: '75px', height: '75px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                <img 
                  src={imgSrc} 
                  alt={`Fotoğraf ${idx + 1}`} 
                  onClick={() => setPreviewPhoto(imgSrc)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePhoto(idx);
                  }}
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                  title="Fotoğrafı Kaldır"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* TOOLBAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
              style={{ fontSize: '0.82rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Kamera ile anlık fotoğraf çek"
            >
              📷 Fotoğraf Çek
            </button>
            <input 
              type="file" 
              ref={cameraInputRef} 
              accept="image/*" 
              capture="environment" 
              style={{ display: 'none' }} 
              onChange={handlePhotoUpload} 
            />

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              style={{ fontSize: '0.82rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Galeriden görsel seç"
            >
              📂 Görsel Ekle
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              multiple 
              style={{ display: 'none' }} 
              onChange={handlePhotoUpload} 
            />

            <button
              type="button"
              className="btn btn-outline"
              onClick={pastePhotoFromClipboard}
              style={{ fontSize: '0.82rem', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              title="Panodan kopyalanmış görseli yapıştır"
            >
              📋 Yapıştır
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {editingNoteId && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={resetForm}
                style={{ fontSize: '0.85rem', padding: '5px 12px' }}
              >
                Vazgeç
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveNote}
              disabled={isSaving}
              style={{ fontSize: '0.85rem', padding: '5px 18px', fontWeight: 600 }}
            >
              {isSaving ? 'Kaydediliyor...' : (editingNoteId ? '💾 Güncelle' : '💾 Notu Kaydet')}
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH ROW */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
          <input 
            type="text" 
            placeholder="Notlarda veya tarihlerde ara..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.75rem', fontSize: '0.85rem', margin: 0 }}
          />
          {searchQuery && (
            <button 
              type="button" 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}
            >
              &times;
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {displayedNotes.length} Not listeleniyor
        </div>
      </div>

      {/* SORTABLE NOTES TABLE */}
      <div className="table-responsive" style={{ background: '#ffffff', borderRadius: '10px', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
              <th 
                style={{ padding: '0.75rem 0.85rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '160px' }}
                onClick={() => handleSort('CreatedAt')}
                title="Tarihe göre sırala"
              >
                🕒 Tarih & Saat {sortField === 'CreatedAt' ? (sortAsc ? '▲' : '▼') : '↕'}
              </th>
              <th 
                style={{ padding: '0.75rem 0.85rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => handleSort('NoteText')}
                title="Not metnine göre sırala"
              >
                📝 Not İçeriği {sortField === 'NoteText' ? (sortAsc ? '▲' : '▼') : '↕'}
              </th>
              <th 
                style={{ padding: '0.75rem 0.85rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '120px' }}
                onClick={() => handleSort('Photos')}
                title="Görsel sayısına göre sırala"
              >
                🖼️ Görseller {sortField === 'Photos' ? (sortAsc ? '▲' : '▼') : '↕'}
              </th>
              <th 
                style={{ padding: '0.75rem 0.85rem', textAlign: 'center', cursor: 'pointer', userSelect: 'none', width: '100px' }}
                onClick={() => handleSort('IsDeleted')}
                title="Duruma göre sırala"
              >
                🏷️ Durum {sortField === 'IsDeleted' ? (sortAsc ? '▲' : '▼') : '↕'}
              </th>
              <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', width: '140px' }}>
                ⚙️ İşlemler
              </th>
            </tr>
          </thead>
          <tbody>
            {displayedNotes.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {searchQuery ? 'Aramanıza uygun not bulunamadı.' : (viewTab === 'trash' ? 'Çöp kutusunda silinmiş not bulunmuyor.' : 'Henüz kayıtlı not bulunmuyor. Yukarıdan yeni not ekleyebilirsiniz.')}
                </td>
              </tr>
            ) : (
              displayedNotes.map(note => {
                const isEditing = editingNoteId === note.NoteID;
                const isDeleted = !!note.IsDeleted;

                return (
                  <tr 
                    key={note.NoteID} 
                    style={{ 
                      background: isEditing ? '#eff6ff' : (isDeleted ? '#f8fafc' : '#ffffff'),
                      borderBottom: '1px solid var(--border-soft)',
                      opacity: isDeleted ? 0.75 : 1
                    }}
                  >
                    {/* CREATED DATE & TIME */}
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatDate(note.CreatedAt)}</div>
                      {note.UpdatedAt && note.UpdatedAt !== note.CreatedAt && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Düz: {formatDate(note.UpdatedAt)}</div>
                      )}
                    </td>

                    {/* NOTE CONTENT */}
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.88rem', color: isDeleted ? 'var(--text-muted)' : 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.45, verticalAlign: 'top' }}>
                      {note.NoteText ? (
                        <div style={{ textDecoration: isDeleted ? 'line-through' : 'none' }}>
                          {note.NoteText}
                        </div>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>(Yalnızca fotoğraf eklenmiş)</span>
                      )}
                    </td>

                    {/* PHOTOS */}
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', verticalAlign: 'top' }}>
                      {note.Photos && note.Photos.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', justifyContent: 'center' }}>
                          {note.Photos.map((pSrc, pIdx) => (
                            <div 
                              key={pIdx} 
                              onClick={() => setPreviewPhoto(pSrc)}
                              style={{ width: '42px', height: '42px', borderRadius: '5px', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                              title="Büyütmek için tıklayın"
                            >
                              <img src={pSrc} alt={`Foto ${pIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>

                    {/* STATUS */}
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', verticalAlign: 'top' }}>
                      {isDeleted ? (
                        <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                          🗑️ Silindi
                        </span>
                      ) : (
                        <span style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600 }}>
                          ✅ Aktif
                        </span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {!isDeleted ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '2px 8px', fontSize: '0.75rem', height: '26px' }}
                              onClick={() => handleEditNote(note)}
                              title="Notu Düzenle"
                            >
                              ✏️ Düzenle
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              style={{ padding: '2px 8px', fontSize: '0.75rem', height: '26px' }}
                              onClick={() => handleSoftDelete(note.NoteID)}
                              title="Notu Çöp Kutusuna Taşı"
                            >
                              🗑️ Sil
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-outline"
                              style={{ padding: '2px 8px', fontSize: '0.75rem', height: '26px', color: '#16a34a', borderColor: '#16a34a' }}
                              onClick={() => handleRestore(note.NoteID)}
                              title="Silinen Notu Geri Yükle"
                            >
                              ♻️ Geri Yükle
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              style={{ padding: '2px 8px', fontSize: '0.75rem', height: '26px' }}
                              onClick={() => handlePermanentDelete(note.NoteID)}
                              title="Kalıcı Olarak Sil"
                            >
                              ❌ Yok Et
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FULLSCREEN PHOTO PREVIEW MODAL */}
      {previewPhoto && (
        <div 
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setPreviewPhoto(null)}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <img src={previewPhoto} alt="Önizleme" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} />
            <button 
              type="button" 
              onClick={() => setPreviewPhoto(null)}
              style={{ position: 'absolute', top: '-12px', right: '-12px', background: '#ef4444', color: '#ffffff', border: '2px solid #ffffff', borderRadius: '50%', width: '32px', height: '32px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
