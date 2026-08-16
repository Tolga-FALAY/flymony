import React, { useState, useEffect, useRef } from 'react';
import api from '../api';
import store from '../store';

export default function QuickNotesModal({ isOpen, onClose }) {
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      if (editingNoteId) {
        await api.updateNote(editingNoteId, {
          NoteText: noteText,
          Photos: photos
        });
        store.updateNote(editingNoteId, {
          NoteText: noteText,
          Photos: photos,
          UpdatedAt: new Date().toISOString()
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
          CreatedAt: new Date().toISOString(),
          UpdatedAt: new Date().toISOString()
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
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Bu notu silmek istediğinize emin misiniz?')) return;
    try {
      await api.deleteNote(noteId);
      store.removeNote(noteId);
      if (editingNoteId === noteId) {
        resetForm();
      }
    } catch (err) {
      console.error('Not silme hatası:', err);
      alert('Not silinirken hata oluştu: ' + err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
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

  return (
    <div className="modal-backdrop" style={{ zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.6)' }} onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '650px', 
          width: '95%', 
          maxHeight: '90vh', 
          display: 'flex', 
          flexDirection: 'column', 
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#ffffff'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>📝</span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)' }}>
              {editingNoteId ? 'Notu Düzenle' : 'Not Ekle & Hızlı Notlar'}
            </h3>
            <span 
              style={{
                background: notes.length > 0 ? '#ef4444' : '#0284c7',
                color: '#ffffff',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                boxShadow: notes.length > 0 ? '0 0 6px rgba(239, 68, 68, 0.7)' : 'none'
              }}
            >
              {notes.length} Not
            </span>
          </div>
          <button 
            type="button" 
            className="btn btn-outline" 
            style={{ padding: '2px 8px', fontSize: '1.1rem', lineHeight: 1, height: '28px', border: 'none' }}
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* NOTE INPUT CARD */}
          <div style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.85rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {editingNoteId ? '✏️ Notu Güncelle' : '✍️ Yeni Not'}
              </span>
              {editingNoteId && (
                <button 
                  type="button" 
                  className="btn btn-outline" 
                  style={{ fontSize: '0.75rem', padding: '1px 6px', height: '22px' }}
                  onClick={resetForm}
                >
                  ➕ Yeni Nota Dön
                </button>
              )}
            </div>

            {/* FREEFORM MULTI-LINE TEXTAREA */}
            <textarea
              ref={textareaRef}
              rows={4}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onPaste={handlePaste}
              placeholder="Notunuzu buraya yazın... (Enter tuşu ile alt satıra geçebilirsiniz, panodan görsel yapıştırabilirsiniz)"
              style={{
                width: '100%',
                padding: '0.65rem',
                fontSize: '0.9rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                resize: 'vertical',
                minHeight: '85px',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                marginBottom: '0.65rem'
              }}
            />

            {/* PHOTO ATTACHMENTS PREVIEW */}
            {photos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.4rem', background: '#f8fafc', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                {photos.map((imgSrc, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
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
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
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

            {/* TOOLBAR BUTTONS */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
                  style={{ fontSize: '0.8rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
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
                  style={{ fontSize: '0.8rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  title="Galeriden veya dosyadan görsel seç"
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
              </div>

              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {editingNoteId && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={resetForm}
                    style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                  >
                    Vazgeç
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveNote}
                  disabled={isSaving}
                  style={{ fontSize: '0.82rem', padding: '4px 14px', fontWeight: 600 }}
                >
                  {isSaving ? 'Kaydediliyor...' : (editingNoteId ? '💾 Güncelle' : '💾 Notu Kaydet')}
                </button>
              </div>
            </div>
          </div>

          {/* RECORDED NOTES LIST */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                📋 Kayıtlı Notlar ({notes.length})
              </h4>
            </div>

            {notes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Henüz kayıtlı bir not bulunmuyor. Yukarıdaki alandan hemen bir not veya fotoğraf ekleyebilirsiniz.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {notes.map(note => (
                  <div 
                    key={note.NoteID} 
                    style={{ 
                      background: editingNoteId === note.NoteID ? '#eff6ff' : '#ffffff', 
                      border: editingNoteId === note.NoteID ? '1.5px solid var(--primary)' : '1px solid var(--border)', 
                      borderRadius: '8px', 
                      padding: '0.75rem',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        🕒 {formatDate(note.CreatedAt || note.UpdatedAt)}
                      </span>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '1px 6px', fontSize: '0.72rem', height: '22px' }}
                          onClick={() => handleEditNote(note)}
                          title="Notu Düzenle"
                        >
                          ✏️ Düzenle
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          style={{ padding: '1px 6px', fontSize: '0.72rem', height: '22px' }}
                          onClick={() => handleDeleteNote(note.NoteID)}
                          title="Notu Sil"
                        >
                          🗑️ Sil
                        </button>
                      </div>
                    </div>

                    {/* NOTE TEXT PRE-WRAP (PRESERVES ENTER/NEWLINES) */}
                    {note.NoteText && (
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.45, marginBottom: (note.Photos && note.Photos.length > 0) ? '0.5rem' : 0 }}>
                        {note.NoteText}
                      </div>
                    )}

                    {/* PHOTOS GRID */}
                    {note.Photos && note.Photos.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                        {note.Photos.map((pSrc, pIdx) => (
                          <div 
                            key={pIdx} 
                            onClick={() => setPreviewPhoto(pSrc)}
                            style={{ width: '60px', height: '60px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                            title="Büyütmek için tıklayın"
                          >
                            <img src={pSrc} alt={`Not Foto ${pIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid var(--border)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={onClose} style={{ fontSize: '0.85rem', padding: '4px 14px' }}>
            Kapat
          </button>
        </div>
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
