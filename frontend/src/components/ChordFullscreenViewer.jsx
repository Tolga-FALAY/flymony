import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  noteToSemitone,
  sharpScale,
  getScaleForTargetKey,
  renderTransposedTextAsHTML,
  hasLyricsContent,
  getUploadsUrl
} from '../utils/chordUtils';

export default function ChordFullscreenViewer() {
  const [isOpen, setIsOpen] = useState(false);
  const [song, setSong] = useState(null);
  const [mode, setMode] = useState('chord'); // 'chord' or 'transpose'
  const [chordPageIndex, setChordPageIndex] = useState(0);

  // Transpose settings
  const [transposeShift, setTransposeShift] = useState(0);
  const [viewerFontSize, setViewerFontSize] = useState(16);
  const [viewerTheme, setViewerTheme] = useState('dark');
  const [isSingleScreen, setIsSingleScreen] = useState(false);

  const chordViewerContentRef = useRef(null);

  // Auto-fit function for Single Screen mode
  const triggerAutoFit = () => {
    const pre = chordViewerContentRef.current;
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

  // Listen for global open requests
  useEffect(() => {
    const handleOpen = (e) => {
      const { song: targetSong, mode: targetMode } = e.detail;
      if (!targetSong) return;
      
      setSong(targetSong);
      setMode(targetMode || 'chord');
      setChordPageIndex(0);
      setTransposeShift(0);
      setIsSingleScreen(false);
      setViewerFontSize(16);
      setIsOpen(true);
    };

    window.addEventListener('open-global-chord-viewer', handleOpen);
    return () => window.removeEventListener('open-global-chord-viewer', handleOpen);
  }, []);

  // Keyboard navigation for multi-page chord viewer
  useEffect(() => {
    if (!isOpen || mode !== 'chord' || !song) return;
    const chordImages = (Array.isArray(song.ChordImages) && song.ChordImages.length > 0)
      ? song.ChordImages
      : (song.ChordImagePath ? [song.ChordImagePath] : []);
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setChordPageIndex(p => Math.min(chordImages.length - 1, p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setChordPageIndex(p => Math.max(0, p - 1));
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, song, chordPageIndex]);

  // Autofit on layout triggers
  useEffect(() => {
    if (isOpen && mode === 'transpose' && isSingleScreen) {
      const timer = setTimeout(triggerAutoFit, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode, isSingleScreen, transposeShift, song, viewerFontSize]);

  if (!isOpen || !song) return null;

  // Toggle helpers
  const handleClose = () => {
    setIsOpen(false);
    setSong(null);
    setChordPageIndex(0);
  };

  const handleToggleToTranspose = () => {
    if (hasLyricsContent(song.Lyrics)) {
      setMode('transpose');
    } else {
      alert("Bu şarkının transpoze bilgisi yoktur");
    }
  };

  const handleToggleToChord = () => {
    if (song.ChordImagePath || (song.ChordImages && song.ChordImages.length > 0)) {
      setMode('chord');
      setChordPageIndex(0);
    } else {
      alert("Bu şarkının akor görseli yoktur");
    }
  };

  // Note Transposition logic (exact matching of Songs.jsx style)
  const origKey = song.OriginalKey || song.originalKey;
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

  const htmlContent = renderTransposedTextAsHTML(song.Lyrics, transposeShift, targetScale);
  const standardScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const chordImages = (Array.isArray(song.ChordImages) && song.ChordImages.length > 0)
    ? song.ChordImages
    : (song.ChordImagePath ? [song.ChordImagePath] : []);
  const currentChordImg = chordImages[chordPageIndex] || chordImages[0] || '';
  const totalPages = chordImages.length;
  const hasMultiplePages = totalPages > 1;

  return createPortal(
    <div className={`fullscreen-viewer-overlay ${mode === 'transpose' ? `theme-${viewerTheme}` : 'theme-chord'}`}>
      
      {/* Multi-page Indicator in Chord Mode */}
      {mode === 'chord' && hasMultiplePages && (
        <div 
          className="live-chord-multipage-badge"
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 100,
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '24pt',
            fontWeight: 900,
            color: '#ef4444',
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.25rem 0.85rem',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            border: '2px solid #ef4444',
            borderRadius: '10px',
            letterSpacing: '1.5px',
            textShadow: '0 0 12px rgba(239, 68, 68, 0.6)'
          }}
        >
          {chordPageIndex + 1}/{totalPages}
        </div>
      )}

      {/* Floating Control Buttons */}
      <div className="fullscreen-viewer-floating-controls">
        {mode === 'chord' ? (
          <button 
            type="button" 
            className={`viewer-btn-float btn-transpose-toggle ${hasLyricsContent(song.Lyrics) ? 'btn-status-success' : 'btn-status-danger'}`} 
            onClick={handleToggleToTranspose}
            title="Transpoze Ekranına Geç (T)"
          >
            T
          </button>
        ) : (
          <button 
            type="button" 
            className={`viewer-btn-float btn-chord-toggle ${(song.ChordImagePath || (song.ChordImages && song.ChordImages.length > 0)) ? 'btn-status-success' : 'btn-status-danger'}`} 
            onClick={handleToggleToChord}
            title="Akor Görseline Geç (A)"
          >
            A
          </button>
        )}
        <button 
          type="button" 
          className="viewer-btn-float btn-close-toggle" 
          onClick={handleClose}
          title="Kapat (X / ESC)"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      {/* Screen Content */}
      <div className="fullscreen-viewer-body">
        {mode === 'chord' ? (
          <div className="fullscreen-chord-image-wrapper" style={{ position: 'relative' }}>
            {currentChordImg ? (
              <img 
                src={getUploadsUrl(currentChordImg)} 
                alt={`Akor Görseli Sayfa ${chordPageIndex + 1}`} 
                className="fullscreen-chord-image"
              />
            ) : (
              <div style={{ color: '#f59e0b', textAlign: 'center', fontWeight: 600 }}>
                Akor görseli bulunamadı.
              </div>
            )}

            {/* Bottom Multi-page Nav Controls */}
            {hasMultiplePages && (
              <div style={{
                position: 'absolute',
                bottom: '25px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                background: 'rgba(0,0,0,0.8)',
                padding: '0.4rem 1rem',
                borderRadius: '25px',
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setChordPageIndex(p => Math.max(0, p - 1))}
                  disabled={chordPageIndex === 0}
                  style={{ padding: '0.25rem 0.65rem', opacity: chordPageIndex === 0 ? 0.3 : 1 }}
                >
                  ◀ Önceki Sayfa
                </button>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>
                  {chordPageIndex + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setChordPageIndex(p => Math.min(totalPages - 1, p + 1))}
                  disabled={chordPageIndex === totalPages - 1}
                  style={{ padding: '0.25rem 0.65rem', opacity: chordPageIndex === totalPages - 1 ? 0.3 : 1 }}
                >
                  Sonraki Sayfa ▶
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="fullscreen-transpose-wrapper">
            
            {/* Minimal/Clean sticky toolbar inside modal */}
            <div className="fullscreen-transpose-toolbar">
              <div className="toolbar-section">
                <span className="song-title-label">
                  {song.SongTitle} {song.ArtistNames && song.ArtistNames !== '-' ? ` - ${song.ArtistNames}` : ''}
                </span>
                {origKey && <span className="orig-key-badge">({origKey} Tonu)</span>}
              </div>
              
              <div className="toolbar-controls-row">
                <div className="control-group">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setTransposeShift(prev => prev - 1)}>-1 Semiton</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setTransposeShift(prev => prev + 1)}>+1 Semiton</button>
                  <button 
                    type="button" 
                    className="btn btn-sm btn-outline btn-danger-soft" 
                    onClick={() => setTransposeShift(0)}
                  >
                    Sıfırla
                  </button>
                  <span className="transpose-badge">
                    {transposeShift > 0 ? `+${transposeShift}` : transposeShift} Semiton
                  </span>
                </div>

                <div className="control-group">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setViewerFontSize(f => Math.max(10, f - 1))}>A-</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setViewerFontSize(f => Math.min(32, f + 1))}>A+</button>
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setViewerTheme(t => t === 'dark' ? 'light' : 'dark')}>
                    {viewerTheme === 'dark' ? 'Açık Tema' : 'Koyu Tema'}
                  </button>
                </div>

                <div className="control-group autofit-group">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={isSingleScreen} 
                      onChange={(e) => setIsSingleScreen(e.target.checked)} 
                    />
                    Tek Ekran Modu
                  </label>
                  {isSingleScreen && (
                    <button 
                      type="button" 
                      className="btn btn-sm btn-outline" 
                      onClick={triggerAutoFit}
                    >
                      Sığdır
                    </button>
                  )}
                </div>
              </div>

              {/* Target Key transposition quick-jump buttons */}
              {origKey && origSemitone !== null && (
                <div className="toolbar-target-keys">
                  <span className="target-key-label">Hedef Ton:</span>
                  <div className="target-key-buttons">
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
                          className={`target-key-btn ${isActive ? 'active' : ''}`}
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

            {/* Chord sheet content display */}
            <div className={`fullscreen-chord-sheet-box ${isSingleScreen ? 'single-screen' : ''}`}>
              <pre 
                ref={chordViewerContentRef}
                className={isSingleScreen ? 'chord-sheet-pre-single' : 'chord-sheet-pre'}
                style={isSingleScreen ? {} : { fontSize: `${viewerFontSize}px` }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </div>

          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
