// ==========================================================================
// CHORD SHEET TRANSPOSITION HELPER FUNCTIONS FOR REACT
// ==========================================================================

export const noteToSemitone = {
  'C': 0, 'C#': 1, 'Db': 1,
  'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'F#': 6, 'Gb': 6,
  'G': 7, 'G#': 8, 'Ab': 8,
  'A': 9, 'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

export const sharpScale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const flatScale  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function getScaleForTargetKey(targetKey) {
  if (!targetKey) return sharpScale;
  const keyUpper = targetKey.toUpperCase();
  if (['F', 'BB', 'EB', 'AB', 'DB', 'GB', 'Fm', 'Bbm', 'Ebm', 'Abm', 'Dbm', 'Gbm'].some(k => keyUpper.startsWith(k))) {
    return flatScale;
  }
  return sharpScale;
}

export function isChord(token) {
  const chordTokenRegex = /^[A-G][#b]?(?:maj|min|m|sus|add|dim|aug|alt|omit|[0-9]|\+|-|b|#)*(?:\/[A-G][#b]?(?:maj|min|m|sus|add|dim|aug|alt|omit|[0-9]|\+|-|b|#)*)?$/;
  return chordTokenRegex.test(token);
}

export function isChordLine(line) {
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

export function transposeNote(note, semitones, targetScale = sharpScale) {
  const firstChar = note.charAt(0).toUpperCase();
  const rest = note.slice(1);
  const normalizedNote = firstChar + rest;
  
  const semitone = noteToSemitone[normalizedNote];
  if (semitone === undefined) return note;
  
  let newSemitone = (semitone + semitones) % 12;
  if (newSemitone < 0) newSemitone += 12;
  
  return targetScale[newSemitone];
}

export function transposeChord(chord, semitones, targetScale = sharpScale) {
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
export function isElementRed(el) {
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
export function transposeLeafTextNodes(node, semitones, targetScale) {
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
export function traverseAndTranspose(node, semitones, targetScale) {
  if (node.nodeType === 1) { // Node.ELEMENT_NODE
    if (isElementRed(node)) {
      transposeLeafTextNodes(node, semitones, targetScale);
      return;
    }
  }
  node.childNodes.forEach(child => traverseAndTranspose(child, semitones, targetScale));
}

export function renderTransposedTextAsHTML(htmlText, semitones, targetScale = sharpScale) {
  if (!htmlText) return '<div style="color:var(--text-muted); text-align:center; padding: 2rem;">Bu şarkı için henüz akor/not girilmemiş. Düzenle butonundan ekleyebilirsiniz.</div>';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  
  if (semitones !== 0) {
    traverseAndTranspose(doc.body, semitones, targetScale);
  }
  
  return doc.body.innerHTML;
}

export function escapeHTML(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function hasLyricsContent(html) {
  if (!html) return false;
  const clean = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, '')
    .replace(/[\s\uFEFF\xA0]+/g, '');
  return clean.length > 0;
}

export const getUploadsUrl = (path) => {
  if (!path) return '';
  const apiBase = typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:5000/api'
    : (import.meta.env.VITE_API_URL || '/api');
  const base = apiBase.replace('/api', '');
  return `${base}${path}`;
};
