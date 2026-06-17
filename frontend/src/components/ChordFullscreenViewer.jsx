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
      setTransposeShift(0);
      setIsSingleScreen(false);
      setViewerFontSize(16);
      setIsOpen(true);
    };

    window.addEventListener('open-global-chord-viewer', handleOpen);
    return () => window.removeEventListener('open-global-chord-viewer', handleOpen);
  }, []);

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
  };

  const handleToggleToTranspose = () => {
    if (hasLyricsContent(song.Lyrics)) {
      setMode('transpose');
    } else {
      alert("Bu şarkının transpoze bilgisi yoktur");
    }
  };

  const handleToggleToChord = () => {
    if (song.ChordImagePath) {
      setMode('chord');
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

  return createPortal(
    <div className={`fullscreen-viewer-overlay ${mode === 'transpose' ? `theme-${viewerTheme}` : 'theme-chord'}`}>
      
      {/* Floating Control Buttons */}
      <div className="fullscreen-viewer-floating-controls">
        {mode === 'chord' ? (
          <button 
            type="button" 
            className="viewer-btn-float btn-transpose-toggle" 
            onClick={handleToggleToTranspose}
            title="Transpoze Ekranına Geç (T)"
          >
            T
          </button>
        ) : (
          <button 
            type="button" 
            className="viewer-btn-float btn-chord-toggle" 
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
          title="Kapat (X)"
        >
          &times;
        </button>
      </div>

      {/* Screen Content */}
      <div className="fullscreen-viewer-body">
        {mode === 'chord' ? (
          <div className="fullscreen-chord-image-wrapper">
            <img 
              src={getUploadsUrl(song.ChordImagePath)} 
              alt="Akor Görseli" 
              className="fullscreen-chord-image"
            />
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
